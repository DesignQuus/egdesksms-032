import { NextResponse } from 'next/server';
import { queryTable } from '@/lib/egdesk-db';

// POST /api/coupons/verify : 쿠폰 코드 유효성 검증 및 할인 금액 계산
export async function POST(req: Request) {
  try {
    const { code, orderAmount } = await req.json();

    if (!code) {
      return NextResponse.json({ success: false, error: '쿠폰 코드를 입력해주세요.' }, { status: 400 });
    }

    const result = await queryTable('coupons', {
      filters: { code: code.toUpperCase().trim() }
    });

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json({ success: false, error: '존재하지 않거나 유효하지 않은 쿠폰입니다.' });
    }

    const coupon = result.rows[0];

    if (coupon.status !== 'active') {
      return NextResponse.json({ success: false, error: '사용할 수 없거나 만료된 쿠폰입니다.' });
    }

    const minOrder = Number(coupon.min_order_amount) || 0;
    const amount = Number(orderAmount) || 0;

    if (minOrder > 0 && amount < minOrder) {
      return NextResponse.json({ success: false, error: `최소 주문 금액 ${minOrder.toLocaleString()}원을 충족해야 합니다.` });
    }

    let discountAmount = 0;
    const discountVal = Number(coupon.discount_value) || 0;
    
    if (coupon.discount_type === 'percent') {
      discountAmount = Math.floor(amount * (discountVal / 100));
    } else {
      discountAmount = discountVal;
    }
    
    // 할인이 결제 금액을 넘지 않도록
    if (discountAmount > amount) {
      discountAmount = amount;
    }

    return NextResponse.json({ 
      success: true, 
      coupon: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        discountType: coupon.discount_type,
        discountValue: discountVal,
        discountAmount: discountAmount
      }
    });

  } catch (error: any) {
    console.error('Failed to verify coupon:', error);
    return NextResponse.json({ success: false, error: '시스템 오류가 발생했습니다.' }, { status: 500 });
  }
}
