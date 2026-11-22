# API Web 0.5.0

Tất cả network/media action trả Promise; bắt `VoiceError.code/status`. Không log
request body, headers hoặc credentials khi báo lỗi. Core không tự tạo UI đăng nhập.

```ts
import { CustomerVoice } from '@caresoft/customer-voice-web';
import { installCustomerVoiceUi } from '@caresoft/customer-voice-web/ui';
const voice = new CustomerVoice({
  backendUrl: 'https://voice.example.com', accountId: 'ACCOUNT_ID',
  appId: 'CARESOFT_APP_ID', applicationId: location.origin,
});
const callUi = installCustomerVoiceUi(voice, { supportName: 'Chăm sóc khách hàng' });
```

`accountId` là chuỗi số dương, `applicationId` là origin Web đã được Caresoft cho
phép (không path/trailing slash). Production bắt buộc HTTPS/WSS; `allowLocalhost`
chỉ cho HTTP/WS loopback khi phát triển. Một instance cho một ứng dụng trong tab.

| API | Công dụng |
|---|---|
| `prepareLogin()` | Tạo attempt và PKCE S256; chỉ trả bảy trường công khai |
| `loginWithTicket(attemptId, ticket)` | Đổi ticket một lần; verifier chỉ ở SDK |
| `loginParameters(userId)` | Legacy compatibility, không dùng cho tích hợp mới |
| `restoreSession()` | Nạp phiên tab đã lưu, xác minh/refresh lại; false nếu không có phiên hoặc bị server từ chối |
| `adoptSession(tokens)` | Legacy advanced compatibility; tích hợp mới dùng ticket PKCE |
| `login(userId, accountApiToken)` | Deprecated/demo-only compatibility; demo hiện tại dùng ticket PKCE |
| `logout()` | Dọn local ngay, cố thu hồi đúng phiên cũ; lỗi server không khôi phục local |
| `prepareAudio()` | Gọi từ click/tap: xin quyền micro và mở khóa phát âm thanh |
| `checkReadiness()` | Xác minh session hiện tại và trả khả năng gọi/nhận |
| `resume()` | Đồng bộ snapshot khi app về foreground; SDK cũng quan sát pageshow/visibility/online |
| `call(businessNumber)` | Gọi đầu số host cấu hình, chuỗi 1–32 chữ số, tùy chọn `+` |
| `answer(callId)` / `reject(callId)` | Trả lời/từ chối inbound còn hiệu lực trên thiết bị |
| `hangup(callId)` | Dừng mic/UI local trước khi chờ HTTP |
| `setMuted(callId, value)` | Ý định mute mới nhất, đồng bộ capture và publication |
| `getAvailableAudioRoutes(callId)` | Đầu ra do trình duyệt cung cấp |
| `selectAudioRoute(callId, routeId)` | Chọn đầu ra; kiểm tra `capabilities.audioOutputSelection` |
| `sendDtmf(callId, digit)` | Gửi `0–9`, `*`, `#` qua LiveKit SIP DTMF |
| `resumeAudio(callId)` | Mở lại phát tiếng từ click nếu autoplay bị chặn |
| `requestNotificationPermission()` | Xin thông báo desktop từ thao tác người dùng, tùy chọn; không đăng ký Web Push |
| `isCallPresentable(callId)` | Có thể hiển thị/điều khiển call local hiện tại |
| `currentTime()` | Đồng hồ có hiệu chỉnh theo server sau khi có observation |
| `subscribe(listener)` | Nhận state hiện tại và thay đổi; trả hàm unsubscribe |
| `onEvent(listener)` | Nhận `VoiceEvent`; trả hàm unsubscribe |
| `dispose()` | Dọn tài nguyên instance local; dùng logout để thu hồi phiên phía server |

`SessionTokens` chứa `user_id`, `session_id`, `access_token`, `refresh_token`,
`expires_at`, `refresh_expires_at` từ response tạo phiên của gateway. Đây là dữ liệu
nhạy cảm. Không đưa account token vào cấu hình/constructor. SDK mặc định không persist phiên; host có thể cấp lại phiên từ backend đã xác thực.
Khi bật `sessionPersistence:"tab"`, SDK lưu access/refresh token và installation
trong sessionStorage theo gateway/account/App/origin. Gọi `await voice.restoreSession()`
khi khởi tạo trang; true nghĩa đã nạp phiên, kiểm tra readiness để biết đã xác minh
hay còn UNKNOWN. Không lưu account token/media token, không dùng localStorage.

Restore xác minh server và tự refresh access hết hạn. Lỗi mạng/503 giữ phiên UNKNOWN
để thử lại, logout/server thu hồi thì xóa. SDK dọn cuộc gọi cũ thuộc trang trước,
không phục hồi nguyên WebRTC qua reload. Sau F5 có thể cần bấm Bật âm thanh lại.
Web Locks ngăn tab nhân bản dùng chung refresh; tab mới phải login riêng. Không có
Web Locks/storage thì dùng memory và báo SESSION_PERSISTENCE_UNAVAILABLE.

JavaScript cùng origin đọc được sessionStorage: host phải bảo vệ khỏi XSS/CSP phù
hợp. Có BFF/phiên host sẵn thì ưu tiên cấp lại qua backend. Đóng tab không bảo đảm
giữ phiên; tính năng Restore tabs của browser có thể giữ storage, nhưng server
expiry/revocation luôn quyết định phiên còn hợp lệ hay không.

| State | Nội dung |
|---|---|
| `sessionState` | LOGGED_OUT / AUTHENTICATED(session info) / LOGIN_REQUIRED(reason) |
| `readiness` | sessionStatus LOGGED_OUT/VALID/UNKNOWN; isLoggedIn/canCall/canReceive/userId/reasons/checkedAt/controlConnected |
| `calls` | Snapshot có version; terminal/lost được giữ hữu hạn, local-stopped active bị ẩn |
| `connectionStates` | call ID → CONNECTING / CONNECTED / RECONNECTING của media |
| `audioStates` | call ID → muted/routes/playbackBlocked |
| `capabilities` | Microphone/secure context/output selection/notifications; webPush=false, backgroundReception=BEST_EFFORT |

`UNKNOWN` khi offline/không xác minh được phiên không tự logout. NETWORK_UNAVAILABLE chặn gọi mới khi browser offline; SESSION_RESTORING chặn gọi/nhận trong lúc dọn phiên vừa tải lại. Readiness có hạn 30 giây.
Nhận cuộc gọi cần phiên hợp lệ, dịch vụ voice, micro/gesture âm thanh, không bận và
kênh điều khiển đang kết nối. Không yêu cầu FCM/APNs/push token cho Web. Readiness
không chứng minh RTP tốt hoặc tab sẽ không bị hệ điều hành đóng băng.

Snapshot `ACTIVE` là authority về kết nối cuộc gọi từ tổng đài; không đếm thời gian
đàm thoại chỉ vì tạo call hoặc join media thành công. Đây không phải event riêng
báo agent nhấc máy nếu IVR đã tự answer. `isOwner` dành outbound; inbound dùng
`deviceStatus=winner`. Thiết bị thua không được lấy media hoặc gác máy thắng.

LiveKit thực hiện ICE/reconnect; SDK hiển thị RECONNECTING và giữ mute/cùng call.
Mất media liên tục 30 giây thì dừng local, phát NETWORK_RECOVERY_TIMEOUT, cố hangup;
callback muộn không mở lại call. Timer không kéo dài vì nhiều tín hiệu reconnect.
Ngắt riêng SSE không dừng cuộc gọi có audio còn hoạt động. Không tự retry `call()`
sau timeout vì có thể tạo cuộc gọi trùng; dùng snapshot để xác định kết quả.

UI: `installCustomerVoiceUi(client, {container?, supportName?})` trả `{view,dispose}`.
Custom element `caresoft-voice-call` có `bind(client,supportName?)`/`unbind()`, phát
`call-closed` và `voice-error` (detail chỉ có code). Gắn element vào DOM trước bind,
unbind khi bỏ màn hình. Entry UI chỉ import ở client, không chạy khi SSR.

Demo cảnh báo beforeunload khi có cuộc gọi/đang tạo call. Nội dung cảnh báo chuẩn do browser quyết định; chọn ở lại giữ call, xác nhận rời trang thì ngắt media. Mất SSE riêng hiển thị reconnect dịch vụ và không cắt media đang tốt.
