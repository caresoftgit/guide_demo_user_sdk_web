# Demo và hướng dẫn Customer Voice Web

Bộ tích hợp **0.5.0** gồm SDK đóng gói, màn hình gọi mẫu và tài liệu dành cho ứng dụng doanh nghiệp. Gateway cần hỗ trợ Web và `auth_protocol=2`.

Khách hàng đăng nhập vào **ứng dụng doanh nghiệp** bằng cơ chế đang có. Demo chỉ kết nối Voice bằng ticket PKCE do backend doanh nghiệp cấp; không cung cấp màn hình hoặc backend đăng nhập doanh nghiệp.

1. [Tích hợp từng bước](docs/integration.md).
2. [Luồng xác thực, payload và trách nhiệm backend](docs/host-bootstrap.md).
3. [Chạy demo với ứng dụng của bạn](docs/demo.md).
4. [API SDK](docs/sdk-api.md), [trình duyệt](docs/compatibility.md) và [kiểm thử](docs/testing.md).

## Cài và chạy

Node 22.22+ hoặc Node 24 LTS:

```sh
npm ci
shasum -a 256 -c packages/SHA256SUMS
cp public/config.example.json public/config.local.json
npm run dev
```

Điền cấu hình công khai được Caresoft cấp. Phục vụ demo trong ứng dụng đã xác thực, có endpoint `/api/voice/bootstrap` cùng origin, hoặc điều chỉnh `demo/hostBackend.ts` để dùng HTTP client đã xác thực của ứng dụng. Vite chỉ phục vụ giao diện, không có backend xác thực/bootstrap đi kèm.

| Thành phần | Nội dung |
|---|---|
| `demo/main.ts` | Kết nối/ngắt Voice, readiness và UI gọi |
| `demo/hostBackend.ts` | Điểm nối tới API cấp ticket của doanh nghiệp |
| `public/config.example.json` | Gateway URL, Account/App ID, đầu số và tên hiển thị |
| `packages/` | SDK `.tgz` và SHA-256 |
| `docs/` | Hướng dẫn tích hợp và hợp đồng trao đổi |
| `test/` | API/media giả lập cho kiểm thử tự động |

`npm run dev:fixture` chỉ xem UI với dữ liệu giả lập, không cần tài khoản và không gọi tổng đài. Build production loại phần giả lập. Web nhận gọi khi tab còn hoạt động; chưa có Web Push.

Không đưa API token, integration credential, Customer REST token, tài khoản test hoặc mật khẩu vào cấu hình, source hay bundle. `config.local.json` công khai khi phục vụ website dù đã được Git ignore.

[Source SDK](https://github.com/caresoftgit/user_voice_sdk_web)
