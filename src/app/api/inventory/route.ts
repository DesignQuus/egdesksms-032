export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import {
  listTables,
  createTable,
  queryTable,
  insertRows,
  updateRows,
  deleteRows
} from '@/lib/egdesk-db';

// 테이블 자동 생성 초기화 함수
async function initTables() {
  try {
    const tables = await listTables();
    const tableNames = Array.isArray(tables) ? tables.map((t: any) => t.tableName) : [];

    // inventory_items 테이블 생성
    if (!tableNames.includes('inventory_items')) {
      await createTable(
        '재고 품목',
        [
          { name: 'type', type: 'TEXT', notNull: true }, // 'material' (자재) 또는 'product' (제품)
          { name: 'name', type: 'TEXT', notNull: true }, // 품목명
          { name: 'category', type: 'TEXT', notNull: true }, // 카테고리
          { name: 'price', type: 'REAL', notNull: true }, // 자재는 매입가, 제품은 판매가
          { name: 'partner', type: 'TEXT' }, // 매입 거래처 (자재 전용)
          { name: 'stock', type: 'INTEGER', notNull: true }, // 현재 재고량
          { name: 'safeStock', type: 'INTEGER', notNull: true }, // 안전 재고량
          { name: 'location', type: 'TEXT' }, // 창고 보관 위치
          { name: 'description', type: 'TEXT' }, // 품목 설명
          { name: 'createdAt', type: 'TEXT', notNull: true } // 등록 일자
        ],
        { tableName: 'inventory_items' }
      );
    }

    // inventory_logs 테이블 생성
    if (!tableNames.includes('inventory_logs')) {
      await createTable(
        '재고 변동 이력',
        [
          { name: 'itemId', type: 'INTEGER', notNull: true }, // 품목 ID
          { name: 'itemName', type: 'TEXT', notNull: true }, // 품목명
          { name: 'itemType', type: 'TEXT', notNull: true }, // 품목 구분 ('material' / 'product')
          { name: 'changeType', type: 'TEXT', notNull: true }, // 변동 유형 ('in' 입고, 'out' 출고, 'adjust' 실사조정)
          { name: 'quantity', type: 'INTEGER', notNull: true }, // 변동 수량 (실사조정의 경우 조정 후의 최종 수량)
          { name: 'price', type: 'REAL', notNull: true }, // 당시 단가
          { name: 'operator', type: 'TEXT', notNull: true }, // 담당자
          { name: 'note', type: 'TEXT' }, // 변동 사유 / 메모
          { name: 'createdAt', type: 'TEXT', notNull: true } // 발생 시간
        ],
        { tableName: 'inventory_logs' }
      );
    }
  } catch (error) {
    console.error('테이블 초기화 중 오류 발생:', error);
  }
}

// GET: 재고 품목 목록 조회
export async function GET(request: Request) {
  try {
    await initTables();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'material' 또는 'product'
    
    const filters: Record<string, string> = {};
    if (type) {
      filters.type = type;
    }

    const items = await queryTable('inventory_items', {
      filters,
      orderBy: 'createdAt',
      orderDirection: 'DESC',
      limit: 100
    });

    return NextResponse.json({ success: true, data: items?.rows || [] });
  } catch (error: any) {
    console.error('재고 목록 조회 중 오류 발생:', error);
    return NextResponse.json(
      { success: false, error: error.message || '재고 목록을 조회하지 못했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 신규 품목 등록
export async function POST(request: Request) {
  try {
    await initTables();
    const body = await request.json();
    
    const { type, name, category, price, partner, stock, safeStock, location, description } = body;

    if (!type || !name || !category || price === undefined || stock === undefined || safeStock === undefined) {
      return NextResponse.json(
        { success: false, error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const newItem = {
      type,
      name,
      category,
      price: Number(price),
      partner: partner || '',
      stock: Number(stock),
      safeStock: Number(safeStock),
      location: location || '',
      description: description || '',
      createdAt: new Date().toISOString()
    };

    const result = await insertRows('inventory_items', [newItem]);

    // 초기 재고가 0보다 큰 경우 입고 변동 이력도 남겨줍니다.
    if (Number(stock) > 0 && result && Array.isArray(result) && result[0]) {
      const insertedId = result[0].id;
      const initialLog = {
        itemId: insertedId,
        itemName: name,
        itemType: type,
        changeType: 'in',
        quantity: Number(stock),
        price: Number(price),
        operator: '시스템 관리자',
        note: '최초 등록 입고',
        createdAt: new Date().toISOString()
      };
      await insertRows('inventory_logs', [initialLog]);
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('재고 등록 중 오류 발생:', error);
    return NextResponse.json(
      { success: false, error: error.message || '재고 품목을 등록하지 못했습니다.' },
      { status: 500 }
    );
  }
}

// PUT: 품목 정보 수정
export async function PUT(request: Request) {
  try {
    await initTables();
    const body = await request.json();
    const { id, name, category, price, partner, safeStock, location, description } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '품목 ID가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (price !== undefined) updates.price = Number(price);
    if (partner !== undefined) updates.partner = partner;
    if (safeStock !== undefined) updates.safeStock = Number(safeStock);
    if (location !== undefined) updates.location = location;
    if (description !== undefined) updates.description = description;

    await updateRows('inventory_items', updates, {
      ids: [Number(id)]
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('재고 정보 수정 중 오류 발생:', error);
    return NextResponse.json(
      { success: false, error: error.message || '재고 정보를 수정하지 못했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 품목 삭제
export async function DELETE(request: Request) {
  try {
    await initTables();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: '품목 ID가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 1. 품목 삭제
    await deleteRows('inventory_items', {
      ids: [Number(id)]
    });

    // 2. 해당 품목의 이력도 정리 (선택사항, 데이터 일관성을 위해 유지하거나 혹은 남겨둠. 여기선 같이 삭제하도록 처리)
    await deleteRows('inventory_logs', {
      filters: { itemId: String(id) }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('재고 삭제 중 오류 발생:', error);
    return NextResponse.json(
      { success: false, error: error.message || '재고 품목을 삭제하지 못했습니다.' },
      { status: 500 }
    );
  }
}
