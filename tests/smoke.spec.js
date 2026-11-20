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

const MOCK_VETERAN = MOCK.replace('let events=[', "let events=[{id:'o1',baby:'b1',type:'feed',t:now-5*864e5,data:{side:'R',mins:9},by_user:'u1'},{id:'o2',baby:'b1',type:'diaper',t:now-4*864e5,data:{kind:'wet'},by_user:'u1'},{id:'o3',baby:'b1',type:'sleep',t:now-4*864e5,data:{mins:60},by_user:'u1'},");

test('feedback: card appears after a few days, the X closes it, and it stays closed', async ({ page }) => {
  const errors = await setup(page, { fresh: false });
  await page.route('**/vendor/sb/supabase.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: MOCK_VETERAN }));
  await page.goto('/#home');
  await expect(page.locator('.fb-home')).toBeVisible();
  await expect(page.locator('.fb-home')).not.toContainText('אל תשאלו');
  await page.locator('[data-act="fbclose"]').click();
  await expect(page.locator('.fb-home')).toHaveCount(0);
  await page.reload();
  await page.waitForSelector('#view');
  await expect(page.locator('.fb-home')).toHaveCount(0);
  await expectNoErrors(page, errors, 'feedback card close');
});

test('feedback: form with stars per section is sent and the card disappears for good', async ({ page }) => {
  const errors = await setup(page, { fresh: false });
  await page.route('**/vendor/sb/supabase.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: MOCK_VETERAN }));
  await page.goto('/#home');
  await page.locator('[data-act="fbopen"]').click();
  await expect(page.locator('.fb-star').first()).toBeVisible();
  // no community in the list of sections
  await expect(page.locator('.fb-sec')).toHaveCount(7);
  await expect(page.locator('#view')).not.toContainText('קהילה');
  await page.locator('[data-act="fbstar"][data-k="all"][data-v="4"]').click();
  await page.locator('[data-act="fbstar"][data-k="foods"][data-v="5"]').click();
  await page.locator('[data-act="fbstar"][data-k="today"][data-v="3"]').click();
  // the page redraws on the next frame after a tap; wait for it so the text is typed into the final field
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.locator('#fb-improve').fill('תזכורת לוויטמין');
  await page.locator('[data-act="fbsend"]').click();
  await expect(page.locator('#view')).toContainText('תודה');
  const sent = await page.evaluate(() => window.__fb);
  expect(sent.length).toBe(1);
  expect(sent[0].rating).toBe(4);
  expect(sent[0].section_ratings).toEqual({ foods: 5, today: 3 });
  expect(sent[0].improve).toBe('תזכורת לוויטמין');
  await page.goto('/#home');
  await expect(page.locator('.fb-home')).toHaveCount(0);
  await expectNoErrors(page, errors, 'feedback form');
});

test('feedback: empty form shows a message and sends nothing', async ({ page }) => {
  const errors = await setup(page, { fresh: false });
  await page.goto('/#feedback');
  await page.locator('[data-act="fbsend"]').click();
  await expect(page.locator('[role="alert"]')).toBeVisible();
  expect(await page.evaluate(() => (window.__fb || []).length)).toBe(0);
  await expectNoErrors(page, errors, 'feedback empty');
});

test('first foods: recipes tab comes right after "BLW & info" and has a promo at the top', async ({ page }) => {
  const errors = await setup(page, { fresh: false });
  await page.goto('/#foods');
  const tabs = await page.locator('.chip[data-act="fsub"]').allTextContents();
  expect(tabs[0]).toContain('בייבילד');
  expect(tabs[1]).toContain('מתכונים');
  await expect(page.locator('.rec-promo')).toBeVisible();
  await page.locator('.rec-promo').click();
  await expect(page.locator('#rec-list')).toBeVisible();
  await expectNoErrors(page, errors, 'recipes promo');
});

test('recipes: heart moves a recipe to the top and the "favorites" filter shows it', async ({ page }) => {
  const errors = await setup(page, { fresh: false });
  await page.goto('/#foods');
  await page.locator('.chip[data-act="fsub"][data-v="recipes"]').click();
  const hearts = page.locator('[data-act="recfav"]');
  const last = hearts.nth((await hearts.count()) - 1);
  const id = await last.getAttribute('data-i');
  await last.click();
  await expect(page.locator('#rec-list > li').first().locator('[data-act="recfav"]')).toHaveAttribute('data-i', id);
  await expect(page.locator(`[data-act="recfav"][data-i="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-act="rkind"][data-v="fav"]').click();
  await expect(page.locator('#rec-list > li')).toHaveCount(1);
  await page.locator(`[data-act="recfav"][data-i="${id}"]`).click();
  await expect(page.locator('#rec-list')).toHaveCount(0);
  await expectNoErrors(page, errors, 'recipe hearts');
});

test('weekly summary: opens, shows numbers, copy works', async ({ page, context }) => {
  const errors = await setup(page, { fresh: false });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await page.goto('/#today');
  await page.locator('[data-act="wktoggle"]').click();
  await expect(page.locator('.wk-rows li').first()).toBeVisible();
  await expect(page.locator('.wk-rows')).toContainText('הנקות');
  await page.locator('[data-act="wkcopy"]').click();
  await expect(page.locator('[data-act="wkcopy"]')).toContainText('הועתק');
  await expectNoErrors(page, errors, 'weekly summary');
});

test('recipes: filters, search and opening a recipe', async ({ page }) => {
  const errors = await setup(page, { fresh: false });
  await page.goto('/#foods');
  await page.locator('.chip[data-act="fsub"][data-v="recipes"]').click();
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


test('save failure: a visible message appears, the entry is kept, and it is sent again by itself', async ({ page }) => {
  test.setTimeout(60000);
  const errors = await setup(page, { fresh: false });
  await page.goto('/#home');
  await page.waitForSelector('#view');
  await page.evaluate(() => { window.__failIns = true; });
  await page.goto('/#today');
  await page.locator('[data-act="quick"][data-type="diaper"]').click();
  const save = page.locator('#sheet-root [data-sh="save"]');
  if (await save.count()) await save.click();
  await expect(page.locator('#savebar')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#savebar')).toContainText('עוד לא נשמר');
  const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('gp-pending') || '[]').length);
  expect(queued).toBeGreaterThan(0);
  const before = await page.evaluate(() => window.__events().length);
  await page.evaluate(() => { window.__failIns = false; });
  await page.locator('[data-act="pendretry"]').click();
  await expect(page.locator('#savebar')).toBeHidden({ timeout: 10000 });
  const after = await page.evaluate(() => window.__events().length);
  expect(after).toBe(before + queued);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gp-pending') || '[]').length)).toBe(0);
  await expectNoErrors(page, errors, 'save failure');
});


const MOCK_EMPTY = MOCK.replace(/let events=\[[\s\S]*?\];\n/, 'let events=[];\n');
const MOCK_SOLO = MOCK_VETERAN.replace("{family_id:'f1',user_id:'u1',display_name:'אמא'},{family_id:'f1',user_id:'u2',display_name:'אבא'}", "{family_id:'f1',user_id:'u1',display_name:'אמא'}");

test('partner card: shown to a single parent, one WhatsApp link, X closes it for two weeks', async ({ page }) => {
  const errors = await setup(page, { fresh: false });
  await page.route('**/vendor/sb/supabase.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: MOCK_SOLO }));
  await page.goto('/#home');
  const card = page.locator('.partner-home');
  await expect(card).toBeVisible();
  expect(await card.locator('a[data-act="partnersend"]').getAttribute('href')).toContain('wa.me');
  await page.locator('[data-act="partnerclose"]').click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await page.waitForSelector('#view');
  await expect(page.locator('.partner-home')).toHaveCount(0);
  await expectNoErrors(page, errors, 'partner card');
});

test('partner card: not shown when two parents are already in the family', async ({ page }) => {
  const errors = await setup(page, { fresh: false });
  await page.route('**/vendor/sb/supabase.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: MOCK_VETERAN }));
  await page.goto('/#home');
  await page.waitForSelector('#view');
  await page.waitForTimeout(400);
  await expect(page.locator('.partner-home')).toHaveCount(0);
  await expectNoErrors(page, errors, 'partner card hidden');
});

test('install card: not on the very first visit with no entries, appears after the first entry', async ({ page }) => {
  const errors = await setup(page, { fresh: true });
  await page.addInitScript(() => { try { localStorage.setItem('gp-safety-ack', 'true'); } catch (e) {} });
  await page.route('**/vendor/sb/supabase.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: MOCK_EMPTY }));
  await page.goto('/#home');
  await page.waitForSelector('#view');
  await expect(page.locator('.install-card')).toHaveCount(0);
  await page.locator('[data-act="firststep"][data-v="diaper"]').click();
  await page.locator('[data-act="firststep"][data-v="diaper:wet"]').click();
  await expect(page.locator('.install-card')).toBeVisible();
  await expectNoErrors(page, errors, 'install timing');
});

test('home: short "today so far" summary shows after an entry, and the first-step card has a sample', async ({ page }) => {
  const errors = await setup(page, { fresh: false });
  await page.route('**/vendor/sb/supabase.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: MOCK_EMPTY }));
  await page.goto('/#home');
  await expect(page.locator('.fs-sample')).toContainText('חיתולים');
  await expect(page.locator('.home-day')).toHaveCount(0);
  await page.locator('[data-act="firststep"][data-v="diaper"]').click();
  await page.locator('[data-act="firststep"][data-v="diaper:wet"]').click();
  await expect(page.locator('.home-day')).toContainText('חיתול אחד');
  await expectNoErrors(page, errors, 'home summary');
});


test('running timer: a big bar on home, one tap saves the sleep, and the message says the timer is running', async ({ page }) => {
  const errors = await setup(page, { fresh: false });
  await page.route('**/vendor/sb/supabase.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: MOCK_EMPTY }));
  await page.goto('/#home');
  await expect(page.locator('.timer-bar')).toHaveCount(0);
  await page.locator('[data-act="firststep"][data-v="sleep"]').click();
  await expect(page.locator('#fs-toast')).toContainText('הטיימר רץ');
  await expect(page.locator('#fs-toast')).not.toContainText('נשמר');
  await page.goto('/#home');
  const bar = page.locator('.timer-bar');
  await expect(bar).toBeVisible();
  await expect(bar.locator('[data-timer-hs]')).toHaveText(/\d\d:\d\d/);
  await bar.locator('.tb-btn').click();
  await expect(page.locator('.timer-bar')).toHaveCount(0);
  await expect(page.locator('.home-day')).toContainText('שינה');
  await expectNoErrors(page, errors, 'timer bar');
});
