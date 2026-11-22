# Demo và hướng dẫn Customer Voice Web

Xem [luồng đăng nhập doanh nghiệp và ticket PKCE](docs/host-bootstrap.md) trước khi tích hợp.

Phiên bản **0.5.0**, dùng SDK đóng gói trong `packages/`. Gateway yêu cầu **0.5.0** trở lên.
Không có thông tin server, tài khoản, token hoặc đầu số nội bộ cấu hình sẵn.

1. [Tích hợp từng bước](docs/integration.md): tạo App, cấp origin, thêm SDK, cấp phiên,
   quyền âm thanh, Gọi CSKH, nhận cuộc gọi và logout.
2. [Chạy demo](docs/demo.md): chọn kiểm thử giả lập UI hoặc kết nối gateway thật.
3. [API](docs/sdk-api.md) và [khả năng trình duyệt](docs/compatibility.md).
4. [Checklist kiểm thử](docs/testing.md).

Node 22.22+ hoặc Node 24 LTS. Dùng npm ci để cài đúng lockfile. Gói SDK chưa publish
npm registry; cài file tgz đi kèm. Web nhận gọi khi tab còn mở/nền; chưa có Web Push.

## Cấu trúc bộ bàn giao

| Thư mục | Nội dung |
|---|---|
| `demo/` | Màn hình khách hàng, login/logout và nút Gọi CSKH |
| `public/config.example.json` | Mẫu cấu hình, thay placeholder bằng thông tin được cấp |
| `packages/` | Gói SDK 0.5.0 và SHA256SUMS |
| `docs/` | Các bước tích hợp, chạy demo, API và kiểm thử |
| `test/` | Điều khiển giả lập và kiểm thử trình duyệt |

Bắt đầu theo [hướng dẫn tích hợp](docs/integration.md) hoặc [chạy demo](docs/demo.md).
Source SDK: [user_voice_sdk_web](https://github.com/caresoftgit/user_voice_sdk_web).
Cấu hình riêng đặt trong `public/config.local.json` trên máy chạy demo; file này
không nằm trong Git. Không điền account API token vào file cấu hình website.

Cấu hình thêm URL backend doanh nghiệp HTTPS (`enterpriseBackendUrl`; iOS: `VOICE_ENTERPRISE_BACKEND_URL`; Android: `demo_default_enterprise_backend`). Đăng nhập bằng tài khoản doanh nghiệp test, không nhập ID khách hàng hay API token. Xem `docs/host-bootstrap.md` và helper enterprise session trong source.
