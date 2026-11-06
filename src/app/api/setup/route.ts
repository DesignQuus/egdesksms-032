export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { setupDatabase } from '@/lib/setup-db';
import { canRunSetup } from '@/lib/setup-guard';

// 최초 설치 시(운영자 0명) 또는 최고관리자만 실행 가능
export async function GET() {
  if (!(await canRunSetup())) {
    return NextResponse.json({ success: false, error: '최고관리자만 실행할 수 있습니다.' }, { status: 403 });
  }
  try {
    await setupDatabase();
    return NextResponse.json({ success: true, message: 'DB setup complete' });
  } catch (error: unknown) {
    console.error('DB setup error:', error);
    return NextResponse.json({ success: false, error: 'DB 설정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
