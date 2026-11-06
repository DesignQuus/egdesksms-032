export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { queryTable, insertRows, deleteRows } from '@/lib/egdesk-db';
import bcrypt from 'bcryptjs';
import { getCurrentUser } from '@/lib/auth';

async function getRoleFromToken() {
  const user = await getCurrentUser(); // 서명·만료 검증
  return user?.role || 'SUB_OPERATOR';
}

export async function GET(req: Request) {
  try {
    const role = await getRoleFromToken();
    if (role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const result = await queryTable('crm_operators');
    return NextResponse.json({ success: true, operators: result.rows || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const role = await getRoleFromToken();
    if (role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const { username, password, name, newRole } = await req.json();

    if (!username || !password || !name) {
      return NextResponse.json({ success: false, error: '모든 필드를 입력해주세요.' }, { status: 400 });
    }

    // Check if user exists
    const existing = await queryTable('crm_operators', { filters: { username } });
    if (existing.rows && existing.rows.length > 0) {
      return NextResponse.json({ success: false, error: '이미 존재하는 아이디입니다.' }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const dateStr = new Date().toISOString();

    await insertRows('crm_operators', [{
      id: Date.now(), // Generate a numeric ID
      username,
      password_hash,
      name,
      role: newRole || 'SUB_OPERATOR',
      created_at: dateStr
    }]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const role = await getRoleFromToken();
    if (role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is missing' }, { status: 400 });
    }

    // prevent deleting admin
    const op = await queryTable('crm_operators', { filters: { id } });
    if (op.rows && op.rows.length > 0 && op.rows[0].username === 'admin') {
       return NextResponse.json({ success: false, error: '기본 관리자 계정은 삭제할 수 없습니다.' }, { status: 400 });
    }

    await deleteRows('crm_operators', { filters: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
