/**
 * EGDesk User Data Configuration
 * Generated at: 2026-05-23T05:16:16.867Z
 *
 * This file contains type-safe definitions for your EGDesk tables.
 */

export const EGDESK_CONFIG = {
  // 키는 코드에 넣지 말고 .env.local 또는 EGDesk 실행 환경변수로 주입
  apiUrl: process.env.NEXT_PUBLIC_EGDESK_API_URL || 'http://localhost:8080',
  apiKey: process.env.NEXT_PUBLIC_EGDESK_API_KEY || '',
} as const;

export interface TableDefinition {
  name: string;
  displayName: string;
  description?: string;
  /** Omitted or unknown until synced / counted */
  rowCount?: number;
  columnCount: number;
  columns: string[];
}

export const TABLES = {
  table1: {
    name: 'inventory_logs',
    displayName: '재고 변동 이력',
    rowCount: 0,
    columnCount: 10,
    columns: ['id', 'itemId', 'itemName', 'itemType', 'changeType', 'quantity', 'price', 'operator', 'note', 'createdAt']
  } as TableDefinition,
  table2: {
    name: 'inventory_items',
    displayName: '재고 품목',
    rowCount: 0,
    columnCount: 11,
    columns: ['id', 'type', 'name', 'category', 'price', 'partner', 'stock', 'safeStock', 'location', 'description', 'createdAt']
  } as TableDefinition,
  table3: {
    name: 'naver_blog_marketing_settings',
    displayName: '네이버 블로그 마케팅 설정',
    rowCount: 1,
    columnCount: 8,
    columns: ['id', 'is_autopilot', 'autopilot_interval', 'autopilot_time', 'tone_style', 'naver_blog_id', 'api_client_id', 'api_client_secret']
  } as TableDefinition,
  table4: {
    name: 'crm_naver_blog_posts',
    displayName: '네이버 블로그 포스팅 이력 및 예약',
    rowCount: 0,
    columnCount: 13,
    columns: ['id', 'product_id', 'status', 'title', 'content', 'target_keywords', 'image_url', 'sub_image_url', 'scheduled_at', 'posted_at', 'error_message', 'views_count', 'likes_count']
  } as TableDefinition,
  table5: {
    name: 'instagram_marketing_settings',
    displayName: '인스타그램 마케팅 설정',
    rowCount: 1,
    columnCount: 7,
    columns: ['id', 'is_autopilot', 'autopilot_interval', 'autopilot_time', 'tone_style', 'instagram_username', 'access_token']
  } as TableDefinition,
  table6: {
    name: 'crm_instagram_posts',
    displayName: '인스타그램 포스팅 이력 및 예약',
    rowCount: 0,
    columnCount: 10,
    columns: ['id', 'product_id', 'status', 'content', 'image_url', 'scheduled_at', 'posted_at', 'error_message', 'likes_count', 'comments_count']
  } as TableDefinition,
  table7: {
    name: 'crm_operators',
    displayName: '운영자 권한 관리',
    rowCount: 1,
    columnCount: 6,
    columns: ['id', 'username', 'password_hash', 'name', 'role', 'created_at']
  } as TableDefinition,
  table8: {
    name: 'system_settings',
    displayName: '시스템 설정',
    rowCount: 1,
    columnCount: 3,
    columns: ['id', 'key', 'value']
  } as TableDefinition,
  table9: {
    name: 'crm_deliveries',
    displayName: '배송 내역',
    rowCount: 0,
    columnCount: 8,
    columns: ['id', 'customer_name', 'customer_phone', 'address', 'courier', 'tracking_number', 'status', 'order_id']
  } as TableDefinition,
  table10: {
    name: 'crm_reservations',
    displayName: '예약 내역',
    rowCount: 0,
    columnCount: 7,
    columns: ['id', 'customer_name', 'customer_phone', 'service_name', 'reservation_date', 'reservation_time', 'status']
  } as TableDefinition,
  table11: {
    name: 'crm_payments',
    displayName: '결제 내역',
    rowCount: 0,
    columnCount: 7,
    columns: ['id', 'customer_name', 'payment_method', 'amount', 'payment_date', 'status', 'order_id']
  } as TableDefinition,
  table12: {
    name: 'crm_orders',
    displayName: '주문 내역',
    rowCount: 0,
    columnCount: 13,
    columns: ['id', 'customer_name', 'customer_phone', 'product_name', 'quantity', 'total_price', 'delivery_method', 'shipping_address', 'tracking_number', 'attachment_url', 'customer_memo', 'order_date', 'status']
  } as TableDefinition,
  table13: {
    name: 'crm_transactions',
    displayName: '거래 내역',
    rowCount: 0,
    columnCount: 8,
    columns: ['id', 'customer_name', 'customer_phone', 'product_name', 'amount', 'order_date', 'status', 'order_id']
  } as TableDefinition,
  table14: {
    name: 'products',
    displayName: '광고 상품',
    rowCount: 0,
    columnCount: 10,
    columns: ['id', 'name', 'price', 'url', 'description', 'main_image_url', 'detail_image_url', 'available_methods', 'category', 'menu_category']
  } as TableDefinition,
  table15: {
    name: 'ad_templates',
    displayName: '광고 템플릿',
    rowCount: 0,
    columnCount: 5,
    columns: ['id', 'name', 'header', 'footer', 'opt_out']
  } as TableDefinition,
  table16: {
    name: 'message_logs',
    displayName: '발송 내역',
    rowCount: 0,
    columnCount: 6,
    columns: ['id', 'customer_id', 'phone', 'message', 'status', 'created_at']
  } as TableDefinition,
  table17: {
    name: 'message_templates',
    displayName: '문자 템플릿',
    rowCount: 0,
    columnCount: 3,
    columns: ['id', 'title', 'content']
  } as TableDefinition,
  table18: {
    name: 'crm_customers',
    displayName: '고객 명단',
    rowCount: 0,
    columnCount: 10,
    columns: ['id', 'name', 'phone', 'tags', 'memo', 'address', 'shipping_address', 'recipient_name', 'recipient_phone', 'created_at']
  } as TableDefinition,
  table19: {
    name: 'coupons',
    displayName: '할인 쿠폰',
    rowCount: 0,
    columnCount: 8,
    columns: ['id', 'code', 'name', 'discount_type', 'discount_value', 'min_order_amount', 'status', 'created_at']
  } as TableDefinition
} as const;


// Main table (first table by default)
export const MAIN_TABLE = TABLES.table1;


// Helper to get table by name
export function getTableByName(tableName: string): TableDefinition | undefined {
  return Object.values(TABLES).find(t => t.name === tableName);
}

// Export table names for easy access
export const TABLE_NAMES = {
  table1: 'inventory_logs',
  table2: 'inventory_items',
  table3: 'naver_blog_marketing_settings',
  table4: 'crm_naver_blog_posts',
  table5: 'instagram_marketing_settings',
  table6: 'crm_instagram_posts',
  table7: 'crm_operators',
  table8: 'system_settings',
  table9: 'crm_deliveries',
  table10: 'crm_reservations',
  table11: 'crm_payments',
  table12: 'crm_orders',
  table13: 'crm_transactions',
  table14: 'products',
  table15: 'ad_templates',
  table16: 'message_logs',
  table17: 'message_templates',
  table18: 'crm_customers',
  table19: 'coupons'
} as const;
