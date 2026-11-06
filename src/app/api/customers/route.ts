export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { queryTable, insertRows } from '@/lib/egdesk-db';
import { triggerAutomation } from '@/lib/automation-trigger';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit')) || 1000;
    
    // queryTable requires tableName
    const response = await queryTable('crm_customers', {
      limit,
      orderBy: 'created_at',
      orderDirection: 'DESC'
    });
    
    return NextResponse.json({ success: true, data: response });
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone, tags, memo, address, shipping_address, recipient_name, recipient_phone } = body;
    
    if (!name || !phone) {
      return NextResponse.json({ success: false, error: 'Name and phone are required' }, { status: 400 });
    }
    
    const now = new Date().toISOString();
    
    const id = Math.floor(Math.random() * 1000000); // Simple ID generation
    
    await insertRows('crm_customers', [
      { 
        id, name, phone, tags: tags || '', memo: memo || '', address: address || '',
        shipping_address: shipping_address || '',
        recipient_name: recipient_name || '',
        recipient_phone: recipient_phone || '',
        created_at: now 
      }
    ]);
    
    // Trigger automation in the background
    triggerAutomation('customer_registered', { id, name, phone });

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('Error adding customer:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
