/* Rang Dong Street Light Price Tracker - dashboard logic */
'use strict';

const BRANDS = ['Rạng Đông', 'Elink', 'Ero', 'Asia', 'Điện Quang', 'HALEDCO', 'Philips', 'Duhal'];
const HOME_BRAND = 'Rạng Đông';
const SERIES_VARS = ['--series-1', '--series-2', '--series-3', '--series-4', '--series-5', '--series-6', '--series-7', '--series-8'];

const state = { data: null, periodDays: 30, watt: 'all', type: 'all', staticMode: false };

const $ = (sel) => document.querySelector(sel);

/* ===== Data adapter: full app (Node API) vs static demo (GitHub Pages) ===== */

const LS_KEY = 'rd-street-tracker-local-products';

function localProducts() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; }
}
function saveLocalProducts(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

async function fetchDataset() {
  try {
    const res = await fetch('/api/data');
    if (res.ok && (res.headers.get('content-type') || '').includes('json')) {
      state.staticMode = false;
      return await res.json();
    }
  } catch (e) { /* no server -> static demo mode */ }
  state.staticMode = true;
  const res = await fetch('data.json');
  const data = await res.json();
  return { ...data, products: [...data.products, ...localProducts()] };
}

async function addProduct(payload) {
  if (!state.staticMode) {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const out = await res.json();
    if (!res.ok) throw new Error((out.errors || ['Lỗi không xác định']).join(', '));
    return out.product;
  }
  const price = Number(payload.price);
  const watt = Number(payload.watt);
  if (!payload.brand || !payload.name || !payload.type || !Number.isFinite(watt) || !Number.isFinite(price) || price < 10000) {
    throw new Error('Vui lòng nhập đủ thương hiệu, loại đèn, tên, công suất và giá hợp lệ');
  }
  const today = new Date().toISOString().slice(0, 10);
  const product = {
    id: 'local-' + Date.now().toString(36),
    brand: payload.brand, name: payload.name.trim(), type: payload.type, watt,
    url: (payload.url || '').trim(), estimated: false, addedDate: today,
    priceHistory: [{ date: today, price, source: 'nhập tay (trình duyệt này)' }],
  };
  saveLocalProducts([...localProducts(), product]);
  return product;
}

async function removeProduct(id) {
  if (!state.staticMode) {
    const res = await fetch(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return res.ok;
  }
  saveLocalProducts(localProducts().filter((p) => p.id !== id));
  return true;
}

/* ===== Formatting helpers ===== */

function seriesColor(brand) {
  const idx = BRANDS.indexOf(brand);
  const varName = SERIES_VARS[idx] || '--muted';
  return getComputedStyle($('.viz-root')).getPropertyValue(varName).trim();
}

function fmtVnd(n) {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('vi-VN') + 'đ';
}
function fmtShort(n) {
  if (n >= 1e6) return (n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + 'tr';
  return (n / 1e3).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + 'k';
}
function fmtDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}`;
}
function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function typeShort(type) {
  return type === 'NLMT' ? 'NLMT' : 'điện lưới';
}

/* ===== Data helpers ===== */

function filteredProducts() {
  return state.data.products.filter((p) =>
    (state.type === 'all' || p.type === state.type) &&
    (state.watt === 'all' || String(p.watt) === state.watt));
}

function historyInPeriod(product) {
  const from = isoDaysAgo(state.periodDays);
  return product.priceHistory.filter((h) => h.date >= from);
}

function latestPrice(product) {
  const h = product.priceHistory;
  return h.length ? h[h.length - 1].price : NaN;
}

function periodStats(product) {
  const h = historyInPeriod(product);
  if (!h.length) return null;
  const first = h[0].price;
  const last = h[h.length - 1].price;
  const prices = h.map((x) => x.price);
  return {
    first, last,
    deltaAbs: last - first,
    deltaPct: first ? ((last - first) / first) * 100 : 0,
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}

/** Brand average price per date over the visible period. */
function brandSeries() {
  const from = isoDaysAgo(state.periodDays);
  const products = filteredProducts();
  const byBrand = new Map();
  for (const brand of BRANDS) {
    const brandProducts = products.filter((p) => p.brand === brand);
    if (!brandProducts.length) continue;
    const dateMap = new Map();
    for (const p of brandProducts) {
      for (const h of p.priceHistory) {
        if (h.date < from) continue;
        if (!dateMap.has(h.date)) dateMap.set(h.date, []);
        dateMap.get(h.date).push(h.price);
      }
    }
    const points = [...dateMap.entries()]
      .map(([date, arr]) => ({ date, price: arr.reduce((a, b) => a + b, 0) / arr.length }))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (points.length) byBrand.set(brand, points);
  }
  return byBrand;
}

/* ===== KPI tiles ===== */

function renderKpis() {
  const products = filteredProducts();
  const rd = products.filter((p) => p.brand === HOME_BRAND);
  const rivals = products.filter((p) => p.brand !== HOME_BRAND);
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN);
  const rdAvg = avg(rd.map(latestPrice));
  const rivalAvg = avg(rivals.map(latestPrice));
  const gapPct = Number.isFinite(rdAvg) && Number.isFinite(rivalAvg) && rivalAvg
    ? ((rdAvg - rivalAvg) / rivalAvg) * 100 : NaN;

  let biggestMove = null;
  for (const p of products) {
    const s = periodStats(p);
    if (!s) continue;
    if (!biggestMove || Math.abs(s.deltaPct) > Math.abs(biggestMove.deltaPct)) {
      biggestMove = { product: p, deltaPct: s.deltaPct };
    }
  }

  const segLabel = [
    state.type === 'all' ? null : (state.type === 'NLMT' ? 'đèn NLMT' : 'đèn điện lưới'),
    state.watt === 'all' ? null : `${state.watt}W`,
  ].filter(Boolean).join(' · ') || 'mọi loại & công suất';

  const tiles = [
    {
      label: 'Sản phẩm đang theo dõi',
      value: String(products.length),
      sub: `${rd.length} Rạng Đông · ${rivals.length} đối thủ`,
    },
    {
      label: 'Giá TB Rạng Đông',
      value: fmtVnd(Math.round(rdAvg || 0)),
      sub: segLabel,
    },
    {
      label: 'Chênh lệch với TB đối thủ',
      value: Number.isFinite(gapPct)
        ? `<span class="${gapPct >= 0 ? 'up' : 'down'}">${gapPct >= 0 ? '+' : ''}${gapPct.toFixed(1)}%</span>`
        : '—',
      sub: `TB đối thủ ${fmtVnd(Math.round(rivalAvg || 0))}`,
    },
    {
      label: `Biến động lớn nhất ${state.periodDays} ngày`,
      value: biggestMove
        ? `<span class="${biggestMove.deltaPct >= 0 ? 'up' : 'down'}">${biggestMove.deltaPct >= 0 ? '+' : ''}${biggestMove.deltaPct.toFixed(1)}%</span>`
        : '—',
      sub: biggestMove ? `${biggestMove.product.brand} · ${biggestMove.product.name}` : 'chưa đủ dữ liệu',
    },
  ];

  $('#kpi-row').innerHTML = tiles.map((t) => `
    <div class="kpi">
      <div class="kpi-label">${t.label}</div>
      <div class="kpi-value">${t.value}</div>
      <div class="kpi-sub">${t.sub}</div>
    </div>`).join('');
}

/* ===== Chart (hand-rolled SVG line chart) ===== */

const chart = { pad: { top: 16, right: 18, bottom: 28, left: 56 }, points: [] };

function renderChart() {
  const svg = $('#price-chart');
  const wrap = $('#chart-wrap');
  const W = wrap.clientWidth || 900;
  const H = 340;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const { pad } = chart;
  const iw = W - pad.left - pad.right;
  const ih = H - pad.top - pad.bottom;

  const series = brandSeries();
  const allDates = [...new Set([...series.values()].flat().map((p) => p.date))].sort();
  const allPrices = [...series.values()].flat().map((p) => p.price);
  if (!allDates.length) { svg.innerHTML = ''; $('#chart-legend').innerHTML = ''; return; }

  const minP = Math.min(...allPrices), maxP = Math.max(...allPrices);
  const yPad = (maxP - minP) * 0.12 || maxP * 0.05;
  const y0 = Math.max(0, minP - yPad), y1 = maxP + yPad;
  const x = (date) => pad.left + (allDates.indexOf(date) / Math.max(1, allDates.length - 1)) * iw;
  const y = (price) => pad.top + ih - ((price - y0) / (y1 - y0)) * ih;

  let el = '';
  for (let i = 0; i <= 4; i++) {
    const val = y0 + ((y1 - y0) * i) / 4;
    const yy = y(val);
    el += `<line class="gridline" x1="${pad.left}" y1="${yy}" x2="${W - pad.right}" y2="${yy}"/>`;
    el += `<text x="${pad.left - 8}" y="${yy + 4}" text-anchor="end">${fmtShort(val)}</text>`;
  }
  const step = Math.max(1, Math.round(allDates.length / 6));
  allDates.forEach((d, i) => {
    if (i % step !== 0 && i !== allDates.length - 1) return;
    el += `<text x="${x(d)}" y="${H - 8}" text-anchor="middle">${fmtDate(d)}</text>`;
  });
  el += `<line class="axisline" x1="${pad.left}" y1="${pad.top + ih}" x2="${W - pad.right}" y2="${pad.top + ih}"/>`;

  chart.points = [];
  for (const brand of BRANDS) {
    const pts = series.get(brand);
    if (!pts) continue;
    const color = seriesColor(brand);
    const dAttr = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.price).toFixed(1)}`).join('');
    el += `<path d="${dAttr}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
    pts.forEach((p) => chart.points.push({ brand, ...p, px: x(p.date), py: y(p.price) }));
  }
  el += `<line id="crosshair" class="crosshair" y1="${pad.top}" y2="${pad.top + ih}" x1="-10" x2="-10"/>`;
  svg.innerHTML = el;

  chart.dates = allDates;
  chart.x = x; chart.W = W; chart.H = H;

  $('#chart-legend').innerHTML = BRANDS.filter((b) => series.has(b)).map((b) =>
    `<span class="chip"><span class="swatch" style="background:${seriesColor(b)}"></span>${b}</span>`).join('');
}

function bindChartHover() {
  const wrap = $('#chart-wrap');
  const tip = $('#chart-tooltip');
  wrap.addEventListener('mousemove', (ev) => {
    if (!chart.dates || !chart.dates.length) return;
    const rect = wrap.getBoundingClientRect();
    const mx = ((ev.clientX - rect.left) / rect.width) * chart.W;
    let nearest = chart.dates[0], best = Infinity;
    for (const d of chart.dates) {
      const dist = Math.abs(chart.x(d) - mx);
      if (dist < best) { best = dist; nearest = d; }
    }
    const rows = chart.points.filter((p) => p.date === nearest)
      .sort((a, b) => b.price - a.price);
    if (!rows.length) return;
    const ch = document.getElementById('crosshair');
    if (ch) { ch.setAttribute('x1', chart.x(nearest)); ch.setAttribute('x2', chart.x(nearest)); }
    tip.hidden = false;
    tip.innerHTML = `<div class="tt-date">${fmtDate(nearest)}</div>` + rows.map((r) =>
      `<div class="tt-row"><span class="name"><span class="swatch" style="background:${seriesColor(r.brand)}"></span>${r.brand}</span><span class="val">${fmtVnd(Math.round(r.price))}</span></div>`).join('');
    const tipX = Math.min(rect.width - 180, Math.max(6, (chart.x(nearest) / chart.W) * rect.width + 12));
    tip.style.left = tipX + 'px';
    tip.style.top = '14px';
  });
  wrap.addEventListener('mouseleave', () => {
    tip.hidden = true;
    const ch = document.getElementById('crosshair');
    if (ch) { ch.setAttribute('x1', -10); ch.setAttribute('x2', -10); }
  });
}

/* ===== Table ===== */

function renderTable() {
  const tbody = $('#compare-table tbody');
  const products = [...filteredProducts()].sort((a, b) =>
    BRANDS.indexOf(a.brand) - BRANDS.indexOf(b.brand) ||
    a.type.localeCompare(b.type) || a.watt - b.watt);
  $('#table-period-label').textContent = `(${state.periodDays} ngày)`;

  tbody.innerHTML = products.map((p) => {
    const s = periodStats(p);
    const cur = latestPrice(p);
    const dir = !s || Math.abs(s.deltaPct) < 0.05 ? 'flat' : s.deltaPct > 0 ? 'up' : 'down';
    const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '·';
    const delta = s ? `${arrow} ${s.deltaPct >= 0 ? '+' : ''}${s.deltaPct.toFixed(1)}%` : '—';
    const canDelete = !state.staticMode || p.id.startsWith('local-');
    return `<tr class="brand-row">
      <td><div class="prod-cell">
        <span class="swatch" style="background:${seriesColor(p.brand)}"></span>
        <span class="prod-name">${p.brand}${p.estimated ? '<span class="est-tag">ước tính</span>' : ''}
          <span class="sub">${p.name} · ${p.watt}W · ${typeShort(p.type)}</span></span>
      </div></td>
      <td class="num">${fmtVnd(cur)}</td>
      <td class="num">${s ? fmtVnd(s.first) : '—'}</td>
      <td class="num"><span class="delta ${dir}">${delta}</span></td>
      <td class="num">${s ? `${fmtShort(s.min)} – ${fmtShort(s.max)}` : '—'}</td>
      <td>${canDelete ? `<button class="del-btn" data-id="${p.id}" title="Ngừng theo dõi" aria-label="Ngừng theo dõi ${p.name}">✕</button>` : ''}</td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.del-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Ngừng theo dõi sản phẩm này?')) return;
      if (await removeProduct(btn.dataset.id)) await reload();
    });
  });
}

/* ===== Recommendations ===== */

function renderRecommendations() {
  const items = [];
  const products = filteredProducts();
  const rd = products.filter((p) => p.brand === HOME_BRAND);
  const rivals = products.filter((p) => p.brand !== HOME_BRAND);

  // 1. Rivals with sharp price drops in period
  for (const p of rivals) {
    const s = periodStats(p);
    if (s && s.deltaPct <= -5) {
      items.push({
        level: 'critical',
        head: `⚠ ${p.brand} giảm giá mạnh`,
        body: `${p.name} (${typeShort(p.type)}) giảm ${Math.abs(s.deltaPct).toFixed(1)}% trong ${state.periodDays} ngày (${fmtVnd(s.first)} → ${fmtVnd(s.last)}). Cân nhắc đối ứng ở phân khúc ${p.watt}W, nhất là với các gói thầu đang chào giá.`,
      });
    }
  }

  // 2. Positioning per (type, wattage) segment
  const segments = [...new Set(products.map((p) => `${p.type}|${p.watt}`))];
  for (const seg of segments) {
    const [type, wattStr] = seg.split('|');
    const w = Number(wattStr);
    const inSeg = (p) => p.type === type && p.watt === w;
    const rdSeg = rd.filter(inSeg).map(latestPrice);
    const rivalSeg = rivals.filter(inSeg).map(latestPrice);
    if (!rdSeg.length || !rivalSeg.length) continue;
    const rdAvg = rdSeg.reduce((a, b) => a + b, 0) / rdSeg.length;
    const rivalAvg = rivalSeg.reduce((a, b) => a + b, 0) / rivalSeg.length;
    const gap = ((rdAvg - rivalAvg) / rivalAvg) * 100;
    const cheapest = Math.min(...rivalSeg);
    const segName = `${w}W ${typeShort(type)}`;
    if (gap > 15) {
      items.push({
        level: 'warning',
        head: `Phân khúc ${segName}: Rạng Đông cao hơn TB đối thủ ${gap.toFixed(0)}%`,
        body: `Giá RD ${fmtVnd(Math.round(rdAvg))} so với TB đối thủ ${fmtVnd(Math.round(rivalAvg))} (rẻ nhất ${fmtVnd(cheapest)}). Với kênh dự án, cần nhấn mạnh hồ sơ chất lượng: chuẩn TCVN chiếu sáng đường, tuổi thọ, hiệu suất lm/W và bảo hành — hoặc cân nhắc phiên bản giá cạnh tranh cho gói thầu nhạy về giá.`,
      });
    } else if (gap < -5) {
      items.push({
        level: 'good',
        head: `Phân khúc ${segName}: Rạng Đông rẻ hơn TB đối thủ ${Math.abs(gap).toFixed(0)}%`,
        body: `Lợi thế giá là điểm mạnh khi chào thầu dự án chiếu sáng công cộng. Cân nhắc giữ giá và đẩy mạnh chứng minh tổng chi phí vòng đời (TCO) thấp hơn.`,
      });
    } else {
      items.push({
        level: 'good',
        head: `Phân khúc ${segName}: giá Rạng Đông sát mặt bằng (${gap >= 0 ? '+' : ''}${gap.toFixed(0)}%)`,
        body: `Cạnh tranh nên chuyển sang phi giá: độ phủ dịch vụ, tiến độ giao hàng dự án, chứng chỉ. Giá thấp nhất của đối thủ trong phân khúc: ${fmtVnd(cheapest)}.`,
      });
    }
  }

  // 3. Rivals raising price = opportunity
  for (const p of rivals) {
    const s = periodStats(p);
    if (s && s.deltaPct >= 5) {
      items.push({
        level: 'good',
        head: `↗ ${p.brand} tăng giá ${s.deltaPct.toFixed(1)}%`,
        body: `${p.name} (${typeShort(p.type)}) tăng từ ${fmtVnd(s.first)} lên ${fmtVnd(s.last)}. Cơ hội cạnh tranh giá ở phân khúc ${p.watt}W nếu Rạng Đông giữ giá ổn định.`,
      });
    }
  }

  if (!items.length) {
    items.push({ level: 'good', head: 'Thị trường ổn định', body: `Không có biến động giá đáng kể trong ${state.periodDays} ngày qua. Duy trì theo dõi hằng ngày.` });
  }

  $('#reco-list').innerHTML = items.slice(0, 6).map((it) =>
    `<li class="${it.level}"><div class="reco-head">${it.head}</div>${it.body}</li>`).join('');
}

/* ===== Form & filters ===== */

function bindControls() {
  $('#type-select').addEventListener('change', (e) => {
    state.type = e.target.value;
    refreshWattOptions();
    renderAll();
  });
  $('#period-select').addEventListener('change', (e) => {
    const v = e.target.value;
    $('#custom-period-wrap').hidden = v !== 'custom';
    state.periodDays = v === 'custom' ? Number($('#custom-period').value) || 30 : Number(v);
    renderAll();
  });
  $('#custom-period').addEventListener('change', (e) => {
    const n = Math.min(365, Math.max(2, Number(e.target.value) || 30));
    e.target.value = n;
    state.periodDays = n;
    renderAll();
  });
  $('#watt-select').addEventListener('change', (e) => {
    state.watt = e.target.value;
    renderAll();
  });

  $('#add-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const form = ev.target;
    const msg = $('#form-msg');
    const payload = Object.fromEntries(new FormData(form).entries());
    msg.className = 'form-msg';
    msg.textContent = 'Đang lưu…';
    try {
      const product = await addProduct(payload);
      msg.className = 'form-msg ok';
      msg.textContent = state.staticMode
        ? `Đã thêm "${product.name}" (chỉ lưu trên trình duyệt này — bản demo).`
        : `Đã thêm "${product.name}" — bắt đầu theo dõi từ hôm nay.`;
      form.reset();
      await reload();
    } catch (err) {
      msg.className = 'form-msg err';
      msg.textContent = err.message;
    }
  });

  window.addEventListener('resize', () => renderChart());
}

/* ===== Watt options: rebuilt from data, respecting the type filter ===== */
function refreshWattOptions() {
  const sel = $('#watt-select');
  const current = sel.value;
  const pool = state.data.products.filter((p) => state.type === 'all' || p.type === state.type);
  const watts = [...new Set(pool.map((p) => p.watt))].sort((a, b) => a - b);
  sel.innerHTML = '<option value="all">Tất cả công suất</option>' +
    watts.map((w) => `<option value="${w}">${w}W</option>`).join('');
  sel.value = [...sel.options].some((o) => o.value === current) ? current : 'all';
  state.watt = sel.value;
}

/* ===== Boot ===== */

function renderAll() {
  renderKpis();
  renderChart();
  renderTable();
  renderRecommendations();
}

async function reload() {
  state.data = await fetchDataset();
  $('#last-updated').textContent = `Cập nhật: ${state.data.meta.lastUpdated}`;
  const notes = [];
  if (state.data.products.some((p) => p.priceHistory.some((h) => h.simulated))) {
    notes.push('Lịch sử trước 09/07 là dữ liệu mô phỏng minh hoạ');
  }
  if (state.staticMode) {
    notes.push('Bản demo tĩnh — sản phẩm thêm mới chỉ lưu trên trình duyệt này');
  }
  $('#demo-note').textContent = notes.join(' · ');
  refreshWattOptions();
  renderAll();
}

reload().then(() => {
  bindControls();
  bindChartHover();
});
