'use client';

/**
 * 화면의 모든 fetch 에 CSRF 토큰을 자동으로 붙인다.
 * 같은 사이트로 보내는 POST·PUT·PATCH·DELETE 요청에 sms_csrf 쿠키 값을 X-CSRF-Token 헤더로 넣는다.
 * (서버는 로그인 세션 요청에서 이 값이 세션의 토큰과 같은지 확인한다. src/proxy.ts 참고)
 * 각 화면의 fetch 호출을 하나하나 고치지 않기 위해 브라우저의 fetch 를 한 번 감싼다.
 */
const CSRF_COOKIE = 'sms_csrf';
const CSRF_HEADER = 'X-CSRF-Token';
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
const MARK = '__smsCsrfFetchInstalled';

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  for (const part of document.cookie.split(';')) {
    const c = part.trim();
    if (c.startsWith(prefix)) return decodeURIComponent(c.slice(prefix.length));
  }
  return null;
}

function install() {
  if (typeof window === 'undefined') return;
  const w = window as unknown as Record<string, unknown>;
  if (w[MARK]) return;
  w[MARK] = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const request = input instanceof Request ? input : null;
      const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
      const url = new URL(request ? request.url : String(input), window.location.href);
      const token = readCookie(CSRF_COOKIE);
      if (!SAFE.has(method) && url.origin === window.location.origin && token) {
        const headers = new Headers(init?.headers ?? request?.headers);
        if (!headers.has(CSRF_HEADER)) headers.set(CSRF_HEADER, token);
        return original(input, { ...init, headers });
      }
    } catch {
      // 판단할 수 없는 요청은 그대로 보낸다
    }
    return original(input, init);
  };
}

install();

export default function CsrfFetch() {
  return null;
}
