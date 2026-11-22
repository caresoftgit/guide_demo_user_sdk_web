# Chạy demo Web

Luồng xác thực hiện tại: [phiên doanh nghiệp → ticket PKCE → SDK](host-bootstrap.md).

## 1. Cài dependencies

Dùng Node 22.22+ hoặc Node 24 LTS và npm:

```sh
npm ci
```

Gói SDK đã đóng trong `packages/`; không cần npm registry riêng. Kiểm tra SHA-256
bằng `shasum -a 256 -c packages/SHA256SUMS` tại thư mục gốc demo.

## 2. Xem thử giao diện, không gọi thật

```sh
npm run dev:fixture -- --port 5188
```

Mở http://127.0.0.1:5188. Trang có nhãn vàng **KIỂM THỬ GIẢ LẬP**.
Bấm Đăng nhập, nhập user ID số dương bất kỳ, token test bất kỳ (trừ `wrong`),
bấm Bật âm thanh rồi Gọi CSKH. Dùng nhóm Điều khiển kiểm thử để tạo cuộc gọi đến,
kết thúc phía CSKH, mất/phục hồi media hoặc thu hồi phiên.

Chế độ này mô phỏng API/media; không gọi tổng đài, không capture microphone thật
và không kiểm chứng âm thanh hai chiều. `wrong` mô phỏng lỗi đăng nhập.

## 3. Kết nối gateway thật

1. Quản trị viên triển khai gateway 0.5.0 trở lên và thêm origin demo vào
   `cors.allowed_origins` của backend. Không tạo cấu hình push Web. Xem [tích hợp](integration.md).
2. Chép `public/config.example.json` thành `public/config.local.json`.
3. Điền backendUrl (HTTPS gateway gốc, không thêm đường dẫn account API), accountId,
   appId và businessNumber được cấp. Không thêm account API token vào file này.
4. Chạy `npm run dev -- --port 5188`, mở đúng origin đã đăng ký.
5. Đăng nhập bằng username/password doanh nghiệp test, sau đó bấm
   Bật âm thanh, cấp quyền microphone và kiểm tra trạng thái sẵn sàng.
6. Bấm Gọi CSKH để gọi số cấu hình. Gọi từ tổng đài về đúng user ID để thử nhận.
   Dùng tài khoản/thiết bị test riêng khi kiểm tra nhiều thiết bị.

Đây là form đăng nhập thủ công cho kiểm thử. Sản phẩm tích hợp nên cấp session qua
backend host đã xác thực theo bước 4 của tài liệu tích hợp, không phát account
token cho khách hàng cuối. Account API token không được ghi vào Web Storage. Demo bật lưu token phiên
trong sessionStorage để giữ đăng nhập qua F5, không lưu vào localStorage.

Loopback HTTP chỉ dùng trên máy tính đang chạy demo. Điện thoại cần site HTTPS
có chứng thư tin cậy và origin được cấp riêng; không dùng HTTP IP LAN để xin mic.
Không mở Vite dev server trực tiếp ra Internet. Dùng static build ở bước tiếp theo.

## 4. Build và phục vụ bản thật

```sh
npm run typecheck
npm run build
npm run preview -- --port 5188
```

Build mặc định loại module media giả lập. Đưa nội dung `dist/` lên static HTTPS
hosting, cấp config.local.json trên cùng site. Đây là cấu hình công khai của site,
không chứa credentials. File `public/config.local.json` bị Git ignore nhưng Vite
sẽ chép nó vào dist nếu tồn tại: kiểm tra nội dung trước khi bàn giao.

Proxy phải cho phép Authorization, SSE streaming không buffer/cache và kết nối
media WSS. Chỉ expose API công khai; không expose `/internal/*`. Điền cấu hình
riêng cho từng môi trường trước build/triển khai.

## 5. Thao tác khi test

- Đăng xuất: phiên và media local đóng ngay; có nút Đăng nhập lại.
- Đang gọi: tắt/bật mic, chọn đầu ra nếu browser hỗ trợ, gửi DTMF trong cuộc gọi.
- Kết thúc: màn hình gọi đóng về trang ban đầu.
- Mất media: hiển thị Đang kết nối lại, giữ mute; quá 30 giây thì kết thúc local.
- Mất mạng/kênh sự kiện: hiển thị đang nối lại; mất SSE riêng không cắt media đang tốt.
- F5 khi đang gọi: browser cảnh báo; ở lại giữ call, xác nhận tải lại dọn call cũ.
- F5 khi đăng nhập: tự xác minh/refresh phiên, không nhập account token lại khi phiên hợp lệ. Có thể cần Bật âm thanh lại.
- Logout xóa phiên trong tab; tab nhân bản đăng nhập riêng.
- Giữ tab mở/nền để nhận; OS freeze/đóng tab không được bảo đảm nhận.

Đối chiếu [checklist kiểm thử](testing.md) trước nghiệm thu.
