import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

// 컨텍스트 타입
interface ChatContext {
  periodId: string;
  level: string;
  goal: string;
  motto: string;
  todos: { content: string; isCompleted: boolean; category?: string }[];
  routines: { content: string; isCompleted: boolean; targetCount?: number; currentCount?: number; category?: string }[];
  record?: {
    content: string;
    mood?: string;
    highlights: string[];
    gratitude: string[];
  };
}

export async function POST(req: NextRequest) {
  try {
    const { message, context, history, apiKey: clientApiKey } = await req.json() as {
      message: string;
      context: ChatContext;
      history: { role: 'user' | 'assistant'; content: string }[];
      apiKey?: string;
    };

    // API 키 결정 (클라이언트 > 환경변수)
    const geminiApiKey = clientApiKey || process.env.GEMINI_API_KEY;

    // API 키 확인
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력하세요.' },
        { status: 500 }
      );
    }

    // API 키로 클라이언트 생성
    const ai = new GoogleGenAI({
      apiKey: geminiApiKey,
    });

    // 시스템 프롬프트 생성
    const systemPrompt = buildSystemPrompt(context);

    // 대화 히스토리 구성 (Gemini 형식)
    const contents = [
      ...history.map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ];

    // Gemini API 호출
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents as any,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 1024,
      },
    });

    // 응답 추출
    const reply = response.text || '';

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: '채팅 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 시스템 프롬프트 생성
function buildSystemPrompt(context: ChatContext): string {
  const { periodId, level, goal, motto, todos, routines, record } = context;

  // 레벨 한글 변환
  const levelLabels: Record<string, string> = {
    THIRTY_YEAR: '30년',
    FIVE_YEAR: '5년',
    YEAR: '연간',
    QUARTER: '분기',
    MONTH: '월간',
    WEEK: '주간',
    DAY: '일간',
  };

  // 할일 목록 텍스트
  const todoText = todos.length > 0
    ? todos.map(t => `- [${t.isCompleted ? '완료' : '미완'}] ${t.content}${t.category ? ` (${t.category})` : ''}`).join('\n')
    : '(없음)';

  // 루틴 목록 텍스트
  const routineText = routines.length > 0
    ? routines.map(r => {
        const countInfo = r.targetCount ? ` (${r.currentCount ?? r.targetCount}/${r.targetCount})` : '';
        return `- [${r.isCompleted ? '완료' : '진행중'}] ${r.content}${countInfo}${r.category ? ` (${r.category})` : ''}`;
      }).join('\n')
    : '(없음)';

  // 기록 정보
  let recordText = '';
  if (record) {
    recordText = `
## 이 기간의 기록
- 기분: ${record.mood || '미입력'}
- 내용: ${record.content || '(작성된 내용 없음)'}
- 하이라이트: ${record.highlights.length > 0 ? record.highlights.join(', ') : '(없음)'}
- 감사한 것: ${record.gratitude.length > 0 ? record.gratitude.join(', ') : '(없음)'}
`;
  }

  return `당신은 사용자의 인생 계획과 일정 관리를 도와주는 친절한 AI 어시스턴트입니다.

## 현재 사용자가 보고 있는 기간
- 기간 ID: ${periodId}
- 레벨: ${levelLabels[level] || level}

## 이 기간의 목표
- 목표: ${goal || '(미설정)'}
- 좌우명: ${motto || '(미설정)'}

## 할일 목록
${todoText}

## 루틴 목록
${routineText}
${recordText}

## 역할
1. 사용자의 계획을 분석하고 조언해주세요
2. 목표 달성을 위한 구체적인 제안을 해주세요
3. 동기부여와 격려를 해주세요
4. 필요하면 계획의 개선점을 제안해주세요

## 주의사항
- 한국어로 대화하세요
- 간결하고 친근하게 답변하세요
- 이모지를 적절히 사용해도 좋습니다
- 사용자의 데이터를 기반으로 개인화된 조언을 해주세요
`;
}
