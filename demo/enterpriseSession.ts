import type { CustomerVoice } from '@caresoft/customer-voice-web';

type NativeSession = Pick<
  CustomerVoice,
  'prepareLogin' | 'loginWithTicket' | 'logout'
>;

function hostError(code: string) {
  return Object.assign(new Error(code), { code });
}

export function createEnterpriseSession(
  hostUrl: string,
  native: NativeSession,
  transport: typeof fetch = fetch,
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
) {
  let enterpriseToken: string | undefined;
  let pendingLogout = false;
  const storageKey = `caresoft.enterprise-session.v1:${hostUrl.replace(/\/$/, '')}`;
  const saved = storage?.getItem(storageKey);
  if (saved) {
    try {
      const value = JSON.parse(saved);
      if (typeof value.token !== 'string' || !/^[!-~]{1,4096}$/.test(value.token) || typeof value.pendingLogout !== 'boolean') throw new Error();
      enterpriseToken = value.token;
      pendingLogout = value.pendingLogout;
    } catch { storage?.removeItem(storageKey); }
  }
  const persist = () => {
    if (enterpriseToken) storage?.setItem(storageKey, JSON.stringify({ token: enterpriseToken, pendingLogout }));
    else storage?.removeItem(storageKey);
  };
  let epoch = 0;
  let loggingIn = false;
  const current = (value: number) => { if (value !== epoch) throw hostError('LOGIN_ATTEMPT_SUPERSEDED'); };

  async function request(route: string, body: object, bearer = enterpriseToken) {
    if (!/^https:\/\//.test(hostUrl)) {
      throw hostError('HTTPS_HOST_REQUIRED');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await transport(hostUrl.replace(/\/$/, '') + route, {
        method: 'POST',
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          ...(bearer
            ? { Authorization: `Bearer ${bearer}` }
            : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw hostError('ENTERPRISE_REQUEST_FAILED');
      }
      if (route === '/api/auth/logout') return {};
      return await response.json();
    } catch {
      throw hostError('ENTERPRISE_REQUEST_FAILED');
    } finally {
      clearTimeout(timeout);
    }
  }

  async function revoke(token: string | undefined) {
    if (!token) {
      return;
    }
    if (enterpriseToken === token) { pendingLogout = true; persist(); }
    try {
      await request('/api/auth/logout', {}, token);
      if (enterpriseToken === token) { enterpriseToken = undefined; pendingLogout = false; persist(); }
    } catch {
      throw hostError('HOST_LOGOUT_PENDING');
    }
  }

  const retryLogout = () => revoke(enterpriseToken);

  return {
    get pendingLogout() {
      return pendingLogout;
    },
    async login(username: string, password: string) {
      if (loggingIn) throw hostError('LOGIN_IN_PROGRESS');
      loggingIn = true;
      const version = ++epoch;
      try {
      if (enterpriseToken) {
        await retryLogout();
      }
      current(version);
      const authentication = await request('/api/auth/login', {
        username,
        password,
      });
      if (typeof authentication.enterprise_access_token !== 'string') {
        throw hostError('INVALID_ENTERPRISE_RESPONSE');
      }
      if (version !== epoch) {
        enterpriseToken = authentication.enterprise_access_token; persist();
        try { await retryLogout(); } catch {}
        current(version);
      }
      enterpriseToken = authentication.enterprise_access_token; pendingLogout = false; persist();
      const preparation = await native.prepareLogin();
      current(version);
      const ticket = await request('/api/voice/bootstrap', {
        attempt_id: preparation.attemptId,
        installation_id: preparation.installationId,
        os: preparation.platform,
        application_id: preparation.applicationId,
        push_environment: preparation.pushEnvironment,
        code_challenge: preparation.codeChallenge,
        code_challenge_method: preparation.codeChallengeMethod,
      });
      if (
        ticket.attempt_id !== preparation.attemptId ||
        typeof ticket.login_ticket !== 'string'
      ) {
        throw hostError('INVALID_ENTERPRISE_RESPONSE');
      }
      current(version);
      await native.loginWithTicket(preparation.attemptId, ticket.login_ticket);
      current(version);
      } finally { loggingIn = false; }
    },
    async logout() {
      const captured = enterpriseToken;
      ++epoch;
      let nativeFailure: unknown;
      try {
        await native.logout();
      } catch (error) {
        nativeFailure = error;
      }
      await revoke(captured);
      if (nativeFailure) {
        throw nativeFailure;
      }
    },
    retryLogout,
  };
}
