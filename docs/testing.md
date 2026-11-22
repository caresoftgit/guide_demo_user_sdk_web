# Kiểm thử và nghiệm thu

Luồng xác thực hiện tại: [phiên doanh nghiệp → ticket PKCE → SDK](host-bootstrap.md).

Checklist áp dụng cho Web SDK/demo **0.5.0**, gateway **0.5.0** trở lên.

## Kiểm thử tự động

| Phạm vi | Cách chạy | Điều được kiểm chứng |
|---|---|---|
| SDK | `npm test` trong repo SDK | Phiên/refresh, dữ liệu cũ, cleanup, mute capture, reconnect deadline |
| Gateway | `./scripts/test-local.sh` trong backend | MySQL/Redis tạm, Web không có cấu hình push, origin allowlist, SSE, presence và hồi quy mobile |
| Consumer | `npm run typecheck && npm run build` trong demo | API/declarations của gói tgz và build production |
| Giao diện | `npm test` trong demo | 12 kịch bản × 5 engine/viewport, dùng API/media giả lập |

Bộ browser dùng Chrome, Firefox, WebKit desktop và viewport Chrome/WebKit điện
thoại. Cần cài Chrome và Playwright Firefox/WebKit (`npx playwright install firefox
webkit`) trước khi chạy ở máy mới. Viewport mobile không phải thiết bị thật.

Các kịch bản: gọi/mute/unmute/DTMF/kết thúc; inbound reject/answer/remote end;
reconnect/giữ mute/timeout 30 giây; logout/login/token sai; thu hồi phiên; mất mạng/reconnect; F5 giữ phiên/logout; cảnh báo F5 khi gọi; tab nhân bản; mất SSE trong cuộc gọi.
Các test giả lập không xác nhận SIP routing hoặc chất lượng microphone/RTP.

## Checklist cuộc gọi thật trên từng thiết bị/browser

1. Origin được phép đăng nhập; origin khác, App ID khác và token sai bị từ chối.
2. Từ chối microphone thì canCall/canReceive false; cấp lại quyền và Bật âm thanh
   thì readiness cập nhật. Không xin camera.
3. Gọi CSKH đến đúng đầu số host cấu hình; kiểm tra IVR/agent và âm thanh hai chiều.
   Timer dựa trên ACTIVE của tổng đài; IVR tự trả lời có thể là mốc ACTIVE.
4. Tắt mic: agent không nghe; bật mic: nghe lại ngay. Lặp nhiều lần, thử loa/tai nghe
   và Bluetooth nếu có; xác minh đầu ra có thật trong browser hỗ trợ.
5. Gọi vào khi tab foreground và background. Hiện màn hình SDK, ringing, answer và
   reject. Nếu autoplay bị chặn, nút Bật âm thanh phục hồi tiếng.
6. Hai thiết bị cùng user: chỉ winner có media; bên còn lại dừng ringing, không
   can thiệp cuộc gọi của winner.
7. Đổi Wi-Fi/di động: cùng call, không dial lại; hiển thị reconnect, mute được giữ.
   Mất media liên tục quá 30 giây: dừng mic/màn hình, cố gửi hangup, không hồi sinh
   call khi mạng quay lại. SSE lỗi riêng không được cắt media vẫn đang tốt.
8. Kết thúc từ mỗi phía: dialog đóng, hết busy và về trang ban đầu. Bấm kết thúc
   trong lúc answer/join chậm vẫn dọn media ngay.
9. Logout khi rảnh/đang gọi rồi login user khác; không nhận sự kiện/token user cũ.
   Refresh sau 15 phút không tạo phiên/call trùng; phiên bị thu hồi yêu cầu login.
10. F5 khi gọi: cảnh báo, hủy giữ call; xác nhận dọn call cũ và giữ login đã xác minh. Logout rồi F5 không được hồi sinh phiên. Không phục hồi media cũ; gateway loại Web session khỏi nhận
    gọi khi stream đóng hoặc hết freshness. Không cam kết Web Push khi browser đóng.

Ghi browser/version, OS/thiết bị, thời điểm UTC, call ID và tình huống. Không ghi
account/access/refresh/media tokens vào báo cáo, ảnh hoặc log gửi hỗ trợ.

## Trạng thái bàn giao

Các lệnh trên kiểm tra hành vi tự động; lưu kết quả kiểm thử theo môi trường tích hợp của bạn.
Cuộc gọi SIP/WebRTC thật, âm thanh vật lý, Bluetooth và chuyển Wi-Fi/di động phải
được đánh dấu riêng sau khi test trên môi trường đã cấu hình Web.
