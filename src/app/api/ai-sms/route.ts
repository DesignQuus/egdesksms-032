import { NextResponse } from 'next/server';
import { queryTable } from '@/lib/egdesk-db';

export async function POST(req: Request) {
  try {
    const { prompt, customers } = await req.json();

    // DB에서 API 키 조회
    const settingsRes = await queryTable('system_settings', { filters: { key: 'google_ai_api_key' } });
    const apiKey = settingsRes.rows && settingsRes.rows.length > 0 ? settingsRes.rows[0].value : null;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: '대시보드에서 구글 AI API 키를 먼저 등록해주세요.' }, { status: 400 });
    }
    
    if (!prompt) {
      return NextResponse.json({ success: false, error: 'Prompt is missing' }, { status: 400 });
    }

    // 구글 Gemini에 전송할 시스템 프롬프트 구성
    const systemPrompt = `
You are an expert CRM marketing assistant for a small business.
Your goal is to parse the user's request and automatically do two things:
1. Identify the target customers based on the user's prompt by looking at the provided JSON list of customers (matching tags, names, etc.).
2. Write a highly engaging, professional SMS marketing message based on the user's intent. Do not include placeholders like [고객명] unless the system supports {고객명} dynamic variables. You should use {이름} or similar if you want dynamic replacement, but prefer generic if unsure. In this system, you can use {고객명} to automatically replace the customer's name.
Make sure to keep the message concise (under 200 characters if possible).

Here is the customer database (JSON):
${JSON.stringify(customers.map((c: any) => ({ id: c.id, tags: c.tags, memo: c.memo, name: c.name })))}

You MUST output your response in valid JSON format ONLY, exactly like this:
{
  "targetIds": [123, 456],
  "messageContent": "여름맞이 20% 특별 세일! {고객명}님을 위한 특별한 혜택..."
}
`;

    // Fetch call to Google Gemini API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [
          { parts: [{ text: prompt }] }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Google Gemini API Error');
    }

    const data = await response.json();
    let responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const resultJson = JSON.parse(responseText);

    return NextResponse.json({ 
      success: true, 
      targetIds: resultJson.targetIds || [],
      messageContent: resultJson.messageContent || ""
    });

  } catch (error) {
    console.error('AI Error:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }

}
