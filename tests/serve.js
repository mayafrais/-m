// Tiny static server for the tests (same as Vercel's cleanUrls: /privacy -> privacy.html).
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  if (p === '/') p = '/index.html';
  let f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    // the same security headers Vercel sends (vercel.json), so tests catch anything the policy would block
    const hdr = { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' };
    try { for (const h of JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')).headers[0].headers) hdr[h.key.toLowerCase()] = h.value; } catch (e) {}
    res.writeHead(200, hdr);
    res.end(data);
  });
}).listen(4173, '127.0.0.1');
