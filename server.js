/**
 * Rang Dong Street Light Price Tracker - local server
 * Vanilla Node.js (no dependencies). Serves the dashboard UI and a small
 * JSON API backed by data/prices.json.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3211;
const LIGHT_TYPES = ['LED điện lưới', 'NLMT'];
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'prices.json');
const PUBLIC_DIR = path.join(ROOT, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
  const next = { ...data, meta: { ...data.meta, lastUpdated: today() } };
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
  return next;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 1e6) reject(new Error('Body too large'));
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function validateProduct(p) {
  const errors = [];
  if (!p.brand || typeof p.brand !== 'string') errors.push('Thiếu thương hiệu (brand)');
  if (!p.name || typeof p.name !== 'string') errors.push('Thiếu tên sản phẩm (name)');
  if (!LIGHT_TYPES.includes(p.type)) errors.push(`Loại đèn phải là: ${LIGHT_TYPES.join(' hoặc ')}`);
  const watt = Number(p.watt);
  if (!Number.isFinite(watt) || watt <= 0 || watt > 5000) errors.push('Công suất (watt) không hợp lệ');
  const price = Number(p.price);
  if (!Number.isFinite(price) || price < 10000 || price > 500000000) {
    errors.push('Giá không hợp lệ (10.000đ – 500.000.000đ)');
  }
  return errors;
}

async function handleApi(req, res, url) {
  // GET /api/data -> full dataset
  if (req.method === 'GET' && url.pathname === '/api/data') {
    return sendJson(res, 200, readData());
  }

  // POST /api/products -> add a tracked product
  if (req.method === 'POST' && url.pathname === '/api/products') {
    const body = await readBody(req);
    const errors = validateProduct(body);
    if (errors.length) return sendJson(res, 400, { ok: false, errors });

    const data = readData();
    const id = `${slugify(body.brand)}-${slugify(body.name)}-${Date.now().toString(36)}`;
    const product = {
      id,
      brand: body.brand.trim(),
      name: body.name.trim(),
      type: body.type,
      watt: Number(body.watt),
      url: (body.url || '').trim(),
      estimated: Boolean(body.estimated),
      addedDate: today(),
      priceHistory: [{ date: today(), price: Number(body.price), source: 'nhập tay' }],
    };
    const next = writeData({ ...data, products: [...data.products, product] });
    return sendJson(res, 201, { ok: true, product, meta: next.meta });
  }

  // POST /api/prices -> append price points { updates: [{productId, price, source, date?}] }
  if (req.method === 'POST' && url.pathname === '/api/prices') {
    const body = await readBody(req);
    if (!Array.isArray(body.updates) || body.updates.length === 0) {
      return sendJson(res, 400, { ok: false, errors: ['Thiếu danh sách updates'] });
    }
    const data = readData();
    const applied = [];
    const products = data.products.map((p) => {
      const upd = body.updates.find((u) => u.productId === p.id);
      if (!upd) return p;
      const price = Number(upd.price);
      if (!Number.isFinite(price) || price <= 0) return p;
      const date = upd.date || today();
      applied.push({ productId: p.id, date, price });
      const history = p.priceHistory.filter((h) => h.date !== date);
      return {
        ...p,
        priceHistory: [...history, { date, price, source: upd.source || 'cập nhật' }].sort((a, b) =>
          a.date.localeCompare(b.date)
        ),
      };
    });
    const next = writeData({ ...data, products });
    return sendJson(res, 200, { ok: true, applied, meta: next.meta });
  }

  // DELETE /api/products/:id
  if (req.method === 'DELETE' && url.pathname.startsWith('/api/products/')) {
    const id = decodeURIComponent(url.pathname.slice('/api/products/'.length));
    const data = readData();
    const exists = data.products.some((p) => p.id === id);
    if (!exists) return sendJson(res, 404, { ok: false, errors: ['Không tìm thấy sản phẩm'] });
    const next = writeData({ ...data, products: data.products.filter((p) => p.id !== id) });
    return sendJson(res, 200, { ok: true, meta: next.meta });
  }

  return sendJson(res, 404, { ok: false, errors: ['API không tồn tại'] });
}

function serveStatic(req, res, url) {
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  filePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
  const abs = path.join(PUBLIC_DIR, filePath);
  if (!abs.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(abs, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    const ext = path.extname(abs).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
    } else {
      serveStatic(req, res, url);
    }
  } catch (err) {
    console.error(`[error] ${req.method} ${url.pathname}:`, err.message);
    sendJson(res, 500, { ok: false, errors: [err.message] });
  }
});

server.listen(PORT, () => {
  console.log(`Rang Dong Solar Price Tracker: http://localhost:${PORT}`);
});
