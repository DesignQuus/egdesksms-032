/**
 * 서버 시작 시 1회 실행(Next.js instrumentation). Node.js 런타임에서만 시작 검사를 불러온다
 * (Next.js 권장 방식: Node 전용 코드를 별도 파일로 분리해 Edge 분석 경고를 피한다).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
