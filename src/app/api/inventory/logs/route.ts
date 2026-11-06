export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import {
  queryTable,
  insertRows,
  updateRows
} from '@/lib/egdesk-db';

// GET: 재고 변동 로그 목록 조회
export async function GET() {
  try {
    const logs = await queryTable('inventory_logs', {
      orderBy: 'createdAt',
      orderDirection: 'DESC',
      limit: 100
    });

    return NextResponse.json({ success: true, data: logs?.rows || [] });
  } catch (error: any) {
    console.error('재고 로그 조회 중 오류 발생:', error);
    return NextResponse.json(
      { success: false, error: error.message || '재고 로그를 조회하지 못했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 재고 입출고 및 실사 조정 처리
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { itemId, changeType, quantity, price, operator, note } = body;

    if (!itemId || !changeType || quantity === undefined || price === undefined || !operator) {
      return NextResponse.json(
        { success: false, error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 1. 기존 품목 정보 조회
    const itemsResult = await queryTable('inventory_items', {
      filters: { id: String(itemId) }
    });
    const items = itemsResult?.rows || [];

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: '존재하지 않는 품목입니다.' },
        { status: 404 }
      );
    }

    const item = items[0];
    const currentStock = Number(item.stock);
    const qty = Number(quantity);
    let newStock = currentStock;
    let logQuantity = qty; // 로그에 기록될 변동 수량

    // 2. 변동 유형에 따른 재고 수량 계산
    if (changeType === 'in') {
      newStock = currentStock + qty;
      logQuantity = qty;
    } else if (changeType === 'out') {
      // 출고의 경우
      newStock = currentStock - qty;
      logQuantity = qty;
    } else if (changeType === 'adjust') {
      // 실사 조정의 경우, 입력받은 quantity가 최종 실사 수량이 됨
      newStock = qty;
      logQuantity = qty - currentStock; // 변동량 계산
    } else {
      return NextResponse.json(
        { success: false, error: '잘못된 변동 유형입니다.' },
        { status: 400 }
      );
    }

    // 3. 품목 현재고 업데이트
    await updateRows('inventory_items', {
      stock: newStock
    }, {
      ids: [Number(itemId)]
    });

    // 4. 변동 로그 삽입
    const newLog = {
      itemId: Number(itemId),
      itemName: item.name,
      itemType: item.type,
      changeType,
      quantity: logQuantity,
      price: Number(price),
      operator,
      note: changeType === 'adjust' 
        ? `${note || ''} (실사 조정: ${currentStock}개 -> ${newStock}개)`.trim()
        : note || '',
      createdAt: new Date().toISOString()
    };

    await insertRows('inventory_logs', [newLog]);

    return NextResponse.json({
      success: true,
      data: {
        itemId: Number(itemId),
        itemName: item.name,
        previousStock: currentStock,
        newStock: newStock,
        changeType,
        logQuantity
      }
    });
  } catch (error: any) {
    console.error('재고 변동 처리 중 오류 발생:', error);
    return NextResponse.json(
      { success: false, error: error.message || '재고 변동 처리에 실패했습니다.' },
      { status: 500 }
    );
  }
}
