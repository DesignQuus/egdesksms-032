import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { CSRF_COOKIE, LEGACY_JWT_COOKIE, SESSION_COOKIE } from '@/lib/security/core';
import { revokeSession } from '@/lib/security/session';

export const dynamic = 'force-dynamic';

/** 로그아웃: DB 세션을 지워 즉시 무효화하고 쿠키를 삭제한다. */
export async function POST() {
  const cookieStore = await cookies();
  await revokeSession(cookieStore.get(SESSION_COOKIE)?.value).catch(() => undefined);
  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(CSRF_COOKIE);
  response.cookies.delete(LEGACY_JWT_COOKIE);
  return response;
}
