import { CustomerVoice, VoiceError, type VoiceDependencies, type VoiceState } from '@caresoft/customer-voice-web';
import { installCustomerVoiceUi, voiceErrorMessage } from '@caresoft/customer-voice-web/ui';
import './style.css';
import { requestLoginTicket } from './hostBackend';
const app = document.getElementById('app')!;
app.innerHTML = `<main class="page"><div id="fixture-banner" class="banner" hidden>KIỂM THỬ GIẢ LẬP — không kết nối gateway hoặc gọi tổng đài.</div><header><div class="identity"><div class="logo">C</div><div><strong>Caresoft</strong><small>Customer Voice</small></div></div><span class="badge">DEMO WEB · 0.5.0</span></header><section class="intro"><div class="eyebrow">LUÔN SẴN SÀNG LẮNG NGHE</div><h1>Kết nối với đội ngũ<br>chăm sóc khách hàng</h1><p>Gọi trực tiếp từ ứng dụng và nhận hỗ trợ trong cùng một trải nghiệm.</p></section><section class="grid"><article class="card call-card"><div><div class="support-icon" aria-hidden="true">♬</div><h2 style="margin-top:20px">Chúng tôi có thể giúp gì cho bạn?</h2><p class="muted">Kết nối Voice và bật âm thanh để bắt đầu cuộc gọi với đội ngũ CSKH.</p></div><button class="call" id="call" disabled>☎ &nbsp; Gọi CSKH</button></article><article class="card"><h2>Kết nối của bạn</h2><div class="account"><span id="user" class="muted">Chưa kết nối Voice</span><button id="login">Kết nối Voice</button><button id="logout" hidden>Ngắt Voice</button></div><div class="status" role="status"><span id="dot" class="dot"></span><span id="status">Đang khởi tạo…</span></div><p id="reasons" class="muted"></p><div class="actions"><button id="prepare" disabled>Bật âm thanh</button><button id="notify" disabled>Bật thông báo</button><button id="resume" disabled>Kiểm tra lại</button></div><p class="muted">Giữ tab mở để nhận cuộc gọi. Trình duyệt điện thoại có thể tạm dừng tab chạy nền.</p><p id="reload-note" class="muted" hidden>Tải lại hoặc đóng trang sẽ kết thúc cuộc gọi. Phiên đăng nhập vẫn được giữ trong tab.</p><p id="error" class="error" role="alert"></p></article></section><section id="fixture" class="fixture" hidden><strong>Điều khiển kiểm thử</strong><div><button id="incoming">Cuộc gọi đến</button><button id="remote-end">Phía CSKH kết thúc</button><button id="reconnect">Mất media</button><button id="recovered">Phục hồi media</button><button id="revoke">Thu hồi phiên</button><button id="control-down">Mất kênh sự kiện</button><button id="control-up">Nối lại kênh sự kiện</button></div></section><footer><span>CARESOFT · CUSTOMER VOICE</span><span>Microphone chỉ dùng cho cuộc gọi.<br>Loa/tai nghe phụ thuộc khả năng trình duyệt và thiết bị.</span></footer></main><dialog id="logout-dialog"><h2>Ngắt kết nối Voice?</h2><p class="muted">Cuộc gọi hiện tại sẽ kết thúc và phiên Voice được xóa. Tài khoản ứng dụng vẫn đăng nhập.</p><div class="actions"><button id="cancel-logout">Hủy</button><button id="confirm-logout">Ngắt Voice</button></div></dialog>`;
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let client: CustomerVoice;
let calling = false;
let restoring = true;
let connecting = false;
let guardingNavigation = false;
const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
function guardNavigation(ongoing: boolean) {
  if (ongoing === guardingNavigation) return;
  guardingNavigation = ongoing;
  if (ongoing) window.addEventListener('beforeunload', beforeUnload); else window.removeEventListener('beforeunload', beforeUnload);
}
const error = (e: unknown) => { el('error').textContent = e instanceof VoiceError && e.code === 'HOST_LOGIN_REQUIRED' ? 'Đăng nhập ứng dụng doanh nghiệp trước khi kết nối Voice.' : voiceErrorMessage(e); };
const reasons: Record<string, string> = { LOGIN_REQUIRED: 'Kết nối Voice để sử dụng cuộc gọi.', AUDIO_GESTURE_REQUIRED: 'Bấm Bật âm thanh để cho phép trình duyệt phát tiếng.', MICROPHONE_PERMISSION_REQUIRED: 'Cần cho phép microphone.', SESSION_UNVERIFIED: 'Chưa xác minh được phiên. Kiểm tra mạng rồi thử lại.', VOICE_NOT_READY: 'Dịch vụ cuộc gọi chưa sẵn sàng.', CONTROL_DISCONNECTED: 'Đang kết nối lại kênh nhận cuộc gọi.', CALL_IN_PROGRESS: 'Bạn đang có một cuộc gọi.', NETWORK_UNAVAILABLE: 'Mất kết nối mạng. Đang chờ kết nối lại.', SESSION_RESTORING: 'Đang xác minh phiên và dọn cuộc gọi của trang trước.' };
async function start() {
  let deps: VoiceDependencies | undefined; let config: any; let fixture: any;
  if (import.meta.env.MODE === 'fixture') {
    fixture = (await import('../test/harness.js')).createFixture(); deps = fixture.dependencies;
    config = { backendUrl: 'https://fixture.example.invalid', accountId: '20', appId: 'web-fixture', businessNumber: '18001234', supportName: 'Chăm sóc khách hàng' };
    el('fixture-banner').hidden = false; el('fixture').hidden = false;
  } else {
    const response = await fetch('/config.local.json', { cache: 'no-store' }); if (!response.ok) throw new VoiceError('DEMO_CONFIGURATION_REQUIRED'); config = await response.json();
  }
  client = new CustomerVoice({ ...config, sessionPersistence: 'tab', applicationId: location.origin, allowLocalhost: location.hostname === 'localhost' || location.hostname === '127.0.0.1' }, deps);
  const ui = installCustomerVoiceUi(client, { supportName: config.supportName }); ui.view.addEventListener('voice-error', e => error(new VoiceError((e as CustomEvent).detail.code)));
  client.onEvent(e => { if (e.type === 'error' || e.type === 'login_required') error(new VoiceError(e.code ?? 'CALL_ERROR')); });
  const render = (state: VoiceState) => {
    const authenticated = state.sessionState.status === 'AUTHENTICATED';
    el('user').textContent = authenticated && state.sessionState.status === 'AUTHENTICATED' ? `Khách hàng ${state.sessionState.session.userId}` : 'Chưa kết nối Voice';
    el('login').hidden = authenticated; el<HTMLButtonElement>('login').disabled = restoring || connecting; el('logout').hidden = !authenticated; el<HTMLButtonElement>('logout').disabled = restoring;
    el<HTMLButtonElement>('prepare').disabled = restoring || !authenticated; el<HTMLButtonElement>('resume').disabled = restoring || !authenticated; el<HTMLButtonElement>('notify').disabled = restoring || !authenticated || !client.capabilities.notifications;
    el<HTMLButtonElement>('call').disabled = !state.readiness.canCall || calling;
    const reconnecting = Object.values(state.connectionStates).includes('RECONNECTING');
    el('status').textContent = restoring ? 'Đang kiểm tra phiên đăng nhập…'
      : !authenticated ? 'Chưa kết nối Voice'
      : navigator.onLine === false ? 'Mất kết nối mạng — đang chờ kết nối lại…'
      : reconnecting ? 'Đang kết nối lại cuộc gọi…'
      : !state.readiness.controlConnected ? 'Đang kết nối lại dịch vụ cuộc gọi…'
      : state.readiness.reasons.includes('SESSION_RESTORING') ? 'Đang xác minh lại phiên đăng nhập…'
      : state.readiness.canReceive ? 'Sẵn sàng gọi và nhận cuộc gọi' : 'Chưa sẵn sàng';
    el('dot').classList.toggle('ready', state.readiness.canReceive);
    el('reasons').textContent = state.readiness.reasons.map(r => reasons[r] ?? r).join(' ');
    const ongoing = calling || state.calls.some(c => client.isCallPresentable(c.callId)); guardNavigation(ongoing); el('reload-note').hidden = !ongoing;
  };
  client.subscribe(render);
  await client.restoreSession(); restoring = false; render(client.state);
  el('login').onclick = async () => {
    if (connecting) return;
    connecting = true; el('error').textContent = ''; render(client.state);
    try {
      const preparation = await client.prepareLogin();
      const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content;
      const ticket = await requestLoginTicket(preparation, fixture?.hostFetch ?? fetch, csrf);
      await client.loginWithTicket(preparation.attemptId, ticket.login_ticket);
      await client.checkReadiness();
    } catch (e) { error(e); }
    finally { connecting = false; render(client.state); }
  };
  el('prepare').onclick = () => { void client.prepareAudio().then(() => client.checkReadiness()).catch(error); };
  el('notify').onclick = () => { void client.requestNotificationPermission().catch(error); };
  el('resume').onclick = () => { void client.resume().catch(error); };
  el('call').onclick = async () => {
    if (calling) return; calling = true; render(client.state); el('error').textContent = '';
    try { await client.call(config.businessNumber); } catch (e) { error(e); } finally { calling = false; render(client.state); }
  };
  const logout = el<HTMLDialogElement>('logout-dialog'); el('logout').onclick = () => logout.showModal(); el('cancel-logout').onclick = () => logout.close();
  el('confirm-logout').onclick = () => { logout.close(); void client.logout().catch(error); };
  if (fixture) { el('incoming').onclick = fixture.incoming; el('remote-end').onclick = fixture.end; el('reconnect').onclick = fixture.reconnecting; el('recovered').onclick = fixture.recovered; el('revoke').onclick = fixture.revoke; el('control-down').onclick = fixture.controlDown; el('control-up').onclick = fixture.controlUp; }
}
void start().catch(e => { el('status').textContent = 'Chưa cấu hình demo'; el('reasons').textContent = 'Tạo public/config.local.json từ config.example.json rồi điền cấu hình ứng dụng của bạn.'; el<HTMLButtonElement>('login').disabled = true; error(e); });
