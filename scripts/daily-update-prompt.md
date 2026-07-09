# Quy trình cập nhật giá hằng ngày — Price Tracker đèn đường Rạng Đông

Prompt này dành cho phiên Claude chạy theo lịch (scheduled task). Thực hiện tuần tự:

## 1. Đọc danh sách sản phẩm đang theo dõi

Đọc `C:\Users\ADMIN\.claude\rangdong-streetlight-tracker\data\prices.json` — mỗi phần tử
trong `products` có `id`, `brand`, `name`, `type` (LED điện lưới / NLMT), `watt`, `url`.

## 2. Thu thập giá mới nhất

Với từng sản phẩm, dùng WebSearch/WebFetch tìm giá bán lẻ công khai hiện tại
(ưu tiên đúng `url` nguồn; nếu không có giá thì tìm "`giá <tên sản phẩm> <thương hiệu>`").
Quy tắc:
- Chỉ lấy giá niêm yết công khai, bỏ qua giá sau đăng nhập/giá đại lý/giá thầu.
- Nếu không tìm được giá mới → giữ nguyên, KHÔNG bịa giá; ghi chú "không có dữ liệu mới".
- Giá lệch quá ±30% so với điểm gần nhất → nghi ngờ sai, kiểm tra lại nguồn thứ hai.
- Chú ý phân biệt giá sau chiết khấu và giá niêm yết (Duhal thường chiết khấu 40–50%).

## 3. Ghi vào kho dữ liệu

Nếu server đang chạy (http://localhost:3211): POST `/api/prices` với body:
```json
{ "updates": [ { "productId": "<id>", "price": 4530000, "source": "<domain nguồn>" } ] }
```
Nếu server không chạy: sửa trực tiếp `data/prices.json` — thêm điểm
`{ "date": "<hôm nay ISO>", "price": <giá>, "source": "<nguồn>" }` vào cuối
`priceHistory` của sản phẩm tương ứng (mỗi ngày tối đa 1 điểm, ghi đè nếu trùng ngày).

## 4. Đồng bộ Notion

Database: "Theo dõi giá đèn đường — Rạng Đông vs đối thủ" — data source ID cụ thể
được cấu hình trong scheduled task (không ghi trong repo công khai này;
người dùng khác thay bằng ID database của workspace mình).

Với mỗi giá thu được hôm nay, tạo 1 page mới (notion-create-pages, parent =
data_source_id) với các property: `Sản phẩm`, `Thương hiệu`, `Loại` (LED điện lưới/NLMT),
`Công suất (W)`, `Giá (đ)`, `date:Ngày:start` = hôm nay, `Nguồn`, `Ước tính`, `Ghi chú`.

## 5. Cập nhật bản demo GitHub Pages

Sau khi ghi dữ liệu mới:
1. Copy `data/prices.json` → `docs/data.json`
2. Trong thư mục repo, chạy: `git add data/prices.json docs/data.json`,
   `git commit -m "chore: cap nhat gia <ngày hôm nay>"`, `git push`

## 6. Cảnh báo (nếu có)

Nếu bất kỳ đối thủ nào biến động ≥5% so với 7 ngày trước, ghi 1 dòng tóm tắt
vào đầu báo cáo kết quả để người dùng thấy ngay.
