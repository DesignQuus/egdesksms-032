/**
 * 이지데스크(EGDesk) My DB 서버 전용 어댑터.
 *
 * 프로젝트 루트의 egdesk-helpers.ts 는 이지데스크가 생성·갱신하는 파일이라 직접 고치지 않는다.
 * 그 구버전 헬퍼는 X-EGDesk-Project-Id / X-EGDesk-Env 헤더를 보내지 않아, 이지데스크에서
 * "현재 선택된 프로젝트"(activeProject)의 DB 가 대상이 될 수 있다. 이 파일은 최신 공식 헬퍼
 * (@egdesk/next-api-plugin 1.5.x)와 같은 규격으로 항상 프로젝트·환경을 지정한다.
 *
 * - 호출: POST {EGDesk}/user-data/tools/call  { tool, arguments }
 * - 헤더: X-Api-Key(있을 때), X-EGDesk-Project-Id(필수), X-EGDesk-Env
 * - 주소: EGDESK_MCP_INTERNAL_URL → NEXT_PUBLIC_EGDESK_API_URL → http://localhost:8080
 * - 함수 이름·인자는 egdesk-helpers.ts 와 같아서 import 경로만 바꾸면 된다.
 * - 서버(API 라우트·서버 컴포넌트)에서만 쓴다. 브라우저에서 부르면 오류를 낸다.
 */

export type EgdeskEnvironment = 'development' | 'production';

/** 도구마다 응답 모양이 달라 호출부에서 해석한다(egdesk-helpers.ts 의 Promise<EgdeskResult> 와 같은 계약). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EgdeskResult = any;

export interface EgdeskConnection {
  apiUrl: string;
  apiKey?: string;
  projectId: string;
  environment: EgdeskEnvironment;
}

const PROJECT_ID_MESSAGE =
  'NEXT_PUBLIC_EGDESK_PROJECT_ID(이지데스크 My DB 프로젝트 ID)가 없습니다. ' +
  '.env.local 에 설정하세요. 프로젝트 ID 없이 호출하면 다른 프로젝트의 DB 가 대상이 될 수 있습니다.';

/** 환경변수에서 연결 정보를 읽는다. 프로젝트 ID 가 없으면 오류. */
export function egdeskConnection(env: NodeJS.ProcessEnv = process.env): EgdeskConnection {
  const projectId = env.NEXT_PUBLIC_EGDESK_PROJECT_ID?.trim();
  if (!projectId) throw new Error(PROJECT_ID_MESSAGE);
  const declared = env.NEXT_PUBLIC_EGDESK_ENV?.trim();
  const environment: EgdeskEnvironment =
    declared === 'production' || declared === 'development'
      ? declared
      : env.NODE_ENV === 'production'
        ? 'production'
        : 'development';
  const apiUrl = (
    env.EGDESK_MCP_INTERNAL_URL?.trim() ||
    env.NEXT_PUBLIC_EGDESK_API_URL?.trim() ||
    'http://localhost:8080'
  ).replace(/\/$/, '');
  return { apiUrl, apiKey: env.NEXT_PUBLIC_EGDESK_API_KEY?.trim() || undefined, projectId, environment };
}

/** 서버 시작 시 검사(src/instrumentation.ts). 값은 출력하지 않는다. */
export function assertEgdeskEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  const connection = egdeskConnection(env);
  try {
    const url = new URL(connection.apiUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error();
  } catch {
    throw new Error('EGDESK_MCP_INTERNAL_URL / NEXT_PUBLIC_EGDESK_API_URL 은 HTTP(S) 주소여야 합니다.');
  }
}

/** 공식 헬퍼 parseEgdeskMcpToolResponse 와 같은 해석 + 값을 바로 담은 응답도 처리. */
export async function parseEgdeskResponse(response: Response): Promise<EgdeskResult> {
  const result: EgdeskResult = await response.json().catch(() => null);

  if (result && typeof result === 'object' && result.success === false) {
    throw new Error(
      typeof result.error === 'string' ? result.error : result.error != null ? String(result.error) : 'Tool call failed',
    );
  }
  if (!response.ok) {
    const fromBody =
      result && typeof result === 'object'
        ? typeof result.error === 'string'
          ? result.error
          : typeof result.message === 'string'
            ? result.message
            : ''
        : '';
    throw new Error(fromBody || `HTTP ${response.status}: ${response.statusText}`);
  }
  if (!result || result.success !== true) {
    throw new Error(result && typeof result.error === 'string' ? result.error : 'Tool call failed');
  }

  // 이지데스크는 MCP 형식({ result: { content: [{ text }] } })과 값을 바로 담은 형식을 모두 쓴다.
  if (!Array.isArray(result.result?.content)) {
    if (result.result?.isError) throw new Error('EGDesk tool failed');
    return result.result ?? null;
  }
  const text = result.result.content[0]?.text;
  if (!text) {
    if (result.result.isError) throw new Error('EGDesk tool failed');
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    if (result.result.isError) throw new Error(text);
    return text;
  }
}

/** 테스트에서 바꿔 끼울 수 있는 fetch. */
let fetchImpl: typeof fetch = (...args) => fetch(...args);
export function setEgdeskFetchForTesting(impl: typeof fetch | undefined) {
  fetchImpl = impl ?? ((...args) => fetch(...args));
}

export async function callUserDataTool(toolName: string, args: Record<string, unknown> = {}): Promise<EgdeskResult> {
  if (typeof window !== 'undefined') {
    throw new Error('egdesk-db 는 서버 전용입니다. 브라우저에서는 /api 라우트를 거쳐 호출하세요.');
  }
  const connection = egdeskConnection();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-EGDesk-Project-Id': connection.projectId,
    'X-EGDesk-Env': connection.environment,
  };
  if (connection.apiKey) headers['X-Api-Key'] = connection.apiKey;

  let response: Response;
  try {
    response = await fetchImpl(`${connection.apiUrl}/user-data/tools/call`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tool: toolName, arguments: args }),
      cache: 'no-store',
    });
  } catch {
    throw new Error(
      '이지데스크 My DB 에 연결할 수 없습니다. 이지데스크 System → MCP Server 에서 MCP HTTP(8080)가 Running 인지 확인하세요.',
    );
  }
  return parseEgdeskResponse(response);
}

// ---------------------------------------------------------------------------
// egdesk-helpers.ts 와 같은 이름·인자의 My DB 함수
// ---------------------------------------------------------------------------

export async function queryTable(
  tableName: string,
  options: {
    filters?: Record<string, string>;
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
  } = {},
) {
  return callUserDataTool('user_data_query', { tableName, ...options });
}

export async function searchTable(tableName: string, searchQuery: string, limit: number = 50) {
  return callUserDataTool('user_data_search', { tableName, searchQuery, limit });
}

export async function aggregateTable(
  tableName: string,
  column: string,
  aggregateFunction: 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT',
  options: { filters?: Record<string, string>; groupBy?: string } = {},
) {
  return callUserDataTool('user_data_aggregate', { tableName, column, function: aggregateFunction, ...options });
}

/** 읽기 전용(SELECT) SQL. */
export async function executeSQL(query: string) {
  return callUserDataTool('user_data_sql_query', { query });
}

export async function listTables() {
  return callUserDataTool('user_data_list_tables', {});
}

export async function getTableSchema(tableName: string) {
  return callUserDataTool('user_data_get_schema', { tableName });
}

export async function createTable(
  displayName: string,
  schema: Array<{
    name: string;
    type: 'TEXT' | 'INTEGER' | 'REAL' | 'DATE';
    notNull?: boolean;
    defaultValue?: unknown;
  }>,
  options?: {
    description?: string;
    tableName?: string;
    uniqueKeyColumns?: string[];
    duplicateAction?: 'skip' | 'update' | 'allow' | 'replace-date-range';
  },
) {
  return callUserDataTool('user_data_create_table', { displayName, schema, ...options });
}

export async function insertRows(tableName: string, rows: Array<Record<string, unknown>>) {
  return callUserDataTool('user_data_insert_rows', { tableName, rows });
}

export async function updateRows(
  tableName: string,
  updates: Record<string, unknown>,
  options: { ids?: number[]; filters?: Record<string, string> },
) {
  return callUserDataTool('user_data_update_rows', { tableName, updates, ...options });
}

export async function deleteRows(
  tableName: string,
  options: { ids?: number[]; filters?: Record<string, string> },
) {
  return callUserDataTool('user_data_delete_rows', { tableName, ...options });
}

export async function deleteTable(tableName: string) {
  return callUserDataTool('user_data_delete_table', { tableName });
}

export async function renameTable(tableName: string, newTableName: string, newDisplayName?: string) {
  return callUserDataTool('user_data_rename_table', { tableName, newTableName, newDisplayName });
}
