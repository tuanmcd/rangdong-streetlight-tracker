# Rạng Đông — Theo dõi giá đèn đường LED

Ứng dụng theo dõi và so sánh giá đèn đường của Rạng Đông với 4 đối thủ:
**Điện Quang, HALEDCO, Philips, Duhal** — bao phủ cả hai dòng
**LED điện lưới** và **LED năng lượng mặt trời**, kèm khuyến nghị tự động và đồng bộ Notion.

## Chạy ứng dụng

```bash
node server.js
# mở http://localhost:3211
```

Không cần cài dependency (Node.js thuần).

## Tính năng

- **Form thêm sản phẩm theo dõi** — thương hiệu, loại đèn, tên, công suất, giá, link nguồn.
- **Bộ lọc loại đèn**: LED điện lưới / năng lượng mặt trời / cả hai.
- **Kỳ so sánh** — 30 / 60 / 90 ngày hoặc số ngày tùy chọn (2–365).
- **Lọc theo phân khúc công suất** (tự sinh theo loại đèn đang chọn).
- **Biểu đồ giá trung bình theo thương hiệu** với tooltip theo ngày.
- **Bảng so sánh biến động**: giá hiện tại, đầu kỳ, Δ%, min–max trong kỳ.
- **Khuyến nghị tự động cho Rạng Đông** theo từng phân khúc (loại đèn × công suất),
  định hướng kênh dự án/thầu chiếu sáng công cộng.
- **Đồng bộ Notion** (tùy chọn): mỗi điểm giá là 1 dòng trong database Notion riêng —
  xem `scripts/daily-update-prompt.md` để tự cấu hình với workspace của bạn.
- **Bản demo tĩnh** (`docs/`): chạy trên GitHub Pages không cần server —
  form thêm sản phẩm lưu trên trình duyệt người xem (localStorage).

## Cấu trúc

```
rangdong-streetlight-tracker/
├── server.js                     # Server Node thuần: UI + JSON API (port 3211)
├── public/                       # Dashboard (HTML/CSS/JS)
├── docs/                         # Bản demo tĩnh cho GitHub Pages
├── data/prices.json              # Kho dữ liệu giá
└── scripts/
    ├── seed-data.mjs             # Tạo dữ liệu ban đầu (khảo sát 09/07/2026)
    └── daily-update-prompt.md    # Quy trình phiên cập nhật hằng ngày
```

## API

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/data` | Toàn bộ dữ liệu |
| POST | `/api/products` | Thêm sản phẩm `{brand, type, name, watt, price, url?}` |
| POST | `/api/prices` | Ghi điểm giá `{updates:[{productId, price, source}]}` |
| DELETE | `/api/products/:id` | Ngừng theo dõi |

`type` nhận một trong hai giá trị: `"LED điện lưới"` hoặc `"NLMT"`.

## Ghi chú dữ liệu

- Giá ngày **09/07/2026** là giá thật khảo sát từ web bán lẻ công khai
  (rangdongs.com.vn, ledchinhhang.com, denled.com, ledduhal.net, denledduhal.com.vn, haledco.com).
- Lịch sử **trước 09/07/2026 là mô phỏng minh hoạ** (đánh dấu `simulated: true`) —
  sẽ được thay dần bằng dữ liệu thật khi cập nhật hằng ngày chạy.
- Sản phẩm gắn nhãn **"ước tính"**: hãng không niêm yết giá công khai (Điện Quang báo giá
  liên hệ; HALEDCO công bố khoảng giá; Duhal SDHQ100 lấy giá niêm yết trước chiết khấu).
- **Điện Quang và Philips chưa có sản phẩm đèn đường NLMT** trong dữ liệu do
  không tìm được giá công khai — bổ sung khi có nguồn.
