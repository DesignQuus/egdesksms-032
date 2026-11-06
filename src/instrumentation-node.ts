/**
 * Node.js 서버 시작 시 검사(src/instrumentation.ts 에서 Node.js 런타임일 때만 불러온다).
 * 이지데스크 My DB 연결 설정을 검사해, 프로젝트 ID 가 없으면 서버를 띄우지 않는다.
 */
import { assertEgdeskEnvironment } from './lib/egdesk-db';

try {
  assertEgdeskEnvironment();
} catch (error) {
  console.error(`[egdesk] 서버 시작 중단: ${error instanceof Error ? error.message : '설정 오류'}`);
  process.exit(1);
}
