/**
 * 로그인 세션·CSRF 보안의 순수 로직 (DB·Next.js 에 의존하지 않아 단위 테스트한다).
 * inprint 저장소의 서버 세션 + CSRF 방식을 SMS 에 맞게 옮겼다.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 세션 쿠키(HttpOnly). 값은 무작위 토큰이고 DB 에는 해시만 저장한다. */
export const SESSION_COOKIE = 'sms_session';
/** CSRF 토큰 쿠키(화면 스크립트가 읽어 X-CSRF-Token 헤더로 보낸다). */
export const CSRF_COOKIE = 'sms_csrf';
export const CSRF_HEADER = 'x-csrf-token';
/** 예전 JWT 쿠키. 남아 있으면 지운다. */
export const LEGACY_JWT_COOKIE = 'auth_token';

/** 마지막 사용 후 이 시간이 지나면 만료 */
export const SESSION_IDLE_MS = 8 * 60 * 60 * 1000;
/** 로그인 후 활동과 관계없이 이 시간이 지나면 만료 */
export const SESSION_ABSOLUTE_MS = 24 * 60 * 60 * 1000;
/** 마지막 사용 시각은 이 간격보다 자주 기록하지 않는다(DB 쓰기 절약) */
export const SESSION_TOUCH_MS = 5 * 60 * 1000;

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function tokensEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function isSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method.toUpperCase());
}

/** 다음 만료 시각: 마지막 사용 + 유휴 시간, 단 로그인 후 최대 시간을 넘지 않는다. */
export function nextExpiry(now: number, createdAt: number): number {
  return Math.min(now + SESSION_IDLE_MS, createdAt + SESSION_ABSOLUTE_MS);
}

export function shouldTouch(lastSeenAt: number, now: number): boolean {
  return now - lastSeenAt >= SESSION_TOUCH_MS;
}

function originOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

export interface OriginInput {
  origin: string | null;
  referer: string | null;
  /** 요청이 들어온 주소(예: http://localhost:4004) */
  requestOrigin: string;
  /** 프록시·터널이 넘겨준 원래 호스트(X-Forwarded-Host)와 프로토콜 */
  forwardedHost?: string | null;
  forwardedProto?: string | null;
  /** 추가로 허용할 주소(터널 주소, APP_ORIGINS) */
  extraOrigins?: Array<string | null | undefined>;
}

/** 상태를 바꾸는 요청을 보낼 수 있는 출처 목록 */
export function allowedOrigins(input: OriginInput): Set<string> {
  const allowed = new Set<string>();
  const add = (value: string | null | undefined) => {
    const origin = originOf(value);
    if (origin) allowed.add(origin);
  };
  add(input.requestOrigin);
  if (input.forwardedHost) {
    for (const host of input.forwardedHost.split(',').map((h) => h.trim()).filter(Boolean)) {
      const proto = (input.forwardedProto ?? '').split(',')[0].trim() || new URL(input.requestOrigin).protocol.replace(':', '');
      add(`${proto}://${host}`);
    }
  }
  for (const extra of input.extraOrigins ?? []) {
    for (const part of (extra ?? '').split(',')) add(part.trim());
  }
  return allowed;
}

/**
 * CSRF 출처 검사. 브라우저가 Origin(없으면 Referer)을 보내면 허용 목록에 있어야 한다.
 * 둘 다 없는 요청(서버 간 호출 등)은 통과시키고, 로그인 세션 요청은 별도로 토큰을 검사한다.
 */
export function isOriginAllowed(input: OriginInput): boolean {
  let origin: string | null;
  if (input.origin !== null) {
    origin = input.origin === 'null' ? 'null' : originOf(input.origin) ?? 'invalid';
  } else {
    origin = originOf(input.referer);
  }
  if (origin === null) return true;
  return allowedOrigins(input).has(origin);
}

/** 로그인 실패 횟수 제한(프로세스 메모리, 단일 서버 전제) */
export class LoginRateLimiter {
  private failures = new Map<string, number[]>();
  private readonly maxFailures: number;
  private readonly windowMs: number;

  constructor(maxFailures = 5, windowMs = 15 * 60 * 1000) {
    this.maxFailures = maxFailures;
    this.windowMs = windowMs;
  }

  private recent(key: string, now: number): number[] {
    const list = (this.failures.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length) this.failures.set(key, list);
    else this.failures.delete(key);
    return list;
  }

  /** 막혀 있으면 남은 초, 아니면 0 */
  blockedFor(key: string, now = Date.now()): number {
    const list = this.recent(key, now);
    if (list.length < this.maxFailures) return 0;
    return Math.ceil((list[0] + this.windowMs - now) / 1000);
  }

  fail(key: string, now = Date.now()): void {
    const list = this.recent(key, now);
    list.push(now);
    this.failures.set(key, list);
  }

  succeed(key: string): void {
    this.failures.delete(key);
  }
}
