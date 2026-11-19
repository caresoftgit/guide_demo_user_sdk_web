# Trình duyệt và giới hạn

Mục tiêu: Chrome/Edge/Firefox/Safari bản hiện hành trên desktop; Chrome Android và
Safari iOS hiện hành trên điện thoại. Kiểm tra khả năng thực tế qua `capabilities`,
không giả định UA hoặc tên hãng bảo đảm một API có sẵn. WebView trong app cần host
bật WebRTC/microphone/autoplay; chưa nằm trong phạm vi nghiệm thu bản này.

| Tính năng | Điều kiện |
|---|---|
| Gọi/nhận khi tab mở | HTTPS, WebRTC, microphone, user gesture mở khóa tiếng, kết nối API/media |
| Tab nền | Best effort; browser/OS có thể giảm timer hoặc freeze tab, nhất là điện thoại |
| Tab đóng, browser bị kill, màn hình khóa | Không bảo đảm; không có Web Push/CallKit/Telecom trong bản này |
| Bật tiếng | Người dùng click/tap prepareAudio; UI có nút Bật âm thanh khi autoplay bị chặn |
| Chọn loa/tai nghe | Chỉ khi trình duyệt hỗ trợ setSinkId; tên/thiết bị do browser/OS quyết định |
| Safari/điện thoại không cho chọn đầu ra | Dùng cài đặt âm thanh hệ thống, không hiển thị nút Speaker giả |
| Thông báo desktop | Quyền Notification và tab còn chạy; hỗ trợ thực tế tùy browser |
| Thông báo trên điện thoại | Có thể cần service worker; không được tính là bảo đảm nhận gọi |
| Đổi Wi-Fi/di động | LiveKit ICE recovery trong cùng call, giới hạn mất media 30 giây |
| Reload/đóng tab | Media local ngắt; tùy chọn tab persistence giữ login qua F5 và xác minh server, không phục hồi media cũ |
| Cảnh báo F5/rời trang | beforeunload trong khi gọi, nội dung do browser quyết định; mobile/OS kill không bảo đảm hiện |
| Giữ phiên qua F5 | sessionPersistence:tab, sessionStorage + Web Locks; logout/thu hồi xóa phiên |

Cần secure context; loopback `http://localhost`/`http://127.0.0.1` chỉ dành phát triển.
HTTP trên IP LAN không đủ điều kiện micro trên điện thoại. Nếu nhúng iframe, host
phải cấp `allow="microphone; autoplay"` và Permissions-Policy phù hợp; kiểm tra
trên từng browser. CSP cần cho phép connect-src tới HTTPS gateway và WSS media,
media-src phù hợp audio; không mở wildcard toàn site nếu không cần.

Kiểm thử viewport/engine không thay cho điện thoại thật, mic/loa Bluetooth, âm thanh
hai chiều qua SIP hay đổi mạng vật lý. Xem báo cáo hiện tại của bộ demo.
