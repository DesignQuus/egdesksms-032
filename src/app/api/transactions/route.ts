export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { queryTable, insertRows, deleteRows } from '@/lib/egdesk-db';

// GET /api/transactions : 거래 내역 목록 조회
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');
    
    // 전화번호 파라미터가 있으면 해당 고객의 최근 거래내역 1건만 조회 (2번 방식용)
    if (phone) {
      const result = await queryTable('crm_transactions', {
        filters: { customer_phone: phone },
        orderBy: 'order_date',
        orderDirection: 'DESC',
        limit: 1
      });
      const transaction = result.rows[0] ? {
        id: result.rows[0].id,
        customerName: result.rows[0].customer_name,
        customerPhone: result.rows[0].customer_phone,
        productName: result.rows[0].product_name,
        amount: result.rows[0].amount,
        orderDate: result.rows[0].order_date,
        status: result.rows[0].status,
        orderId: result.rows[0].order_id
      } : null;
      return NextResponse.json({ success: true, transaction });
    }

    // 기본 전체 리스트 조회 (3번 방식용)
    const result = await queryTable('crm_transactions', {
      orderBy: 'order_date',
      orderDirection: 'DESC'
    });
    
    const transactions = result.rows.map((r: any) => ({
      id: r.id,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      productName: r.product_name,
      amount: r.amount,
      orderDate: r.order_date,
      status: r.status,
      orderId: r.order_id
    }));

    return NextResponse.json({ success: true, transactions });
  } catch (error: any) {
    console.error('Failed to fetch transactions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/transactions : 새 거래 내역 등록
export async function POST(req: Request) {
  try {
    const { id, customerName, customerPhone, productName, amount, orderDate, status } = await req.json();

    if (!customerName || !customerPhone || !productName) {
      return NextResponse.json({ success: false, error: 'Name, phone, and product name are required' }, { status: 400 });
    }

    const newId = id || Date.now().toString();

    await insertRows('crm_transactions', [{
      id: newId,
      customer_name: customerName,
      customer_phone: customerPhone,
      product_name: productName,
      amount: amount || '',
      order_date: orderDate || new Date().toISOString().split('T')[0],
      status: status || '결제완료'
    }]);

    return NextResponse.json({ success: true, id: newId });
  } catch (error: any) {
    console.error('Failed to create transaction:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/transactions : 거래 내역 삭제
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
    }

    await deleteRows('crm_transactions', { filters: { id: id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete transaction:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
