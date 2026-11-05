export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { queryTable, insertRows, deleteRows } from '@/lib/egdesk-db';
import { triggerAutomation } from '@/lib/automation-trigger';

export async function GET() {
  try {
    const result = await queryTable('crm_payments', {
      orderBy: 'payment_date',
      orderDirection: 'DESC'
    });
    return NextResponse.json({ success: true, payments: result.rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const id = data.id || Date.now().toString();
    await insertRows('crm_payments', [{
      id,
      customer_name: data.customerName,
      payment_method: data.paymentMethod || '카드결제',
      amount: data.amount,
      payment_date: data.paymentDate || new Date().toISOString().split('T')[0],
      status: data.status || '결제완료',
      order_id: data.orderId || ''
    }]);
    
    // Trigger automation in the background
    triggerAutomation('payment_completed', { 
      id, 
      name: data.customerName, 
      phone: data.customerPhone, // Assuming frontend passes phone
      결제수단: data.paymentMethod || '카드결제',
      결제금액: data.amount,
      결제일시: data.paymentDate || new Date().toISOString().split('T')[0]
    });

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    await deleteRows('crm_payments', { filters: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
