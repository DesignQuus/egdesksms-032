export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { queryTable } from '@/lib/egdesk-db';

export async function GET() {
  try {
    const result = await queryTable('message_logs', {
      orderBy: 'created_at',
      orderDirection: 'DESC'
    });
    return NextResponse.json({ success: true, logs: result.rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
