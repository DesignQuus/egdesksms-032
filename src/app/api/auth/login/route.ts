import { NextResponse } from 'next/server';
import { queryTable } from '@/lib/egdesk-db';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { AUTH_COOKIE, getJwtSecret } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, error: '아이디와 비밀번호를 모두 입력해주세요.' }, { status: 400 });
    }

    // 1. 운영자 조회
    const result = await queryTable('crm_operators', { filters: { username } });
    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json({ success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    const user = result.rows[0];

    // 2. 비밀번호 검증
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ success: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    // 3. JWT 토큰 생성
    const token = await new SignJWT({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h') // 24시간 유지
      .sign(await getJwtSecret());

    // 4. 쿠키에 토큰 설정
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });

    response.cookies.set({
      name: AUTH_COOKIE,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 // 1 day
    });

    return response;
  } catch (error: any) {
    console.error('Login Error:', error);
    return NextResponse.json({ success: false, error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
