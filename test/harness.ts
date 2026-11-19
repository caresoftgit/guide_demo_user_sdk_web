import type { MediaCallbacks, VoiceMedia, VoiceDependencies } from '@caresoft/customer-voice-web';
/** Explicit fixture mode only. This module is removed from the production build. */
export function createFixture() {
  const saved = JSON.parse(sessionStorage.getItem('voice-fixture-server') ?? 'null');
  let call: any = saved?.call; let session: any = saved?.session; let id = call?.call_id ?? crypto.randomUUID(); let currentMedia: HarnessMedia | undefined;
  let controlAvailable = true;
  const streams = new Set<ReadableStreamDefaultController<Uint8Array>>();
  const send = (type: string, extra = {}) => { for (const stream of streams) { try { stream.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type, call_id: id, ...extra })}\n\n`)); } catch { streams.delete(stream); } } };
  const persist = () => { if (session) sessionStorage.setItem('voice-fixture-server', JSON.stringify({ session, call })); else sessionStorage.removeItem('voice-fixture-server'); };
  const json = (data: unknown, status = 200) => { persist(); return new Response(JSON.stringify({ data, server_time: new Date().toISOString() }), { status, headers: { 'Content-Type': 'application/json' } }); };
  const rawFetch = async (url: RequestInfo | URL, init: RequestInit = {}) => {
    const path = String(url).split('/api/v1/voice')[1];
    if (path === '/sessions') {
      if (init.headers && (init.headers as Record<string, string>).Authorization === 'Bearer wrong') return new Response('{"error":{"code":"UNAUTHORIZED"}}', { status: 401 });
      session = { user_id: JSON.parse(String(init.body)).user_id, session_id: crypto.randomUUID(), access_token: 'a'.repeat(43), refresh_token: 'r'.repeat(43), expires_at: new Date(Date.now() + 900000).toISOString(), refresh_expires_at: new Date(Date.now() + 86400000).toISOString() }; return json(session, 201);
    }
    if (path === '/sessions/current') { call = undefined; session = undefined; persist(); return new Response(null, { status: 204 }); }
    if (path === '/sessions/refresh') { if (!session) return new Response('{"error":{"code":"UNAUTHORIZED"}}', { status: 401 }); return json(session); }
    if (!session) return new Response('{"error":{"code":"UNAUTHORIZED"}}', { status: 401 });
    if (path === '/configuration') {
      const delay = saved?.session ? Number(new URLSearchParams(location.search).get('restoreDelay') ?? 0) : 0;
      if (delay > 0) await new Promise(resolve => setTimeout(resolve, Math.min(delay, 2000)));
      return json({ session_id: session.session_id, user_id: session.user_id, voice_ready: true, push_registered: false });
    }
    if (path === '/events/stream') { if (!controlAvailable) throw new TypeError('fixture control offline'); let controller: ReadableStreamDefaultController<Uint8Array>; const stream = new ReadableStream<Uint8Array>({ start(c) { controller = c; streams.add(c); c.enqueue(new TextEncoder().encode('data: {"type":"control.ready"}\n\n')); init.signal?.addEventListener('abort', () => { streams.delete(c); try { c.close(); } catch {} }); }, cancel() { streams.delete(controller); } }); return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }); }
    if (path === '/calls?filter=active') return json({ calls: call && call.state !== 'ENDED' ? [call] : [] });
    if (path === '/calls') { id = crypto.randomUUID(); call = { call_id: id, direction: 'OUTBOUND', state: 'CREATING', version: (call?.version ?? 0) + 1, is_owner: true, business_number: JSON.parse(String(init.body)).business_number, media_expires_at: new Date(Date.now() + 10000).toISOString() }; return json(call, 202); }
    if (path?.endsWith('/media-token')) return json({ url: 'wss://fixture.example.invalid', token: 'media-fixture', expires_at: new Date(Date.now() + 60000).toISOString(), participant_identity: 'fixture' });
    if (path?.endsWith('/answer')) { call = { ...call, state: 'CONNECTING', version: call.version + 1, device_status: 'winner' }; return json(call); }
    if (path?.endsWith('/hangup') || path?.endsWith('/reject')) { call = { ...call, state: 'ENDED', version: call.version + 1 }; return json(call); }
    if (path === `/calls/${id}`) return json(call);
    return json({}, 404);
  };
  // No real microphone capture or signaling occurs in fixture mode.
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => new MediaStream() } });
  class HarnessMedia implements VoiceMedia {
    muted = false; closed = false;
    constructor(readonly callbacks: MediaCallbacks) { currentMedia = this; }
    async connect() { call = { ...call, state: 'ACTIVE', version: call.version + 1 }; persist(); this.callbacks.connection('CONNECTED'); }
    async setMuted(muted: boolean) { this.muted = muted; }
    async resumeAudio() { this.callbacks.playback(false); }
    async routes() { return [{ id: 'default', name: 'Mặc định hệ thống', selected: true }]; }
    async selectRoute() {} async dtmf() {} close() { this.closed = true; }
  }
  const heartbeat = setInterval(() => send('control.heartbeat'), 5000); window.addEventListener('pagehide', () => clearInterval(heartbeat), { once: true });
  const dependencies: VoiceDependencies = { fetch: rawFetch as typeof fetch, mediaFactory: cb => new HarnessMedia(cb) };
  return { dependencies, controlDown() { controlAvailable = false; for (const stream of streams) { try { stream.close(); } catch {} } streams.clear(); }, controlUp() { controlAvailable = true; }, incoming() { id = crypto.randomUUID(); call = { call_id: id, direction: 'INBOUND', state: 'RINGING', version: (call?.version ?? 0) + 1, is_owner: false, device_status: 'pending', ringing_expires_at: new Date(Date.now() + 45000).toISOString(), business_number: '18001234' }; persist(); send('call.ringing'); }, end() { if (call) { call = { ...call, state: 'ENDED', version: call.version + 1 }; persist(); send('call.ended'); } }, reconnecting() { currentMedia?.callbacks.connection('RECONNECTING'); }, recovered() { currentMedia?.callbacks.connection('CONNECTED'); }, revoke() { session = undefined; persist(); send('session.revoked'); } };
}
