// Smoke tests: every screen of the app and every page of the site must load and react to taps
// with ZERO JavaScript errors, on iPhone (WebKit), Android and desktop.
const { test, expect } = require('@playwright/test');
const fs = require('fs'), path = require('path');
const MOCK = fs.readFileSync(path.join(__dirname, 'mock-supabase.js'), 'utf8');
const MOCK_SIGNED_OUT = MOCK.replace(
  "auth:{getSession:()=>Promise.resolve({data:{session:{user:{id:'u1',email:'test@example.com'}}}}),",
  "auth:{getSession:()=>Promise.resolve({data:{session:null}}),signUp:()=>Promise.resolve({data:{session:null},error:null}),signInWithPassword:()=>Promise.resolve({error:{message:'Invalid login credentials'}}),");

async function setup(page, { signedIn = true, fresh = true, lang = 'he' } = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });
  // The real database library is replaced by a mock; nothing leaves the test machine.
  await page.route('**/vendor/sb/supabase.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: signedIn ? MOCK : MOCK_SIGNED_OUT }));
  await page.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route(/supabase\.co|fonts\.gstatic\.com|wa\.me/, r => r.fulfill({ status: 204, body: '' }));
  await page.addInitScript(([fresh, lang]) => {
    try {
      if (!fresh) { localStorage.setItem('gp-safety-ack', 'true'); localStorage.setItem('gp-install-dismissed', 'true'); }
      localStorage.setItem('gp-lang', JSON.stringify(lang));
    } catch (e) {}
    window.__errs = [];
    window.addEventListener('error', e => window.__errs.push(String(e.message)));
    window.addEventListener('unhandledrejection', e => window.__errs.push('promise: ' + String(e.reason && (e.reason.message || e.reason))));
  }, [fresh, lang]);
  return errors;
}
async function expectNoErrors(page, errors, where) {
  const inPage = await page.evaluate(() => window.__errs || []);
  expect([...errors, ...inPage], 'errors on ' + where).toEqual([]);
}

test('first visit, signed in: safety notice, install card and every screen', async ({ page }) => {
  const errors = await setup(page, { fresh: true });
  await page.goto('/#home');
  await page.waitForSelector('#view');
  for (const act of ['safetyack', 'installdismiss']) {
    const b = page.locator(`[data-act="${act}"]`).first();
    if (await b.count()) { await b.click(); await page.waitForTimeout(200); }
  }
  // the list of screens is read from the app itself, so new screens are tested automatically
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const views = JSON.parse(src.match(/const VIEWS=(\[[^\]]*\])/)[1].replace(/'/g, '"')).filter(v => v !== 'admin');
  expect(views.length).toBeGreaterThan(10);
  for (const v of views) {
    await page.evaluate(h => { location.hash = '#' + h; }, v);
    await page.waitForTimeout(250);
    await expect(page.locator('#view')).not.toBeEmpty();
    await expectNoErrors(page, errors, '#' + v);
  }
});

test('logging: diaper from the quick buttons is saved', async ({ page }) => {
  const errors = await setup(page, { fresh: false });
  await page.goto('/#today');
  const before = await page.evaluate(() => window.__events().length);
  await page.locator('[data-act="quick"][data-type="diaper"]').click();
  const save = page.locator('#sheet-root [data-sh="save"]');
  if (await save.count()) await save.click();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__events().length)).toBe(before + 1);
  await expectNoErrors(page, errors, 'quick log');
});

test('first entry: one-tap card on home saves a diaper and shows "saved"', async ({ page }) => {
  const errors = await setup(page, { fresh: false });
  // a new family with no entries yet
  await page.addInitScript(() => { const orig = Object.getOwnPropertyDescriptor(window, 'supabase'); });
  await page.route('**/vendor/sb/supabase.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: MOCK.replace(/let events=\[[\s\S]*?\];\n/, 'let events=[];\n') }));
  await page.goto('/#home');
  await expect(page.locator('.first-step')).toBeVisible();
  await page.locator('.fs-q[data-v="diaper"]').click();
  await page.locator('.fs-chip[data-v="diaper:wet"]').click();
  await expect(page.locator('#fs-toast')).toBeVisible();
  expect(await page.evaluate(() => window.__events().length)).toBe(1);
  await expect(page.locator('.first-step')).toHaveCount(0);
  await expectNoErrors(page, errors, 'first entry');
});

test('first entry: "later" turns the card into a small reminder strip', async ({ page }) => {
  const errors = await setup(page, { fresh: false });
  await page.route('**/vendor/sb/supabase.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: MOCK.replace(/let events=\[[\s\S]*?\];\n/, 'let events=[];\n') }));
  await page.goto('/#home');
  await page.locator('.fs-links [data-v="skip"]').click();
  await expect(page.locator('.fs-nudge')).toBeVisible();
  await page.locator('.fs-nudge-btn').click();
  await expect(page.locator('.first-step')).toBeVisible();
  await expectNoErrors(page, errors, 'first entry reminder');
});

test('recipes: filters, search and opening a recipe', async ({ page }) => {
  const errors = await setup(page, { fresh: false });
  await page.goto('/#foods');
  await page.locator('[data-act="fsub"][data-v="recipes"]').click();
  await page.locator('[data-act="rkind"][data-v="baking"]').click();
  await page.locator('[data-act="rstage"][data-v="k"]').click();
  await page.locator('[data-act="rkind"][data-v="all"]').click();
  await page.locator('[data-act="rstage"][data-v="all"]').click();
  await page.fill('#rec-q', 'בטטה');
  await page.locator('#rec-list > li:not([hidden]) .food-head').first().click();
  await expect(page.locator('#rec-list li.open')).toHaveCount(1);
  await expectNoErrors(page, errors, 'recipes');
});

for (const lang of ['he', 'en', 'ar']) {
  test(`signed out (${lang}): welcome, onboarding and signup form`, async ({ page }) => {
    const errors = await setup(page, { signedIn: false, fresh: true, lang });
    await page.goto('/');
    await page.waitForSelector('#view');
    const onb = page.locator('[data-act="onb"]');
    for (let i = 0; i < Math.min(await onb.count(), 3); i++) { await onb.nth(i).click(); await page.waitForTimeout(150); }
    await expectNoErrors(page, errors, 'signed-out ' + lang);
  });
}

for (const p of ['welcome', 'faq', 'privacy', 'terms', 'accessibility']) {
  test(`site page /${p} loads, menu works`, async ({ page }) => {
    const errors = await setup(page);
    await page.goto('/' + p + '?from=app');
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('.appbar')).toBeVisible();
    const menu = page.locator('#menu-btn');
    if (await menu.isVisible()) { await menu.click(); await expect(page.locator('#mnav')).toHaveClass(/open/); }
    await expectNoErrors(page, errors, '/' + p);
  });
}
