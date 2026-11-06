import { jwtVerify, type JWTPayload } from 'jose';

/**
 * 인증 공통 모듈 (proxy, API 라우트, 서버 컴포넌트에서 공용 사용)
 *
 * JWT 서명 키 우선순위
 * 1. JWT_SECRET 환경변수 (권장)
 * 2. EGDesk API 키에서 파생한 설치별 고유 키 (EGDesk 실행 환경 자동 대응)
 * 3. 개발 모드 전용 고정 키 (프로덕션에서는 사용 불가)
 */

export const AUTH_COOKIE = 'auth_token';
export const INTERNAL_TOKEN_HEADER = 'x-internal-token';

export type AuthUser = JWTPayload & {
  id?: number | string;
  username?: string;
  name?: string;
  role?: string;
};

let cachedSecret: Uint8Array | null = null;

export async function getJwtSecret(): Promise<Uint8Array> {
  if (cachedSecret) return cachedSecret;

  const explicit = process.env.JWT_SECRET;
  if (explicit && explicit.length >= 32) {
    cachedSecret = new TextEncoder().encode(explicit);
    return cachedSecret;
  }

  const apiKey = process.env.NEXT_PUBLIC_EGDESK_API_KEY;
  if (apiKey) {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`egdesk-jwt-v1:${apiKey}`)
    );
    cachedSecret = new Uint8Array(digest);
    return cachedSecret;
  }

  if (process.env.NODE_ENV !== 'production') {
    cachedSecret = new TextEncoder().encode('dev-only-insecure-jwt-secret-do-not-use-in-prod');
    return cachedSecret;
  }

  throw new Error('JWT_SECRET(32자 이상) 또는 NEXT_PUBLIC_EGDESK_API_KEY 환경변수가 필요합니다.');
}

/** 서명·만료를 검증한 뒤 payload 반환. 실패 시 null */
export async function verifyAuthToken(token: string | undefined | null): Promise<AuthUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await getJwtSecret(), { algorithms: ['HS256'] });
    return payload as AuthUser;
  } catch {
    return null;
  }
}

/** 서버 간 호출(RPA 데몬 등)용 내부 토큰 검증 */
export function isValidInternalToken(value: string | null | undefined): boolean {
  const expected = process.env.INTERNAL_API_TOKEN;
  if (!expected || expected.length < 16 || !value) return false;
  if (value.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < value.length; i++) diff |= value.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** 서버 컴포넌트 / 라우트 핸들러에서 현재 로그인 사용자 조회 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  return verifyAuthToken(cookieStore.get(AUTH_COOKIE)?.value);
}

/** 위험 작업(DB 초기화 등) 허용 여부: 개발 모드 + ENABLE_DANGEROUS_ROUTES=true + 최고관리자 */
export async function canRunDangerousRoute(): Promise<boolean> {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.ENABLE_DANGEROUS_ROUTES !== 'true') return false;
  const user = await getCurrentUser();
  return user?.role === 'SUPER_ADMIN';
}
