# Chạy demo Customer Voice Web

Demo thực hiện kết nối/ngắt Voice và gọi/nhận bằng SDK. Đăng nhập doanh nghiệp thuộc ứng dụng của bạn, theo [hợp đồng xác thực](host-bootstrap.md).

## Cài dependencies

Node 22.22+ hoặc Node 24 LTS:

```sh
npm ci
shasum -a 256 -c packages/SHA256SUMS
```

## Xem UI bằng dữ liệu giả lập

```sh
npm run dev:fixture -- --port 5188
```

Mở `http://127.0.0.1:5188`, có nhãn **KIỂM THỬ GIẢ LẬP**. Bấm **Kết nối Voice → Bật âm thanh → Gọi CSKH**. Không nhập tài khoản, mật khẩu, ID khách hàng hoặc API token. Nhóm điều khiển kiểm thử tạo inbound, remote end, reconnect và thu hồi phiên.

Chế độ này chỉ mô phỏng một ứng dụng đã xác thực và API/media để xem UI, không chạy backend đăng nhập, không gọi gateway/tổng đài hoặc capture microphone thật. Build production loại phần giả lập.

## Dùng với ứng dụng và gateway thật

1. Nhận cấu hình Caresoft và đăng ký exact origin của website; gateway phải hỗ trợ Web protocol 2.
2. Chép `public/config.example.json` thành `public/config.local.json`; điền gateway URL gốc, Account ID, App ID, đầu số và tên hiển thị. File này công khai khi website chạy, không đặt credential vào đây.
3. Đăng nhập người dùng bằng cơ chế sẵn có của ứng dụng doanh nghiệp. Backend đã ánh xạ principal sang `user_id` Caresoft.
4. Triển khai endpoint ticket của doanh nghiệp theo [payload bootstrap](host-bootstrap.md). Mẫu `demo/hostBackend.ts` gọi `POST /api/voice/bootstrap` **cùng origin**, dùng cookie phiên sẵn có và đọc CSRF token từ `<meta name="csrf-token" content="...">` nếu có. Backend phải kiểm tra phiên, Origin và CSRF theo chính sách ứng dụng; thẻ meta không tự tạo được quyền đăng nhập.
5. Nếu ứng dụng dùng bearer hoặc endpoint khác, sửa duy nhất adapter để dùng HTTP client đã xác thực của ứng dụng, giữ bảy trường preparation và response ticket. Không thay bằng credential Caresoft hoặc API đăng nhập mẫu.
6. Phục vụ demo cùng origin với ứng dụng/API hoặc dùng reverse proxy do doanh nghiệp quản lý. Khi phát triển, có thể cấu hình Vite proxy đến backend của **bạn**; không có backend hoặc proxy môi trường tích hợp sẵn trong repo.
7. Bấm **Kết nối Voice**, cấp microphone từ **Bật âm thanh**, kiểm tra readiness rồi gọi đầu số cấu hình. Nhận cuộc gọi trong khi tab hoạt động.

`npm run dev` chỉ chạy giao diện. Nếu chưa nối backend, kết nối Voice sẽ báo lỗi bootstrap/phiên ứng dụng; đây không phải bộ đăng nhập doanh nghiệp độc lập.

## Build website

```sh
npm run typecheck
npm run build
npm run preview -- --port 5188
```

Đưa nội dung `dist/` lên HTTPS hosting của ứng dụng và cấu hình endpoint bootstrap ở cùng origin. `config.local.json` bị Git ignore nhưng Vite vẫn chép vào build nếu tồn tại: kiểm tra file này trước khi chia sẻ source/build. Bộ bàn giao chỉ có `config.example.json` với placeholder.

Loopback HTTP chỉ dùng phát triển trên máy hiện tại. Điện thoại cần site HTTPS có chứng thư tin cậy và origin được cấp riêng. Không mở Vite dev server ra Internet.

## Thao tác

- **Kết nối Voice:** dùng phiên doanh nghiệp hiện tại xin ticket, không nhập danh tính thủ công.
- **Ngắt Voice:** xóa phiên và media Voice; không đăng xuất tài khoản ứng dụng. Đăng xuất toàn bộ ứng dụng phải thực hiện SDK logout và thu hồi HOST ở backend theo tài liệu.
- **F5:** SDK nạp lại phiên tab và xác minh; có thể cần bấm Bật âm thanh lại. Không phục hồi media của cuộc gọi cũ.
- **Mất SSE:** hiển thị nối lại dịch vụ, không cắt media còn tốt. Mất media liên tục quá 30 giây thì kết thúc local.
- **Đóng/freeze tab:** không bảo đảm nhận cuộc gọi; chưa có Web Push.

Dùng [checklist kiểm thử](testing.md) để nghiệm thu trên môi trường của bạn.
