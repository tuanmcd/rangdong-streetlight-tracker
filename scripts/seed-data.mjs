/**
 * Seed data/prices.json with the street light products surveyed on 2026-07-09.
 *
 * Today's price point is REAL (collected from public retail listings).
 * History before today is SIMULATED (simulated: true) so the dashboard has a
 * 30-day curve to demonstrate — real points replace it as the daily updater runs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'prices.json');
const TODAY = '2026-07-09';
const HISTORY_DAYS = 30;

const GRID = 'LED điện lưới';
const SOLAR = 'NLMT';

// [id, brand, name, type, watt, price-today, source, url, estimated, volatility]
const SEED = [
  // ===== LED điện lưới =====
  ['rd-csd06-100', 'Rạng Đông', 'CSD06 100W', GRID, 100, 4530000,
    'rangdongs.com.vn', 'https://rangdongs.com.vn/danh-muc/den-duong-led-rang-dong/', false, 0.015],
  ['rd-csd06-150', 'Rạng Đông', 'CSD06 150W', GRID, 150, 5032000,
    'rangdongs.com.vn', 'https://rangdongs.com.vn/danh-muc/den-duong-led-rang-dong/', false, 0.015],
  ['dq-alley2-100', 'Điện Quang', 'ALLEY 2 100W', GRID, 100, 3800000,
    'ước tính (hãng báo giá liên hệ)', 'https://dienquang.com/products/den-duong-led-alley-2-100dl-v02-100w', true, 0.02],
  ['dq-alley3-150', 'Điện Quang', 'ALLEY 3 150W', GRID, 150, 4800000,
    'ước tính (hãng báo giá liên hệ)', 'https://dienquang.com/products/den-duong-led-alley-2-100dl-v02-100w', true, 0.02],
  ['hl-street-100', 'HALEDCO', 'Đèn đường LED 100W', GRID, 100, 2500000,
    'haledco.com (khoảng giá)', 'https://haledco.com/den-led/den-duong-led/100w', true, 0.03],
  ['hl-street-150', 'HALEDCO', 'Đèn đường LED 150W', GRID, 150, 3500000,
    'haledco.com (khoảng 2,5–8tr)', 'https://haledco.com/den-led/den-duong-led/150w', true, 0.03],
  ['ph-brp121-100', 'Philips', 'BRP121 LED130 100W', GRID, 100, 5500000,
    'ước tính (khoảng giá thị trường)', 'https://philipsvietnam.com/den-duong-led', true, 0.02],
  ['ph-brp132-140', 'Philips', 'BRP132 LED175 140W', GRID, 140, 6860000,
    'denled.com', 'https://denled.com/den-duong-led/den-duong-led-philips-brp132-140w', false, 0.02],
  ['dh-sdhq100', 'Duhal', 'SDHQ100 100W', GRID, 100, 3950000,
    'ước tính (niêm yết 7,89tr trước CK)', 'https://duhalled.com/collections/den-duong-led-duhal', true, 0.035],
  ['dh-sdhq150', 'Duhal', 'SDHQ150 150W', GRID, 150, 2309000,
    'ledduhal.net', 'https://ledduhal.net/san-pham/den-duong-led-150w-sdhq150/', false, 0.035],

  // ===== Đèn đường năng lượng mặt trời =====
  ['rd-csd05sl-100', 'Rạng Đông', 'CSD05.SL.RF.V3 100W', SOLAR, 100, 1650000,
    'ledchinhhang.com', 'https://ledchinhhang.com/den-nang-luong-mat-troi-rang-dong-chinh-hang-bang-gia-2026', false, 0.015],
  ['rd-csd05sl-200', 'Rạng Đông', 'CSD05.SL.RF.V3 200W', SOLAR, 200, 1960000,
    'ledchinhhang.com', 'https://ledchinhhang.com/den-nang-luong-mat-troi-rang-dong-chinh-hang-bang-gia-2026', false, 0.015],
  ['hl-nlmt-100', 'HALEDCO', 'Đèn đường NLMT 100W', SOLAR, 100, 1500000,
    'haledco.com (từ 680k)', 'https://haledco.com/den-led/nang-luong-mat-troi/100w-hlmt', true, 0.03],
  ['hl-nlmt-200', 'HALEDCO', 'Đèn đường NLMT 200W', SOLAR, 200, 2400000,
    'haledco.com (khoảng 1,1–3,7tr)', 'https://haledco.com/den-led/nang-luong-mat-troi/200w-hlmt', true, 0.03],
  ['dh-dhl1001-100', 'Duhal', 'DHL1001 NLMT 100W', SOLAR, 100, 3705000,
    'denledduhal.com.vn', 'https://denledduhal.com.vn/bang-gia-den-led-duhal-chinh-hang-nam-2025/', false, 0.035],
  ['dh-dhl1501-150', 'Duhal', 'DHL1501 NLMT 150W', SOLAR, 150, 4518000,
    'denledduhal.com.vn', 'https://denledduhal.com.vn/bang-gia-den-led-duhal-chinh-hang-nam-2025/', false, 0.035],
];

function isoDaysAgo(base, days) {
  const d = new Date(base + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Deterministic pseudo-random walk so re-seeding gives the same curve. */
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildHistory(priceToday, source, volatility, seedNum) {
  const rand = mulberry32(seedNum);
  const points = [];
  let price = priceToday;
  for (let day = 1; day <= HISTORY_DAYS; day++) {
    const drift = (rand() - 0.48) * volatility * priceToday;
    price = Math.round((price + drift) / 10000) * 10000;
    points.unshift({ date: isoDaysAgo(TODAY, day), price, simulated: true });
  }
  points.push({ date: TODAY, price: priceToday, source });
  return points;
}

const products = SEED.map((row, i) => {
  const [id, brand, name, type, watt, price, source, url, estimated, volatility] = row;
  return {
    id, brand, name, type, watt, url, estimated,
    addedDate: isoDaysAgo(TODAY, HISTORY_DAYS),
    priceHistory: buildHistory(price, source, volatility, i + 13),
  };
});

const data = {
  meta: {
    lastUpdated: TODAY,
    currency: 'VND',
    note: 'Giá ngày 2026-07-09 thu thập thật từ web công khai. Lịch sử trước đó là mô phỏng minh hoạ (simulated: true), sẽ được thay bằng dữ liệu thật khi cập nhật hằng ngày. Điện Quang/Philips chưa có dữ liệu đèn đường NLMT công khai.',
  },
  products,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(data, null, 2), 'utf8');
console.log(`Seeded ${products.length} products -> ${OUT}`);
