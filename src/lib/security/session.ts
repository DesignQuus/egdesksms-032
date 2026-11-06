/**
 * 운영자 로그인 세션 (이지데스크 My DB `crm_user_sessions`).
 * 쿠키에는 무작위 토큰만 두고 DB 에는 그 SHA-256 해시를 저장한다. 로그아웃·운영자 삭제 시
 * 세션 행을 지워 즉시 무효화한다. 서버(proxy·라우트·서버 컴포넌트)에서만 쓴다.
 */
import { createTable, deleteRows, insertRows, listTables, queryTable, updateRows } from '@/lib/egdesk-db';
import { hashToken, newToken, nextExpiry, shouldTouch, SESSION_ABSOLUTE_MS } from './core';

export const SESSION_TABLE = 'crm_user_sessions';
/** 같은 운영자가 동시에 유지할 수 있는 세션 수(오래된 것부터 정리) */
const MAX_SESSIONS_PER_OPERATOR = 10;

export interface SessionRecord {
  operatorId: string;
  csrfToken: string;
  createdAt: number;
  expiresAt: number;
}

interface SessionRow {
  session_hash?: string;
  operator_id?: string | number;
  csrf_token?: string;
  created_at?: string;
  expires_at?: string;
  last_seen_at?: string;
}

// 세션 조회 결과는 캐시하지 않는다: Next.js 의 proxy 와 라우트는 메모리를 공유하지 않아
// 캐시가 있으면 로그아웃·운영자 삭제가 proxy 에 늦게 반영된다(즉시 무효화가 목적).
let tableReady: Promise<void> | null = null;

function rowsOf(result: unknown): SessionRow[] {
  const rows = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(rows) ? (rows as SessionRow[]) : Array.isArray(result) ? (result as SessionRow[]) : [];
}

function time(value: string | undefined): number {
  const t = value ? Date.parse(value) : NaN;
  return Number.isFinite(t) ? t : 0;
}

/** 세션 테이블이 없으면 만든다(최초 1회). */
export function ensureSessionTable(): Promise<void> {
  tableReady ??= (async () => {
    const listed = (await listTables()) as { tables?: Array<{ tableName?: string }> } | null;
    if (listed?.tables?.some((t) => t.tableName === SESSION_TABLE)) return;
    await createTable('운영자 로그인 세션', [
      { name: 'session_hash', type: 'TEXT', notNull: true },
      { name: 'operator_id', type: 'TEXT', notNull: true },
      { name: 'csrf_token', type: 'TEXT', notNull: true },
      { name: 'created_at', type: 'TEXT', notNull: true },
      { name: 'expires_at', type: 'TEXT', notNull: true },
      { name: 'last_seen_at', type: 'TEXT', notNull: true },
      { name: 'user_agent', type: 'TEXT' },
    ], { tableName: SESSION_TABLE, description: '운영자 로그인 세션(쿠키 토큰의 해시만 저장)' });
  })().catch((error) => {
    tableReady = null;
    throw error;
  });
  return tableReady;
}

/** 로그인 성공 시 새 세션을 만들고 쿠키에 넣을 토큰과 CSRF 토큰을 돌려준다. */
export async function createSession(operatorId: string, userAgent: string | null): Promise<{ token: string; csrfToken: string; expiresAt: number }> {
  await ensureSessionTable();
  const now = Date.now();
  const token = newToken();
  const csrfToken = newToken();
  const expiresAt = nextExpiry(now, now);
  await insertRows(SESSION_TABLE, [{
    session_hash: hashToken(token),
    operator_id: operatorId,
    csrf_token: csrfToken,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(expiresAt).toISOString(),
    last_seen_at: new Date(now).toISOString(),
    user_agent: (userAgent ?? '').slice(0, 200),
  }]);
  await pruneOperatorSessions(operatorId, now).catch(() => undefined);
  return { token, csrfToken, expiresAt };
}

/** 만료된 세션과 개수 초과분을 정리한다. */
async function pruneOperatorSessions(operatorId: string, now: number) {
  const rows = rowsOf(await queryTable(SESSION_TABLE, { filters: { operator_id: operatorId }, limit: 500 }));
  const alive = rows.filter((r) => time(r.expires_at) > now).sort((a, b) => time(b.created_at) - time(a.created_at));
  const stale = [...rows.filter((r) => time(r.expires_at) <= now), ...alive.slice(MAX_SESSIONS_PER_OPERATOR)];
  for (const row of stale) {
    if (row.session_hash) await deleteRows(SESSION_TABLE, { filters: { session_hash: row.session_hash } });
  }
}

/** 쿠키 토큰으로 세션을 찾는다. 만료됐으면 지우고 null. 사용 중이면 만료 시각을 연장한다. */
export async function findSession(token: string | null | undefined): Promise<SessionRecord | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  const sessionHash = hashToken(token);
  const now = Date.now();
  await ensureSessionTable();
  const [row] = rowsOf(await queryTable(SESSION_TABLE, { filters: { session_hash: sessionHash }, limit: 1 }));
  let record: SessionRecord | null = null;
  if (row && row.session_hash === sessionHash && row.operator_id != null && row.csrf_token) {
    const createdAt = time(row.created_at);
    const expiresAt = time(row.expires_at);
    if (expiresAt <= now || createdAt + SESSION_ABSOLUTE_MS <= now) {
      await deleteRows(SESSION_TABLE, { filters: { session_hash: sessionHash } }).catch(() => undefined);
    } else {
      record = { operatorId: String(row.operator_id), csrfToken: row.csrf_token, createdAt, expiresAt };
      if (shouldTouch(time(row.last_seen_at), now)) {
        record.expiresAt = nextExpiry(now, createdAt);
        await updateRows(SESSION_TABLE, {
          expires_at: new Date(record.expiresAt).toISOString(),
          last_seen_at: new Date(now).toISOString(),
        }, { filters: { session_hash: sessionHash } }).catch(() => undefined);
      }
    }
  }
  return record;
}

/** 로그아웃: 이 세션을 즉시 무효화한다. */
export async function revokeSession(token: string | null | undefined): Promise<void> {
  if (!token) return;
  await ensureSessionTable();
  await deleteRows(SESSION_TABLE, { filters: { session_hash: hashToken(token) } });
}

/** 운영자 삭제·비밀번호 변경 시: 그 운영자의 모든 세션을 무효화한다. */
export async function revokeOperatorSessions(operatorId: string): Promise<void> {
  await ensureSessionTable();
  await deleteRows(SESSION_TABLE, { filters: { operator_id: operatorId } });
}

/** 쿠키 공통 옵션 */
export function cookieOptions(maxAgeSeconds: number, httpOnly: boolean) {
  return {
    httpOnly,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
