import { NextResponse } from 'next/server';
import { gmAutomation } from '@/lib/google-messages';
import { insertRows } from '@/lib/egdesk-db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phoneNumber, message, customerId } = body;
    
    if (!phoneNumber || !message) {
      return NextResponse.json({ success: false, error: 'Phone number and message are required' }, { status: 400 });
    }

    // Call playwright automation to send message
    const result = await gmAutomation.sendSMS(phoneNumber, message);
    
    // Log to DB
    const now = new Date().toISOString();
    const id = Math.floor(Math.random() * 1000000);
    
    await insertRows('message_logs', [
      {
        id,
        customer_id: customerId || null,
        phone: phoneNumber,
        message: message,
        status: result.success ? 'SUCCESS' : 'FAILED',
        created_at: now
      }
    ]).catch(e => console.error('Failed to log message to DB:', e));

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error sending SMS:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
