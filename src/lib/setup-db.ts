import { createTable, queryTable, insertRows, updateRows, deleteRows, deleteTable } from '@/lib/egdesk-db';

export async function setupDatabase() {
  const safeCreateTable = async (displayName: string, columns: any[], options: any) => {
    try {
      await createTable(displayName, columns, options);
      console.log(`Table "${options.tableName}" created/verified.`);
    } catch (e: any) {
      if (e.message.includes('UNIQUE constraint failed') || e.message.includes('table_name')) {
        console.log(`Table metadata mismatch for "${options.tableName}". Attempting auto-healing via drop and recreate...`);
        try {
          await deleteTable(options.tableName);
          await createTable(displayName, columns, options);
          console.log(`Table "${options.tableName}" auto-healed and created successfully.`);
          return;
        } catch (recreateErr: any) {
          console.error(`Failed to auto-heal table "${options.tableName}":`, recreateErr.message);
        }
      }
      console.error(`Error creating table "${options.tableName}":`, e.message);
    }
  };

  console.log('Starting database setup for egdesk-FreeSMS...');

  // 1. Customers Table
  await safeCreateTable('고객 명단', [
    { name: 'id', type: 'INTEGER', notNull: true },
    { name: 'name', type: 'TEXT', notNull: true },
    { name: 'phone', type: 'TEXT', notNull: true },
    { name: 'tags', type: 'TEXT' }, // Comma-separated tags or JSON
    { name: 'memo', type: 'TEXT' },
    { name: 'address', type: 'TEXT' },
    { name: 'shipping_address', type: 'TEXT' },
    { name: 'recipient_name', type: 'TEXT' },
    { name: 'recipient_phone', type: 'TEXT' },
    { name: 'created_at', type: 'TEXT' },
  ], { tableName: 'crm_customers', uniqueKeyColumns: ['id'] });

  // 2. Message Templates Table
  await safeCreateTable('문자 템플릿', [
    { name: 'id', type: 'INTEGER', notNull: true },
    { name: 'title', type: 'TEXT', notNull: true },
    { name: 'content', type: 'TEXT', notNull: true },
  ], { tableName: 'message_templates', uniqueKeyColumns: ['id'] });

  // 3. Message Logs Table
  await safeCreateTable('발송 내역', [
    { name: 'id', type: 'INTEGER', notNull: true },
    { name: 'customer_id', type: 'INTEGER' }, // Nullable for ad-hoc messages
    { name: 'phone', type: 'TEXT', notNull: true },
    { name: 'message', type: 'TEXT', notNull: true },
    { name: 'status', type: 'TEXT', notNull: true }, // SUCCESS, FAILED
    { name: 'created_at', type: 'TEXT', notNull: true },
  ], { tableName: 'message_logs', uniqueKeyColumns: ['id'] });

  // 4. Ad Templates Table
  await safeCreateTable('광고 템플릿', [
    { name: 'id', type: 'TEXT', notNull: true },
    { name: 'name', type: 'TEXT', notNull: true },
    { name: 'header', type: 'TEXT', notNull: true },
    { name: 'footer', type: 'TEXT', notNull: true },
    { name: 'opt_out', type: 'TEXT', notNull: true },
  ], { tableName: 'ad_templates', uniqueKeyColumns: ['id'] });

  // 5. Products Table
  await safeCreateTable('광고 상품', [
    { name: 'id', type: 'TEXT', notNull: true },
    { name: 'name', type: 'TEXT', notNull: true },
    { name: 'price', type: 'TEXT' },
    { name: 'url', type: 'TEXT' },
    { name: 'description', type: 'TEXT' },
    { name: 'main_image_url', type: 'TEXT' },
    { name: 'detail_image_url', type: 'TEXT' },
    { name: 'available_methods', type: 'TEXT' },
    { name: 'category', type: 'TEXT' },
    { name: 'menu_category', type: 'TEXT' },
  ], { tableName: 'products', uniqueKeyColumns: ['id'], duplicateAction: 'update' });

  // 6. Transactions Table
  await safeCreateTable('거래 내역', [
    { name: 'id', type: 'TEXT', notNull: true },
    { name: 'customer_name', type: 'TEXT', notNull: true },
    { name: 'customer_phone', type: 'TEXT', notNull: true },
    { name: 'product_name', type: 'TEXT', notNull: true },
    { name: 'amount', type: 'TEXT' },
    { name: 'order_date', type: 'TEXT' },
    { name: 'status', type: 'TEXT' },
    { name: 'order_id', type: 'TEXT' },
  ], { tableName: 'crm_transactions', uniqueKeyColumns: ['id'] });

  // 7. Orders Table
  await safeCreateTable('주문 내역', [
    { name: 'id', type: 'TEXT', notNull: true },
    { name: 'customer_name', type: 'TEXT', notNull: true },
    { name: 'customer_phone', type: 'TEXT', notNull: true },
    { name: 'product_name', type: 'TEXT', notNull: true },
    { name: 'quantity', type: 'TEXT' },
    { name: 'total_price', type: 'TEXT' },
    { name: 'delivery_method', type: 'TEXT' },
    { name: 'shipping_address', type: 'TEXT' },
    { name: 'tracking_number', type: 'TEXT' },
    { name: 'attachment_url', type: 'TEXT' },
    { name: 'customer_memo', type: 'TEXT' },
    { name: 'order_date', type: 'TEXT' },
    { name: 'status', type: 'TEXT' },
  ], { tableName: 'crm_orders', uniqueKeyColumns: ['id'], duplicateAction: 'update' });

  // 8. Payments Table
  await safeCreateTable('결제 내역', [
    { name: 'id', type: 'TEXT', notNull: true },
    { name: 'customer_name', type: 'TEXT', notNull: true },
    { name: 'payment_method', type: 'TEXT', notNull: true },
    { name: 'amount', type: 'TEXT', notNull: true },
    { name: 'payment_date', type: 'TEXT' },
    { name: 'status', type: 'TEXT' },
    { name: 'order_id', type: 'TEXT' },
  ], { tableName: 'crm_payments', uniqueKeyColumns: ['id'] });

  // 9. Reservations Table
  await safeCreateTable('예약 내역', [
    { name: 'id', type: 'TEXT', notNull: true },
    { name: 'customer_name', type: 'TEXT', notNull: true },
    { name: 'customer_phone', type: 'TEXT', notNull: true },
    { name: 'service_name', type: 'TEXT', notNull: true },
    { name: 'reservation_date', type: 'TEXT' },
    { name: 'reservation_time', type: 'TEXT' },
    { name: 'status', type: 'TEXT' },
  ], { tableName: 'crm_reservations', uniqueKeyColumns: ['id'] });

  // 10. Deliveries Table
  await safeCreateTable('배송 내역', [
    { name: 'id', type: 'TEXT', notNull: true },
    { name: 'customer_name', type: 'TEXT', notNull: true },
    { name: 'customer_phone', type: 'TEXT', notNull: true },
    { name: 'address', type: 'TEXT', notNull: true },
    { name: 'courier', type: 'TEXT' },
    { name: 'tracking_number', type: 'TEXT' },
    { name: 'status', type: 'TEXT' },
    { name: 'order_id', type: 'TEXT' },
  ], { tableName: 'crm_deliveries', uniqueKeyColumns: ['id'] });

  // 11. System Settings Table
  await safeCreateTable('시스템 설정', [
    { name: 'key', type: 'TEXT', notNull: true },
    { name: 'value', type: 'TEXT', notNull: true }
  ], { tableName: 'system_settings', uniqueKeyColumns: ['key'] });

  // 12. CRM Operators Table
  await safeCreateTable('운영자 권한 관리', [
    { name: 'id', type: 'INTEGER', notNull: true },
    { name: 'username', type: 'TEXT', notNull: true },
    { name: 'password_hash', type: 'TEXT', notNull: true },
    { name: 'name', type: 'TEXT', notNull: true },
    { name: 'role', type: 'TEXT', notNull: true }, // 'SUPER_ADMIN' or 'SUB_OPERATOR'
    { name: 'created_at', type: 'TEXT' }
  ], { tableName: 'crm_operators', uniqueKeyColumns: ['username'] });

  // 13. Instagram Posts Table
  await safeCreateTable('인스타그램 포스팅 이력 및 예약', [
    { name: 'id', type: 'INTEGER', notNull: true },
    { name: 'product_id', type: 'TEXT' },
    { name: 'status', type: 'TEXT', notNull: true }, // DRAFT, SCHEDULED, POSTED, FAILED
    { name: 'content', type: 'TEXT' },
    { name: 'image_url', type: 'TEXT' },
    { name: 'scheduled_at', type: 'TEXT' },
    { name: 'posted_at', type: 'TEXT' },
    { name: 'error_message', type: 'TEXT' },
    { name: 'likes_count', type: 'INTEGER' },
    { name: 'comments_count', type: 'INTEGER' }
  ], { tableName: 'crm_instagram_posts', uniqueKeyColumns: ['id'] });

  // 14. Instagram Settings Table
  await safeCreateTable('인스타그램 마케팅 설정', [
    { name: 'id', type: 'INTEGER', notNull: true },
    { name: 'is_autopilot', type: 'INTEGER', notNull: true }, // 0: 수동, 1: 자동
    { name: 'autopilot_interval', type: 'TEXT' }, // DAILY, WEEKLY 등
    { name: 'autopilot_time', type: 'TEXT' }, // "10:00"
    { name: 'tone_style', type: 'TEXT' }, // 인플루언서형, 세련된형 등
    { name: 'instagram_username', type: 'TEXT' },
    { name: 'access_token', type: 'TEXT' }
  ], { tableName: 'instagram_marketing_settings', uniqueKeyColumns: ['id'] });

  // 15. Naver Blog Posts Table
  await safeCreateTable('네이버 블로그 포스팅 이력 및 예약', [
    { name: 'id', type: 'INTEGER', notNull: true },
    { name: 'product_id', type: 'TEXT' },
    { name: 'status', type: 'TEXT', notNull: true }, // DRAFT, SCHEDULED, POSTED, FAILED
    { name: 'title', type: 'TEXT' },
    { name: 'content', type: 'TEXT' },
    { name: 'target_keywords', type: 'TEXT' },
    { name: 'image_url', type: 'TEXT' },
    { name: 'sub_image_url', type: 'TEXT' },
    { name: 'scheduled_at', type: 'TEXT' },
    { name: 'posted_at', type: 'TEXT' },
    { name: 'error_message', type: 'TEXT' },
    { name: 'views_count', type: 'INTEGER' },
    { name: 'likes_count', type: 'INTEGER' }
  ], { tableName: 'crm_naver_blog_posts', uniqueKeyColumns: ['id'] });

  // 16. Naver Blog Settings Table
  await safeCreateTable('네이버 블로그 마케팅 설정', [
    { name: 'id', type: 'INTEGER', notNull: true },
    { name: 'is_autopilot', type: 'INTEGER', notNull: true }, // 0: 수동, 1: 자동
    { name: 'autopilot_interval', type: 'TEXT' }, // DAILY, WEEKLY 등
    { name: 'autopilot_time', type: 'TEXT' }, // "10:00"
    { name: 'tone_style', type: 'TEXT' }, // 정보제공형, 솔직리뷰형 등
    { name: 'naver_blog_id', type: 'TEXT' },
    { name: 'api_client_id', type: 'TEXT' },
    { name: 'api_client_secret', type: 'TEXT' }
  ], { tableName: 'naver_blog_marketing_settings', uniqueKeyColumns: ['id'] });

    // ID 1의 기본 네이버 블로그 설정 존재 여부 확인 후 자동 주입
    try {
      const naverSettingsCheck = await queryTable('naver_blog_marketing_settings', { filters: { id: '1' } });
      if (!naverSettingsCheck.rows || naverSettingsCheck.rows.length === 0) {
        await insertRows('naver_blog_marketing_settings', [{
          id: 1,
          is_autopilot: 0,
          autopilot_interval: 'DAILY',
          autopilot_time: '10:00',
          tone_style: '정보제공형',
          naver_blog_id: '',
          api_client_id: '',
          api_client_secret: ''
        }]);
        console.log('Dummy Naver Blog settings seeded.');
      }
    } catch (e: any) {
      console.error('Error seeding naver blog settings:', e.message);
    }

    // ID 1의 기본 설정 존재 여부 확인 후 자동 주입
    try {
      const settingsCheck = await queryTable('instagram_marketing_settings', { filters: { id: '1' } });
      if (!settingsCheck.rows || settingsCheck.rows.length === 0) {
        await insertRows('instagram_marketing_settings', [{
          id: 1,
          is_autopilot: 0,
          autopilot_interval: 'DAILY',
          autopilot_time: '10:00',
          tone_style: '인플루언서형',
          instagram_username: '',
          access_token: ''
        }]);
        console.log('Dummy Instagram settings seeded.');
      } else {
        // 기존 데이터가 존재하지만 계정이 이전 임시 데모 ID 'charismagreat'인 경우 안전하게 빈 값으로 초기화(마이그레이션)
        const current = settingsCheck.rows[0];
        if (current.instagram_username === 'charismagreat') {
          await updateRows('instagram_marketing_settings', {
            instagram_username: '',
            access_token: ''
          }, { filters: { id: '1' } });
          console.log('Migrated legacy dummy instagram account settings to empty strings.');
        }
      }
    } catch (e: any) {
      console.error('Error seeding/migrating instagram settings:', e.message);
    }
  // 기존 더미 데이터 및 가짜 포스팅 이력 완전히 비우기 (실제 데이터만 남도록 초기화)
  try {
    const postsCheck = await queryTable('crm_instagram_posts', {});
    const posts = postsCheck.rows || [];
    if (posts.length > 0) {
      const ids = posts.map((post: any) => Number(post.id));
      await deleteRows('crm_instagram_posts', { ids });
      console.log('Cleared all instagram dummy posts successfully.');
    } else {
      console.log('No posts to clear.');
    }
  } catch (e: any) {
    console.error('Error clearing instagram dummy posts:', e.message);
  }

  console.log('Database setup complete.');
}
