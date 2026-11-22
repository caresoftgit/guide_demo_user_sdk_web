# Xác thực Web bằng phiên doanh nghiệp và ticket PKCE

Áp dụng Web SDK **0.5.0** và gateway hỗ trợ Web với `auth_protocol=2`. Phần này bắt đầu khi backend doanh nghiệp đã xác thực người dùng và đã biết `user_id` Caresoft tương ứng. Việc tra cứu/tạo khách hàng dùng API Caresoft hiện có và được thực hiện phía server.

## Caresoft và doanh nghiệp chuẩn bị gì

| Nơi sử dụng | Thông tin |
|---|---|
| Website | HTTPS gateway URL, Account ID, App ID, đầu số được phép và exact origin website |
| Backend doanh nghiệp | Credential tích hợp có scope cấp ticket/thu hồi/đọc trạng thái, thời hạn và cách luân chuyển credential |
| Backend tra cứu khách hàng | Credential Customer REST riêng nếu cần tra cứu/tạo khách hàng |
| Ứng dụng doanh nghiệp | Phiên đăng nhập hiện có: cookie bảo mật hoặc bearer của chính ứng dụng |

Caresoft đăng ký origin, App và quyền gọi theo hợp đồng. Origin có dạng `https://app.example.com`, không có path hoặc dấu `/` cuối. Web không cần cấu hình FCM/APNs hoặc push token.

Browser không nhận credential Caresoft. `user_id` do backend lấy từ ánh xạ người dùng đã đăng nhập; không nhận ID khách hàng do browser gửi lên. Tài khoản, App, origin, đầu số và quyền truy cập khách hàng vẫn phải được kiểm tra độc lập ở server.

## Luồng hoàn chỉnh

```mermaid
sequenceDiagram
    participant Customer as Khach hang
    participant App as Web doanh nghiep
    participant Host as Backend doanh nghiep
    participant SDK as Voice SDK
    participant Gateway as Caresoft Gateway
    Customer->>App: Dang nhap ung dung
    App->>Host: Xac thuc theo co che san co
    Host-->>App: Phien ung dung hop le
    App->>SDK: prepareLogin()
    SDK-->>App: Preparation cong khai
    App->>Host: POST bootstrap voi phien ung dung
    Host->>Host: Lay user_id tu principal da xac thuc
    Host->>Gateway: Cap ticket bang credential server
    Gateway-->>Host: Ticket mot lan
    Host-->>App: Ticket va attempt_id
    App->>SDK: loginWithTicket()
    SDK->>Gateway: Doi ticket va verifier
    Gateway-->>SDK: Phien Voice protocol 2
    SDK->>Gateway: Readiness va kenh su kien
```

### 1. Đăng nhập ứng dụng

Doanh nghiệp giữ nguyên cơ chế đăng nhập/SSO và quản lý phiên của mình. SDK không nhận username/password doanh nghiệp, không cấp phiên doanh nghiệp và không quy định endpoint đăng nhập.

Với Web cùng origin, có thể dùng cookie phiên `HttpOnly`, `Secure`, `SameSite` phù hợp, kiểm tra Origin và CSRF cho thao tác thay đổi trạng thái. Nếu ứng dụng dùng bearer, dùng HTTP client đã xác thực của ứng dụng. Bearer này là phiên doanh nghiệp, không phải API token Caresoft.

### 2. SDK chuẩn bị PKCE

```ts
const preparation = await voice.prepareLogin();
```

SDK giữ verifier trong memory và trả `attemptId`, `installationId`, `platform`, `applicationId`, `pushEnvironment`, `codeChallenge`, `codeChallengeMethod`. Trên Web: `platform = web`, `applicationId = location.origin`, `pushEnvironment = default`, `codeChallengeMethod = S256`.

Preparation mới thay thế attempt đang chờ; không ngắt phiên/cuộc gọi hiện tại. Không lưu hoặc chuyển verifier cho backend doanh nghiệp.

### 3. Browser xin ticket từ backend của ứng dụng

`POST /api/voice/bootstrap` dưới đây là endpoint **do doanh nghiệp triển khai**, không phải dịch vụ đăng nhập mẫu hoặc endpoint gateway. Demo mặc định gọi cùng origin bằng cookie phiên sẵn có; có thể sửa adapter để dùng HTTP client bearer của ứng dụng.

```http
POST /api/voice/bootstrap
Content-Type: application/json
X-CSRF-Token: APPLICATION_CSRF_TOKEN
```

Cookie phiên được browser gửi theo cơ chế cùng origin. Với bearer, gửi `Authorization: Bearer APPLICATION_SESSION_BEARER` qua HTTP client của ứng dụng; bảo vệ CSRF vẫn cần nếu endpoint đồng thời chấp nhận cookie.

```json
{
  "attempt_id": "ATTEMPT_UUID",
  "installation_id": "INSTALLATION_UUID",
  "os": "web",
  "application_id": "https://app.example.com",
  "push_environment": "default",
  "code_challenge": "BASE64URL_SHA256_VERIFIER",
  "code_challenge_method": "S256"
}
```

Backend phải xác thực phiên, kiểm tra CSRF/Origin theo cơ chế được chọn, giới hạn tần suất và lấy `user_id` Caresoft từ principal server. Account/App, origin và `host_session_ref` lấy từ cấu hình/phiên phía server; không chấp nhận client override `user_id`, host session hoặc credential. Khi chưa xác thực hoặc chưa ánh xạ được khách hàng, không cấp ticket.

### 4. Backend doanh nghiệp gọi Caresoft

```http
POST https://GATEWAY_HOST/ACCOUNT_ID/api/v1/voice/session-tickets
Authorization: Bearer SERVER_INTEGRATION_CREDENTIAL
Content-Type: application/json
```

```json
{
  "app_id": "CARESOFT_APP_ID",
  "user_id": "CARESOFT_USER_ID_FROM_SERVER",
  "host_session_ref": "SERVER_HOST_SESSION_UUID",
  "host_session_expires_at": "HOST_SESSION_EXPIRY_ISO8601",
  "attempt_id": "ATTEMPT_UUID",
  "installation_id": "INSTALLATION_UUID",
  "os": "web",
  "application_id": "https://app.example.com",
  "push_environment": "default",
  "code_challenge": "BASE64URL_SHA256_VERIFIER",
  "code_challenge_method": "S256"
}
```

Các giá trị viết hoa là placeholder cần thay bằng dữ liệu thực; ID dạng số truyền bằng chuỗi. `host_session_ref` là UUID do backend quản lý, gắn với đúng phiên đăng nhập. Không forward header `Origin` của browser vào API cấp ticket server-to-server; backend phải tự kiểm tra origin trước đó.

Gateway xác thực credential theo Account/App/scope, quyền truy cập khách hàng, trạng thái App, origin và chính sách phiên. Response gateway bọc dữ liệu trong `data`. Backend lấy các trường cần thiết, trả browser response phẳng:

```json
{
  "attempt_id": "ATTEMPT_UUID",
  "login_ticket": "OPAQUE_ONE_USE_TICKET",
  "expires_at": "TICKET_EXPIRY_ISO8601"
}
```

Response xác thực cần `Cache-Control: no-store`. Không trả credential tích hợp, Customer REST token hoặc access/refresh token Voice từ endpoint này. Browser không tự chọn `user_id`.

### 5. SDK đổi ticket lấy phiên Voice

```ts
if (ticket.attempt_id !== preparation.attemptId) throw new Error('ATTEMPT_MISMATCH');
await voice.loginWithTicket(preparation.attemptId, ticket.login_ticket);
```

SDK gửi `login_ticket`, `attempt_id`, `installation_id`, `code_verifier` tới `POST /ACCOUNT_ID/api/v1/voice/sessions/exchange`. Gateway kiểm tra PKCE S256, ticket một lần, origin của browser và thời hạn, rồi SDK giữ access/refresh token. Ứng dụng đọc ID xác thực từ `sessionState`, không nhập ID vào form.

Khi exchange có kết quả không rõ do mất mạng, tạo preparation/ticket mới. Không retry ticket đã dùng hoặc fallback về API token. Mỗi attempt chỉ commit nếu còn thuộc thế hệ đăng nhập hiện tại.

### 6. Sẵn sàng, gọi và nhận

Từ click/tap của người dùng, gọi `prepareAudio()` rồi `checkReadiness()`. Chỉ bật gọi khi `readiness.canCall` và báo khả năng nhận bằng `canReceive`. SDK tự kết nối kênh sự kiện và đồng bộ trạng thái. Ứng dụng cấu hình đầu số được cấp, không truyền SIP URI/IP tổng đài. Xem [tích hợp UI](integration.md).

## Thời hạn, refresh và lưu phiên

| Dữ liệu | Cách xử lý |
|---|---|
| Preparation SDK | Tối đa 120 giây trong memory; verifier không được persist |
| Ticket gateway | Một lần, mặc định 60 giây và không vượt hạn phiên; dùng `expires_at` server trả |
| Access token Voice | Thông thường 15 phút; SDK tự refresh |
| Refresh/session | Hạn tuyệt đối do chính sách server và phiên doanh nghiệp giới hạn; rotation không kéo dài hạn này |
| Refresh bị mất response | SDK giữ UUID trước khi gửi và retry cùng UUID trong cửa sổ 30 giây; quá cửa sổ cần bootstrap lại |
| Phiên doanh nghiệp | Do doanh nghiệp quản lý; SDK không lưu/refresh phiên này |

SDK mặc định giữ token Voice trong memory. `sessionPersistence: 'tab'` cho phép sessionStorage và Web Locks; khởi tạo trang cần gọi `restoreSession()`, sau đó kiểm tra readiness. Trả `true` chỉ cho biết đã nạp được phiên, không bảo đảm server đã xác minh khi đang offline. Không dùng localStorage. JavaScript cùng origin có thể đọc token: cần bảo vệ XSS, CSP và dependency. Phiên ứng dụng và phiên Voice là hai loại độc lập.

Khi hết hạn tự nhiên, không tạo/nhận cuộc gọi mới. Cuộc gọi đang ACTIVE có thể kết thúc bằng capability giới hạn đúng cuộc gọi, gồm snapshot/hangup/media-token. Thu hồi rõ ràng/disable đóng media. Capability không phải bearer dùng chung. F5 không khôi phục nguyên kết nối WebRTC; SDK dọn cuộc gọi cũ trước khi cho gọi tiếp.

## Ngắt Voice và đăng xuất ứng dụng

**Ngắt Voice:** `await voice.logout()` dọn media/token local ngay rồi cố thu hồi phiên Voice hiện tại. Người dùng vẫn đăng nhập doanh nghiệp và có thể xin ticket mới. Đây là hành vi nút **Ngắt Voice** trong demo.

**Đăng xuất ứng dụng:** luôn thực hiện cả logout SDK và logout doanh nghiệp, kể cả một bước lỗi. Ứng dụng phải tuần tự hóa việc đổi tài khoản/đăng xuất để các thao tác gắn với đúng phiên cũ. Ví dụ với hàm logout đã có của ứng dụng:

```ts
const results = await Promise.allSettled([
  voice.logout(),
  logoutBusinessSession(), // HTTP client hiện có của doanh nghiệp
]);
// Kiểm tra từng result để hiển thị lỗi hoặc trạng thái thu hồi đang chờ.
```

Backend vô hiệu hóa phiên doanh nghiệp và ghi outbox thu hồi HOST trong cùng transaction bền vững; từ đó chặn bootstrap mới. Worker dùng credential server gọi:

```http
POST https://GATEWAY_HOST/ACCOUNT_ID/api/v1/voice/service/session-revocations
Authorization: Bearer SERVER_INTEGRATION_CREDENTIAL
X-Request-Id: STABLE_REVOCATION_UUID
Content-Type: application/json
```

```json
{"scope":"HOST","host_session_ref":"SERVER_HOST_SESSION_UUID"}
```

Giữ cùng request UUID và payload khi retry. Response gateway trong `data` có `revocation_id`, `authority_revoked_at`, `cleanup_status`; `pending` nghĩa cần tiếp tục theo dõi/dọn media, không phải hoàn tất toàn bộ cleanup. Dùng `GET /ACCOUNT_ID/api/v1/voice/service/session-revocations/REVOCATION_ID` bằng credential server và tiếp tục retry/poll theo chính sách backend tới khi xác nhận. Không triển khai outbox bằng bộ nhớ browser.

Logout local khi offline không thể bảo đảm server thu hồi ngay. Không tự khôi phục token local đã xóa. Khi đổi tài khoản, dọn Voice cũ và xử lý phiên doanh nghiệp cũ trước khi bootstrap người dùng mới.

## Bảo vệ đường truyền và lỗi tích hợp

Mọi API dùng HTTPS/TLS, media dùng WSS và WebRTC DTLS-SRTP. PKCE chứng minh sở hữu verifier, không phải mã hóa JSON hoặc chứng thực thiết bị. Không tắt kiểm tra chứng thư.

Gateway dùng Bearer và bỏ cookie khi gọi từ SDK. CORS phải exact origin; với API cookie cross-origin, cấu hình credentialed CORS/CSRF tại backend doanh nghiệp đúng nhu cầu, không wildcard. Thay đổi cross-origin cần điều chỉnh adapter, không chỉ đổi URL cấu hình.

Không đưa password, ticket, verifier, bearer, media token hay credential vào URL, log, analytics hoặc crash report. CDN/proxy không cache API xác thực và không buffer kênh sự kiện. Khi backend ứng dụng trả 401, yêu cầu người dùng đăng nhập lại ứng dụng bằng luồng sẵn có; SDK không mở form đăng nhập doanh nghiệp.
