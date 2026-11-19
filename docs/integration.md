# Tích hợp Customer Voice vào Web

## 1. Chuẩn bị

Nhận từ Caresoft: HTTPS gateway URL, Account ID, Caresoft App ID và đầu số CSKH được
cấp cho ứng dụng. Host phải xác thực đúng khách hàng và lấy user ID dạng số dương.
Không có getDestinations; ứng dụng tự cấu hình số, không truyền SIP URI/prefix/IP.

Production cần domain HTTPS cho Web, WSS media và origin được phép. Origin là
`scheme://host[:port]`, không path hoặc dấu `/` cuối, ví dụ `https://app.example.com`.

## 2. Tạo App trên Caresoft

1. Đăng nhập quản trị Caresoft đúng môi trường.
2. Vào **Admin Settings → Cơ bản → Voice SDK**; xin quyền quản trị nếu chưa thấy.
3. Tạo App, đặt tên, bật **Hoạt động**, lưu và sao chép **App ID** do Caresoft sinh.
4. Gửi các origin website thực tế cho đơn vị vận hành gateway để thêm vào
   `cors.allowed_origins` của backend. Ví dụ: `https://app.example.com`.
5. Có thể dùng cùng App ID với Android/iOS và nhiều origin được phép. Web không
   cần tạo cấu hình push, không cần Firebase/APNs/VAPID hoặc push token.

Account/App vẫn phải active và thuộc đúng account. CORS chỉ cho phép origin gọi
API, không thay thế việc xác thực. Không dùng wildcard; localhost và domain HTTPS
là các origin khác nhau, cần khai báo đầy đủ origin dùng ở từng môi trường.
Gateway 0.4.1 trở lên không còn yêu cầu dòng Web trong bảng cấu hình push.

## 3. Thêm SDK

Chép gói tgz từ `packages/` vào project host rồi cài:

```sh
npm install ./packages/caresoft-customer-voice-web-0.1.1.tgz
```

Dùng bundler hiện đại như Vite. Gói là ESM/TypeScript declarations, không phụ thuộc
React/Vue. Các framework có SSR chỉ tạo client và import UI trong lifecycle phía
browser. Node 22.22+ hoặc Node 24 LTS cho bộ công cụ build của bản này.

```ts
import { CustomerVoice } from '@caresoft/customer-voice-web';
import { installCustomerVoiceUi } from '@caresoft/customer-voice-web/ui';
const voice = new CustomerVoice({
  backendUrl: 'https://voice.example.com',
  accountId: 'ACCOUNT_ID',
  appId: 'CARESOFT_APP_ID',
  applicationId: location.origin,
});
const callUi = installCustomerVoiceUi(voice, { supportName: 'Chăm sóc khách hàng' });
```

Thay toàn bộ placeholder. Một instance cho ứng dụng trong tab, giữ qua các route.
Khi bỏ hoàn toàn host: `callUi.dispose(); voice.dispose()`. Logout SDK cùng logout
ứng dụng để thu hồi phiên, không chỉ đóng widget.

## 4. Cấp phiên từ luồng đăng nhập của host

Account API token xác thực tích hợp account, không chứng minh khách hàng cuối.
Trong production, giữ token này ở backend host. Backend phải xác thực user, kiểm
tra CSRF/quyền và tạo session gateway cho user đó; không tin user/account/App ID
được gửi tùy ý từ browser.

Ở browser sau khi host đã đăng nhập:

```ts
const metadata = voice.loginParameters(authenticatedCustomerId);
const response = await fetch('/api/my-account/voice-session', {
  method: 'POST', credentials: 'same-origin',
  headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
  body: JSON.stringify({ installationId: metadata.installation_id }),
});
if (!response.ok) throw new Error('Không cấp được phiên thoại');
await voice.adoptSession(await response.json());
```

`/api/my-account/voice-session` là route **do host triển khai**, không phải route
SDK/gateway có sẵn. Trình tự backend host:

1. Lấy user ID từ phiên đã xác thực, account/App ID/origin từ cấu hình tin cậy.
2. Validate installationId là UUID; dùng nó trong POST gateway
   `/{account_id}/api/v1/voice/sessions`, header Bearer account API token.
3. Body: account_id, app_id, application_id=origin cố định, user_id đã xác thực,
   installation_id, os=`web`, push_environment=`default`, sdk_version=`0.1.1`.
4. Trả riêng data session_tokens về browser qua HTTPS, header Cache-Control:no-store.
   Không trả account token, không log request/response credentials, không cache CDN.
5. Thực hiện logout gateway khi host logout; browser cũng gọi voice.logout().

SDK mặc định không persist phiên; host có thể cấp lại phiên từ backend đã xác thực.
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

```ts
const voice = new CustomerVoice({
  backendUrl: gatewayUrl, accountId, appId, applicationId: location.origin,
  sessionPersistence: 'tab',
});
const restored = await voice.restoreSession();
// Nếu false, nhận phiên từ host/adoptSession hoặc mở login demo.
// Nếu true nhưng readiness UNKNOWN, hiển thị đang xác minh/kết nối lại.
```


`voice.login(userId, accountApiToken)` có sẵn cho **form demo/manual test** như các
bản native. Không hardcode account token vào mã JS, env được nhúng bundle hoặc HTML.

## 5. Xin microphone và mở khóa âm thanh

Từ click/tap rõ ràng:

```ts
startAudioButton.onclick = async () => {
  try {
    await voice.prepareAudio();
    await voice.checkReadiness();
  } catch {
    // Hướng dẫn người dùng cấp quyền microphone/kiểm tra thiết bị.
  }
};
```

Không gọi tự động khi trang load. Trình duyệt có thể chặn autoplay; UI SDK có nút
Bật âm thanh nếu cần. Xin thông báo desktop bằng requestNotificationPermission()
từ click nếu muốn; quyền này tùy chọn, không thay Web Push và không bảo đảm đánh
thức browser. Không xin camera vì bản này chỉ thoại.

## 6. Hiển thị readiness và nút Gọi CSKH

```ts
const unsubscribe = voice.subscribe(state => {
  callButton.disabled = !state.readiness.canCall;
  // Hiển thị isLoggedIn, canReceive và reasons cho phiên hiện tại.
});
callButton.onclick = async () => {
  const ready = await voice.checkReadiness();
  if (ready.canCall) await voice.call(assignedBusinessNumber);
};
```

Đầu số do host giữ, không cho người dùng chọn SIP peer. Chống bấm lặp trong lúc chờ
call(). Không tự gọi lại nếu timeout; SDK phát CALL_OUTCOME_UNKNOWN và đồng bộ
snapshot để tránh tạo call trùng.

VALID/isLoggedIn cần server xác minh gần đây; UNKNOWN khi offline không đồng nghĩa
logout. canReceive thêm kênh sự kiện còn kết nối, microphone/gesture và không bận.
Không yêu cầu đăng ký push token cho Web. `subscribe()` trả hàm dọn observer.

## 7. Nhận cuộc gọi và dùng UI có sẵn

Giữ tab và instance hoạt động. SDK dùng authenticated fetch SSE, header Bearer;
không dùng access token query string hoặc WebSocket header không được browser hỗ
trợ. SDK reconcile khi reconnect/foreground và theo chu kỳ.

UI SDK tự mở màn hình đến/đi/đàm thoại; answer/reject/hangup, mute/unmute, DTMF,
đầu ra theo capability và trạng thái Đang kết nối lại. Sau kết thúc hoặc local
hangup, dialog đóng về màn hình trước. Không cần xây dialer/màn hình trạng thái
agent. Trường hợp nhiều thiết bị, chỉ winner lấy media; máy còn lại dừng ringing.

Thời gian đàm thoại bắt đầu theo ACTIVE từ snapshot. IVR có thể đã answer trước
agent, nên đây không phải xác nhận riêng agent nhấc máy.

Sự cố media dùng ICE/reconnect cùng call, giữ mute, giới hạn 30 giây liên tục.
Không POST tạo call mới từ sự kiện reconnect. Chỉ mất kênh SSE thì không dừng audio
đang tốt. Mất media quá hạn thì dừng local và cố hangup, báo NETWORK_RECOVERY_TIMEOUT.

Khi tab bị đóng/freeze/OS kill, không bảo đảm nhận. Trình duyệt điện thoại cần
nghiệm thu thiết bị thật. Dùng cài đặt hệ thống nếu không hỗ trợ chọn loa/tai nghe;
không hiển thị nút Speaker giả. Xem [khả năng trình duyệt](compatibility.md).

## 8. Logout và kiểm thử

```ts
await voice.logout(); // local cleanup luôn xảy ra trước yêu cầu server
unsubscribe();        // khi host không còn cần observer này
```

Nếu thu hồi server thất bại, báo rõ và thử xử lý theo chính sách backend host;
không tự khôi phục phiên local đã xóa. Dùng [checklist](testing.md) trước phát hành.

## Cảnh báo rời trang khi đang gọi

Demo gắn beforeunload chỉ khi có call chưa kết thúc hoặc request tạo call đang chờ,
và gỡ khi hết call. Host có UI riêng dùng cờ request đang chờ kết hợp
`voice.calls.some(c => voice.isCallPresentable(c.callId))`. Handler gọi
`event.preventDefault(); event.returnValue = ''`. Browser quyết định hộp thoại và
nội dung; mobile/OS kill không bảo đảm cảnh báo. Không coi handler là khóa rời trang.
