import { NextResponse } from 'next/server';
import { queryTable, executeSQL, listTables } from '@/lib/egdesk-db';
import fs from 'fs';
import path from 'path';

// SELECT 쿼리만 통과시키고 데이터 파괴적인 쿼리는 원천 차단하는 유효성 검사 함수
function isSafeSelectQuery(sql: string): boolean {
  const normalized = sql.trim().toUpperCase();
  // 오직 SELECT 쿼리만 허용
  if (!normalized.startsWith('SELECT')) {
    return false;
  }
  // 위험 키워드가 SQL 내에 포함되어 있는지 검사
  const dangerousKeywords = [
    'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 
    'REPLACE', 'TRUNCATE', 'RENAME', 'GRANT', 'REVOKE'
  ];
  return !dangerousKeywords.some(keyword => {
    // 단어 경계(\b)를 기준으로 위험 키워드가 들어있는지 정규식 검사
    const regex = new RegExp(`\\b${keyword}\\b`, 'I');
    return regex.test(normalized);
  });
}

export async function POST(req: Request) {
  try {
    const { prompt, chatHistory = [], localStorageContext = {} } = await req.json();

    if (!prompt) {
      return NextResponse.json({ success: false, error: '질문(prompt)이 누락되었습니다.' }, { status: 400 });
    }

    // 1. DB에서 구글 AI API 키 및 선택된 모델 조회
    const settingsRes = await queryTable('system_settings', { filters: { key: 'google_ai_api_key' } });
    const apiKey = settingsRes.rows && settingsRes.rows.length > 0 ? settingsRes.rows[0].value : null;

    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: '구글 AI API 키가 시스템에 등록되지 않았습니다. [설정 > AI 설정] 또는 DB의 system_settings 테이블에서 google_ai_api_key 값을 먼저 입력해 주세요.' 
      }, { status: 400 });
    }

    // 1-2. DB에서 구글 AI 모델명 조회 (없다면 3.5 기본값 적용)
    const modelRes = await queryTable('system_settings', { filters: { key: 'google_ai_model' } });
    const selectedModel = modelRes.rows && modelRes.rows.length > 0 && modelRes.rows[0].value
      ? modelRes.rows[0].value
      : 'gemini-3.5-flash';

    // 2. 현재 DB에 어떤 테이블들이 존재하는지 동적으로 리스트업
    let dbTablesInfo = '알 수 없음';
    try {
      const tablesResult = await listTables();
      if (tablesResult && tablesResult.tables) {
        dbTablesInfo = JSON.stringify(tablesResult.tables);
      } else if (Array.isArray(tablesResult)) {
        dbTablesInfo = JSON.stringify(tablesResult);
      } else {
        dbTablesInfo = JSON.stringify(tablesResult);
      }
    } catch (e) {
      console.warn('테이블 목록 조회 실패 (에이전트에 스키마 가이드 제한됨):', e);
    }

    // 3. STEP 1: 사용자의 질문을 분석하여 DB 조회가 필요한지 확인하고 SELECT 쿼리 생성
    const step1SystemPrompt = `
You are the database analysis engine of "EasyBot" (이지봇), a premium management assistant.
Your task is to analyze the user's inquiry and determine if it requires querying the SQLite database.

If it requires database queries:
- Write a valid SQLite SELECT query.
- You can query ANY table (including system_settings, customers, orders, transactions, message_logs, coupons, etc.).
- Ensure that the query is strictly a SELECT statement. Never suggest UPDATE, INSERT, or DELETE.
- Use explicit column names or '*' where appropriate.
- ALWAYS output in JSON format only.

Available Database Tables Info:
${dbTablesInfo}

Your response must be in valid JSON format ONLY:
{
  "requiresQuery": true,
  "sql": "SELECT COUNT(*) as total_customers FROM customers",
  "reason": "To count the number of registered customers in the database.",
  "requiresManual": false
}

If no database query is needed (e.g. general greeting, chit-chat, explaining browser state):
{
  "requiresQuery": false,
  "sql": null,
  "reason": "General conversation or browser context only.",
  "requiresManual": false
}

If the user is asking about how to use the system, menus, manuals, or guides:
{
  "requiresQuery": false,
  "sql": null,
  "reason": "User is asking for system usage instructions.",
  "requiresManual": true
}
`;

    const step1Response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: step1SystemPrompt }] },
        contents: [
          ...chatHistory.map((msg: any) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
          })),
          { role: 'user', parts: [{ text: prompt }] }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1 // SQL 생성의 정확성을 극대화하기 위해 낮은 온도로 설정
        }
      })
    });

    if (!step1Response.ok) {
      const err = await step1Response.json();
      throw new Error(err.error?.message || 'Gemini Step-1 API 호출 중 오류가 발생했습니다.');
    }

    const step1Data = await step1Response.json();
    const step1Text = step1Data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    let sqlPlan = { requiresQuery: false, sql: null as string | null, reason: "", requiresManual: false };
    try {
      sqlPlan = JSON.parse(step1Text);
    } catch (e) {
      console.error('SQL Plan JSON 파싱 실패:', step1Text);
    }

    // 4. SQL 실행 (필요한 경우)
    let sqlQueryResult: any = null;
    let sqlError: string | null = null;

    if (sqlPlan.requiresQuery && sqlPlan.sql) {
      const sqlToExecute = sqlPlan.sql;
      
      // 보안 안전성 검증
      if (!isSafeSelectQuery(sqlToExecute)) {
        sqlError = `보안 제한: 오직 데이터 조회(SELECT) 쿼리만 안전하게 실행할 수 있습니다. 생성된 쿼리는 실행이 거부되었습니다: "${sqlToExecute}"`;
      } else {
        try {
          // SQLite DB raw 쿼리 실행
          const queryRes = await executeSQL(sqlToExecute);
          sqlQueryResult = queryRes;
        } catch (err: any) {
          console.error('SQL 실행 오류:', err);
          sqlError = err.message || String(err);
        }
      }
    }

    // 매뉴얼 지식 베이스 읽기 (RAG)
    let manualContext = "";
    if (sqlPlan.requiresManual) {
      try {
        const manualPath = path.join(process.cwd(), 'src', 'docs', 'egdesk-manual.md');
        manualContext = fs.readFileSync(manualPath, 'utf8');
      } catch (err) {
        console.error('매뉴얼 파일 읽기 실패:', err);
      }
    }

    // 5. STEP 2: 최종 대답 합성 (질문 + 로컬저장소 컨텍스트 + SQL 결과)
    const step2SystemPrompt = `
당신은 이지데스크(EGDESK) 프로젝트의 지능형 관리자 비서 "이지봇"(EasyBot)입니다.
사용자에게 친근하면서도 매우 전문적인 한글 어투로 대답해 주세요.

당신은 다음 리소스를 모두 활용하여 질문에 답할 수 있습니다:
1. 사용자 브라우저의 로컬 저장소(LocalStorage) 상태 스냅샷: 사용자의 현재 UI 상태, 토큰, 발송 대기 메시지 등이 들어있습니다.
2. 서버 SQLite 데이터베이스 조회 결과: 테이블 스키마나 쿼리를 직접 수행해 추출해 낸 최신 비즈니스 데이터입니다.
3. 시스템 공식 매뉴얼: 사용법 및 가이드 안내가 필요할 때 지식 베이스로 사용합니다.

답변 작성 규칙:
- 반드시 한국어로 대답해 주세요. (gemini_added_memories 규칙 필수 준수)
- 코드나 SQL 쿼리를 설명해야 할 때는 백틱(\`\`)을 활용해 가시성 높은 마크다운 코드로 표기해 주세요.
- 표(Table), 리스트, 볼드체 등을 활용하여 프리미엄 SaaS의 위젯 안에서 읽기 편한 완벽한 텍스트 구조로 만들어 주세요.
- 만약 SQL 쿼리가 실패했거나 오류가 있었다면, 관리자가 원인을 파악할 수 있도록 SQL 오류 메시지를 보여주며 원인 진단을 도와주세요.
- 챗봇 자체에서 데이터를 임의로 수정/삭제(UPDATE/DELETE)할 수 없음을 인지하되, SELECT를 통한 깊이 있는 데이터 분석 및 인사이트 제공에 집중해 주세요.

${manualContext ? `\n============================\n[공식 시스템 매뉴얼 지식 베이스 (RAG)]\n${manualContext}\n\n-> 지시사항: 사용자가 시스템 사용법, 메뉴 구조, 가이드라인 등을 묻고 있습니다. 지어내지 말고, 위 매뉴얼 내용에 기반하여 가장 정확하고 친절하게 대답해 주세요.\n============================\n` : ''}
[LocalStorage 상태 스냅샷]:
${JSON.stringify(localStorageContext, null, 2)}

[SQLite DB 실행된 쿼리 및 결과]:
- 쿼리 실행 요구 여부: ${sqlPlan.requiresQuery ? '예' : '아니오'}
- 시도한 SQL 쿼리: ${sqlPlan.sql || '없음'}
- 쿼리 실행 결과: ${sqlQueryResult ? JSON.stringify(sqlQueryResult, null, 2) : '결과 없음'}
- 쿼리 에러 내용: ${sqlError || '에러 없음'}
`;

    const step2Response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: step2SystemPrompt }] },
        contents: [
          ...chatHistory.map((msg: any) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
          })),
          { role: 'user', parts: [{ text: prompt }] }
        ],
        generationConfig: {
          temperature: 0.5
        }
      })
    });

    if (!step2Response.ok) {
      const err = await step2Response.json();
      throw new Error(err.error?.message || 'Gemini Step-2 API 호출 중 오류가 발생했습니다.');
    }

    const step2Data = await step2Response.json();
    const finalAnswer = step2Data.candidates?.[0]?.content?.parts?.[0]?.text || "답변을 생성하는 데 실패했습니다.";

    return NextResponse.json({
      success: true,
      answer: finalAnswer,
      sql: sqlPlan.sql,
      sqlSuccess: sqlPlan.requiresQuery ? !sqlError : null,
      sqlError
    });

  } catch (error: any) {
    console.error('EasyBot API Error:', error);
    return NextResponse.json({ success: false, error: error.message || '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
