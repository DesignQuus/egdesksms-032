import { queryTable } from '@/lib/egdesk-db';
import { getCurrentUser } from '@/lib/auth';

/** 운영자 계정이 하나라도 있는지 (테이블이 없거나 조회 실패 시 false = 최초 설치 상태) */
export async function hasAnyOperator(): Promise<boolean> {
  try {
    const result = await queryTable('crm_operators', { limit: 1 });
    return Array.isArray(result?.rows) && result.rows.length > 0;
  } catch {
    return false;
  }
}

/** 최초 설치 단계이거나, 로그인한 최고관리자인 경우에만 허용 */
export async function canRunSetup(): Promise<boolean> {
  if (!(await hasAnyOperator())) return true;
  const user = await getCurrentUser();
  return user?.role === 'SUPER_ADMIN';
}
