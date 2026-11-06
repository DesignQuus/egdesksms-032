export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { insertRows } from '../../../../egdesk-helpers';
import { hasAnyOperator } from '@/lib/setup-guard';

/**
 * 최초 1회 최고관리자 생성.
 * - 운영자가 이미 있으면 아무것도 하지 않음
 * - 비밀번호: ADMIN_INITIAL_PASSWORD 환경변수(8자 이상) 또는 무작위 생성 → 응답으로 1회만 표시
 */
export async function GET() {
  try {
    if (await hasAnyOperator()) {
      return NextResponse.json({ success: true, message: 'Admin already exists. Setup skipped.' });
    }

    const envPassword = process.env.ADMIN_INITIAL_PASSWORD;
    const password =
      envPassword && envPassword.length >= 8 ? envPassword : randomBytes(12).toString('base64url');

    await insertRows('crm_operators', [{
      id: 1,
      username: 'admin',
      password_hash: await bcrypt.hash(password, 10),
      name: '최고관리자',
      role: 'SUPER_ADMIN',
      created_at: new Date().toISOString(),
    }]);

    return NextResponse.json(
      {
        success: true,
        message: 'SUPER_ADMIN created. 이 비밀번호는 다시 표시되지 않으니 지금 저장하고, 로그인 후 변경하세요.',
        username: 'admin',
        password: envPassword && envPassword.length >= 8 ? '(ADMIN_INITIAL_PASSWORD 값)' : password,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    console.error('Setup Admin Error:', error);
    return NextResponse.json({ success: false, error: '관리자 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
