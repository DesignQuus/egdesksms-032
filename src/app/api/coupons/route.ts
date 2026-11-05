export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { queryTable, insertRows, updateRows, deleteRows } from '@/lib/egdesk-db';

// GET /api/coupons : 발급된 쿠폰 목록 조회
export async function GET() {
  try {
    const result = await queryTable('coupons', {
      orderBy: 'created_at',
      orderDirection: 'DESC'
    });
    
    return NextResponse.json({ success: true, coupons: result.rows });
  } catch (error: any) {
    console.error('Failed to fetch coupons:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/coupons : 새 쿠폰 발행
export async function POST(req: Request) {
  try {
    const { code, name, discount_type, discount_value, min_order_amount, status, count, prefix } = await req.json();

    if (!name || !discount_value) {
      return NextResponse.json({ success: false, error: 'Required fields missing' }, { status: 400 });
    }

    const numCount = Number(count) || 1;
    const isBulk = numCount > 1;

    if (!isBulk && !code) {
      return NextResponse.json({ success: false, error: 'Coupon code is required for single issue' }, { status: 400 });
    }

    const rows = [];
    const timestamp = Date.now();

    for (let i = 0; i < numCount; i++) {
      let finalCode = '';
      if (isBulk) {
        const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
        finalCode = `${prefix ? prefix.toUpperCase() + '-' : ''}${randomStr}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      } else {
        finalCode = code.toUpperCase().trim();
      }

      rows.push({
        id: `${timestamp}-${i}`,
        code: finalCode,
        name,
        discount_type: discount_type || 'amount',
        discount_value: Number(discount_value) || 0,
        min_order_amount: Number(min_order_amount) || 0,
        status: status || 'active',
        created_at: new Date().toISOString()
      });
    }

    await insertRows('coupons', rows);

    return NextResponse.json({ success: true, count: numCount });
  } catch (error: any) {
    console.error('Failed to create coupon:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/coupons : 쿠폰 삭제 (비활성화)
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
    }

    await deleteRows('coupons', { filters: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete coupon:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT /api/coupons : 쿠폰 정보 수정 (status 등)
export async function PUT(req: Request) {
  try {
    const { id, code, status } = await req.json();

    if (!id && !code) {
      return NextResponse.json({ success: false, error: 'ID or Code is required' }, { status: 400 });
    }

    const filters: Record<string, string> = {};
    if (id) filters.id = String(id);
    if (code) filters.code = String(code);

    await updateRows('coupons', { status: status || 'used' }, { filters });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to update coupon:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

