/**
 * 서버 시작 시 1회 실행(Next.js instrumentation). 이지데스크 My DB 연결 설정을 검사해,
 * 프로젝트 ID 가 없으면 서버를 띄우지 않는다(다른 프로젝트 DB 를 건드리지 않기 위한 안전장치).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { assertEgdeskEnvironment } = await import('./lib/egdesk-db');
  try {
    assertEgdeskEnvironment();
  } catch (error) {
    console.error(`[egdesk] 서버 시작 중단: ${error instanceof Error ? error.message : '설정 오류'}`);
    process.exit(1);
  }
}
