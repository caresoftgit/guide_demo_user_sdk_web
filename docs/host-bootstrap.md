# Đăng nhập bằng phiên doanh nghiệp và ticket PKCE

Áp dụng SDK **0.5.0**, gateway hỗ trợ `auth_protocol=2`. Backend doanh nghiệp đã có API tra cứu/tạo khách hàng Caresoft; phần tích hợp này bắt đầu khi backend đã có `user_id` của người dùng đang đăng nhập.

## Cấu hình và trách nhiệm

Caresoft cung cấp HTTPS gateway, Account ID, App ID, đầu số và cấu hình cho package/bundle/origin, push theo từng môi trường. Credential tích hợp và Customer REST token chỉ cấp qua kênh bảo mật cho **backend doanh nghiệp**. App nhận URL gateway, URL backend doanh nghiệp, Account ID, App ID và đầu số; đây là cấu hình công khai. Không nhúng secret trong app, remote config, JS bundle hoặc source.

Đăng nhập doanh nghiệp vẫn do ứng dụng sở hữu. Form demo chỉ nhập username/password của doanh nghiệp; không nhập `user_id` hoặc API token Caresoft. Production có thể dùng luồng SSO/phiên đang có thay form này.

## Trình tự giao tiếp

1. App đăng nhập backend doanh nghiệp qua HTTPS. Demo gọi `POST /api/auth/login` với `{username,password}`; nhận `{enterprise_access_token}` và giữ bearer trong memory. Endpoint này là hợp đồng ví dụ của host, không phải API gateway.
2. App gọi SDK `prepareLogin()`. SDK tạo verifier ngẫu nhiên 32 byte bằng CSPRNG, giữ trong memory và chỉ trả bảy trường công khai bên dưới.
3. App gửi `POST /api/voice/bootstrap` tới backend doanh nghiệp, `Authorization: Bearer <enterprise session>`, JSON:

```json
{
  "attempt_id": "UUID",
  "installation_id": "UUID",
  "os": "android|ios|web",
  "application_id": "package, bundle ID hoặc origin đã đăng ký",
  "push_environment": "default|sandbox|production",
  "code_challenge": "base64url(SHA256(verifier))",
  "code_challenge_method": "S256"
}
```

Backend xác thực phiên và lấy `user_id` từ principal server-side; không nhận override từ request. Account/App và application_id phải nằm trong allowlist cấu hình server. Nếu chưa có ID thì từ chối bootstrap; không cho client chọn khách hàng khác. Backend dùng credential tích hợp gọi API issue-ticket của gateway theo hợp đồng được Caresoft cấp, trả duy nhất:

```json
{"attempt_id":"UUID","login_ticket":"opaque-one-use-ticket","expires_at":"ISO-8601"}
```

4. App kiểm tra `attempt_id` khớp preparation, gọi `loginWithTicket(attemptId,ticket)`. SDK tự gửi ticket + attempt_id + installation_id + code_verifier tới `/sessions/exchange`; không chuyển verifier cho backend doanh nghiệp. Chỉ phiên còn đúng thế hệ đăng nhập mới được lưu. Không retry exchange mù hoặc fallback về `login(userId,apiToken)` khi lỗi; tạo preparation/ticket mới.
5. SDK quản lý access/refresh token, kiểm tra readiness và gọi `call(businessNumber)`. Nhận cuộc gọi qua cơ chế SDK hiện tại. `prepareLogin` không ngắt phiên hoặc cuộc gọi đang có.
6. Khi đăng xuất app, luôn gọi SDK `logout()` và backend doanh nghiệp `POST /api/auth/logout` với bearer doanh nghiệp, kể cả một bước lỗi. Backend phải vô hiệu hóa phiên host và thu hồi các phiên voice đã cấp; dùng outbox/retry bền vững nếu gateway offline. Helper demo có thể retry host logout trong memory; **không thay thế outbox production**. `LOGOUT_REVOKE_UNCONFIRMED` nghĩa local đã dọn nhưng server chưa xác nhận. App restart mất bearer demo thì phải đăng nhập doanh nghiệp lại để bootstrap mới khi cần.

## Hiệu lực và bảo vệ

Ticket gateway một lần, mặc định 60 giây; pending preparation SDK tối đa 120 giây. Access mặc định 15 phút. Refresh rotation không kéo dài hạn tuyệt đối `sessionExpiresAt` do server quyết định; không hardcode TTL ở host. Refresh single-flight, lưu request UUID trước khi gửi để retry cùng UUID trong 30 giây khi mất response, kể cả restart. Quá cửa sổ phải bootstrap lại. Native giữ credential trong Keychain/Keystore; bridge chỉ trả metadata. Web mặc định memory, tùy chọn sessionStorage theo tab và Web Locks; JavaScript vẫn đọc được token, cần CSP/XSS controls và dependency tin cậy.

Khi hết hạn tự nhiên, không tạo/nhận call mới. Call thuộc phiên đang ACTIVE có thể hoàn tất bằng capability giới hạn GET snapshot, POST hangup, POST media-token. Thu hồi rõ ràng/disable vẫn dọn media. Capability không thay bearer cho API khác.

Mọi bước dùng TLS/HTTPS, media WSS/DTLS-SRTP theo SDK; PKCE là chứng minh sở hữu verifier, không phải mã hóa payload hoặc attestation thiết bị. Không tắt kiểm tra chứng thư. Không log password/ticket/verifier/bearer/media token. Không đưa credential vào URL, analytics hoặc crash reports. Response xác thực phải `Cache-Control: no-store`; proxy/CDN không cache. Backend host dùng cookie phải có CSRF và SameSite phù hợp; Web cross-origin cần allowlist CORS chính xác ở cả host và gateway, không wildcard credentialed origin.

## Thử môi trường thật

Lấy tài khoản doanh nghiệp test từ người vận hành fixture qua kênh riêng. Không dùng credential Caresoft để điền vào form. Kiểm thử gọi ra/đến, push, nền, khóa màn hình và đổi tài khoản trên thiết bị thật từng platform; build/unit test không chứng minh các hành vi này. Fixture UI Web chỉ giả lập, có nhãn riêng và không gọi gateway/PBX.
