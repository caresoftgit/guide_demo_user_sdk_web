# Tích hợp Customer Voice vào Web

Luồng xác thực hiện tại: [phiên doanh nghiệp → ticket PKCE → SDK](host-bootstrap.md).

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
Gateway 0.5.0 trở lên không còn yêu cầu dòng Web trong bảng cấu hình push.

## 3. Thêm SDK

Chép gói tgz từ `packages/` vào project host rồi cài:

```sh
npm install ./packages/caresoft-customer-voice-web-0.5.0.tgz
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

Dùng [hợp đồng host bootstrap](host-bootstrap.md). Browser nhận ticket, không nhận credential tích hợp. Ví dụ sau khi host đã xác thực:

```ts
const preparation = await voice.prepareLogin();
const response = await fetch('/api/voice/bootstrap', {
  method: 'POST', credentials: 'same-origin',
  headers: {'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken},
  body: JSON.stringify({
    attempt_id: preparation.attemptId, installation_id: preparation.installationId,
    os: preparation.platform, application_id: preparation.applicationId,
    push_environment: preparation.pushEnvironment,
    code_challenge: preparation.codeChallenge,
    code_challenge_method: preparation.codeChallengeMethod,
  }),
});
if (!response.ok) throw new Error('BOOTSTRAP_FAILED');
const ticket = await response.json();
if (ticket.attempt_id !== preparation.attemptId) throw new Error('ATTEMPT_MISMATCH');
await voice.loginWithTicket(preparation.attemptId, ticket.login_ticket);
```

Backend đọc user_id từ phiên host, issue ticket bằng credential server. Không nhận user_id từ browser. Với bearer dùng Authorization thay cookie; không cần CSRF khi không có ambient cookie, nhưng vẫn cần CORS chính xác. Host API là do doanh nghiệp triển khai.

SDK mặc định giữ phiên memory. Demo bật `sessionPersistence: 'tab'`; gọi `await voice.restoreSession()` trước khi mở nút đăng nhập/gọi. SDK xác minh phiên và tự refresh; mạng lỗi giữ UNKNOWN, explicit revoke xóa phiên. Tab nhân bản không tiếp quản phiên cũ nhờ Web Locks. Reload dọn cuộc gọi cũ, không phục hồi media. sessionStorage vẫn đọc được bằng JavaScript cùng origin, cần CSP/XSS controls.

Logout gọi cả `voice.logout()` và API logout doanh nghiệp; xem helper `demo/enterpriseSession.ts`. Cookie host sau reload do hệ thống doanh nghiệp quản lý; demo bearer chỉ trong memory. Không dùng legacy login/adoptSession cho tích hợp mới.

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
