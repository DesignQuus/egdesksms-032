import { queryTable } from '@/lib/egdesk-db';
import { SESSION_COOKIE } from '@/lib/security/core';
import { findSession, revokeSession, type SessionRecord } from '@/lib/security/session';

/**
 * 인증 공통 모듈 (proxy, API 라우트, 서버 컴포넌트에서 공용 사용)
 *
 * 로그인 상태는 이지데스크 My DB 의 서버 세션(`crm_user_sessions`)으로 판단한다.
 * 쿠키에는 무작위 세션 토큰만 있고, 운영자 정보(이름·권한)는 요청마다 DB 에서 다시 읽는다.
 * 그래서 로그아웃·운영자 삭제·권한 변경이 즉시 반영된다. (예전 JWT 방식은 사용하지 않음)
 */

export { SESSION_COOKIE } from '@/lib/security/core';
export const INTERNAL_TOKEN_HEADER = 'x-internal-token';

export type AuthUser = {
  id: number | string;
  username: string;
  name: string;
  role: string;
};

export interface SessionUser {
  user: AuthUser;
  session: SessionRecord;
}

/** 세션 토큰 → 세션 + 운영자. 세션이 없거나 운영자가 삭제됐으면 null */
export async function getSessionUser(token: string | null | undefined): Promise<SessionUser | null> {
  const session = await findSession(token);
  if (!session) return null;
  const result = (await queryTable('crm_operators', { filters: { id: session.operatorId }, limit: 1 })) as {
    rows?: Array<Record<string, unknown>>;
  } | null;
  const row = result?.rows?.find((r) => String(r.id) === session.operatorId);
  if (!row) {
    await revokeSession(token).catch(() => undefined);
    return null;
  }
  return {
    session,
    user: {
      id: row.id as number | string,
      username: String(row.username ?? ''),
      name: String(row.name ?? ''),
      role: String(row.role ?? 'SUB_OPERATOR'),
    },
  };
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
  const found = await getSessionUser(cookieStore.get(SESSION_COOKIE)?.value).catch(() => null);
  return found?.user ?? null;
}

/** 위험 작업(DB 초기화 등) 허용 여부: 개발 모드 + ENABLE_DANGEROUS_ROUTES=true + 최고관리자 */
export async function canRunDangerousRoute(): Promise<boolean> {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.ENABLE_DANGEROUS_ROUTES !== 'true') return false;
  const user = await getCurrentUser();
  return user?.role === 'SUPER_ADMIN';
}
