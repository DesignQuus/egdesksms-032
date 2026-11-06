import { NextResponse } from 'next/server';
import { queryTable } from '@/lib/egdesk-db';
import bcrypt from 'bcryptjs';
import {
  CSRF_COOKIE, LEGACY_JWT_COOKIE, LoginRateLimiter, SESSION_ABSOLUTE_MS, SESSION_COOKIE,
} from '@/lib/security/core';
import { cookieOptions, createSession, revokeSession } from '@/lib/security/session';

export const dynamic = 'force-dynamic';

/** 같은 접속지·아이디로 15분에 5번 실패하면 잠시 막는다(단일 서버 프로세스 기준). */
const limiter = new LoginRateLimiter();
/** 존재하지 않는 아이디도 같은 시간이 걸리도록 비교에 쓰는 해시 */
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

function clientKey(req: Request, username: string) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `${forwarded || req.headers.get('x-real-ip') || 'local'}|${username.toLowerCase()}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!username || !password) {
      return NextResponse.json({ success: false, error: '아이디와 비밀번호를 모두 입력해주세요.' }, { status: 400 });
    }

    const key = clientKey(req, username);
    const waitSeconds = limiter.blockedFor(key);
    if (waitSeconds > 0) {
      return NextResponse.json(
        { success: false, error: `로그인 시도가 너무 많습니다. ${Math.ceil(waitSeconds / 60)}분 뒤 다시 시도해주세요.` },
        { status: 429, headers: { 'Retry-After': String(waitSeconds) } },
      );
    }

    // 1. 운영자 조회 + 2. 비밀번호 검증 (없는 아이디도 같은 비교를 거쳐 응답 시간으로 구분되지 않게 한다)
    const result = (await queryTable('crm_operators', { filters: { username }, limit: 1 })) as {
      rows?: Array<Record<string, unknown>>;
    } | null;
    const user = result?.rows?.find((r) => r.username === username);
    const isValid = await bcrypt.compare(password, typeof user?.password_hash === 'string' ? user.password_hash : DUMMY_HASH);
    if (!user || !isValid) {
      limiter.fail(key);
      return NextResponse.json({ success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }
    limiter.succeed(key);

    // 3. 서버 세션 생성 (이전 세션 쿠키가 있으면 무효화: 세션 고정 공격 방지)
    const cookieHeader = req.headers.get('cookie') ?? '';
    const previous = cookieHeader.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
    if (previous) await revokeSession(decodeURIComponent(previous.slice(SESSION_COOKIE.length + 1))).catch(() => undefined);
    const session = await createSession(String(user.id), req.headers.get('user-agent'));

    // 4. 쿠키 설정: 세션 토큰(HttpOnly) + CSRF 토큰(화면 스크립트가 읽어 헤더로 보냄)
    const response = NextResponse.json({
      success: true,
      user: { id: user.id, username: user.username, name: user.name, role: user.role },
    });
    const maxAge = Math.floor(SESSION_ABSOLUTE_MS / 1000);
    response.cookies.set(SESSION_COOKIE, session.token, cookieOptions(maxAge, true));
    response.cookies.set(CSRF_COOKIE, session.csrfToken, cookieOptions(maxAge, false));
    response.cookies.delete(LEGACY_JWT_COOKIE);
    return response;
  } catch (error) {
    console.error('Login Error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
