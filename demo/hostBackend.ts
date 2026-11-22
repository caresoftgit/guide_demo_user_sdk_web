import { VoiceError, type LoginPreparation } from '@caresoft/customer-voice-web';

export interface LoginTicket { attempt_id: string; login_ticket: string; expires_at: string; }

/** Adapt this request to the application's existing authenticated HTTP client. */
export async function requestLoginTicket(
  preparation: LoginPreparation,
  transport: typeof fetch = fetch,
  csrfToken?: string,
): Promise<LoginTicket> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await transport('/api/voice/bootstrap', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) },
      signal: controller.signal,
      body: JSON.stringify({
        attempt_id: preparation.attemptId, installation_id: preparation.installationId,
        os: preparation.platform, application_id: preparation.applicationId,
        push_environment: preparation.pushEnvironment,
        code_challenge: preparation.codeChallenge, code_challenge_method: preparation.codeChallengeMethod,
      }),
    });
    if (response.status === 401) throw new VoiceError('HOST_LOGIN_REQUIRED', 401);
    if (!response.ok) throw new VoiceError('BOOTSTRAP_REQUEST_FAILED', response.status);
    let ticket: LoginTicket;
    try { ticket = await response.json(); } catch { throw new VoiceError('INVALID_BOOTSTRAP_RESPONSE'); }
    if (!ticket || ticket.attempt_id !== preparation.attemptId || typeof ticket.login_ticket !== 'string' ||
        !ticket.login_ticket || ticket.login_ticket.length > 256 || typeof ticket.expires_at !== 'string' ||
        !Number.isFinite(Date.parse(ticket.expires_at))) {
      throw new VoiceError('INVALID_BOOTSTRAP_RESPONSE');
    }
    return ticket;
  } catch (error) {
    if (error instanceof VoiceError) throw error;
    throw new VoiceError('BOOTSTRAP_REQUEST_FAILED');
  } finally { clearTimeout(timeout); }
}
