import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createDynamicMockAnalysis, NewsItem } from '@/lib/mockData';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export async function POST(request: NextRequest) {
  let newsItem: NewsItem;
  try {
    newsItem = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { news_id, title, description } = newsItem;
  if (!news_id || !title) {
    return NextResponse.json({ error: 'news_id and title are required' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.log('[Gemini Analyze API] API Key missing. Falling back to Dynamic Mock Data.');
    return NextResponse.json(createDynamicMockAnalysis(newsItem));
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const prompt = `
당신은 고등학교 토론 동아리 및 토론 수업을 지도하는 전문 교사이자 조력자입니다.
제공된 뉴스를 바탕으로 고등학생들이 쉽게 이해하고 토론 수업이나 수행평가에 즉시 활용할 수 있도록 뉴스 분석 보고서를 작성해야 합니다.

[분석 대상 뉴스]
제목: ${title}
설명/요약: ${description}

[요구사항]
다음 JSON 스키마 규격에 완벽히 맞추어 한국어로 답변하세요. 문장은 고등학생 눈높이에 맞게 매우 쉽고 명료해야 합니다.
특히 추천한 각 토론 질문이 뉴스의 실제 사회적 갈등 맥락(뉴스 내용)과 얼마나 정확히 일치하는지 정합성을 엄격하게 교차 검증하고 평가 보고서(news_topic_match_report)에 반영해 주어야 합니다.

스키마 구조:
{
  "summary": ["요약문장1 (2~30자 내외)", "요약문장2", "요약문장3"],
  "debate_suitability": {
    "score": 8, // 1~10점 사이의 정수 (토론 적합도)
    "grade": "적합", // "적합" | "보통" | "부적합" 중 택1
    "reason": "적합도 평가 사유 (50자 이내의 명확한 문장)"
  },
  "core_issues": ["핵심 쟁점1", "핵심 쟁점2"], // 2개 지정
  "recommended_topics": [
    {
      "topic_id": "topic_001",
      "question": "구체적이고 명확한 찬반 대립형 질문 (예: 학교에서 생성형 AI 사용을 허용해야 하는가?)",
      "argument_point": "이 질문의 핵심 논점 요약"
    },
    {
      "topic_id": "topic_002",
      "question": "두 번째 추천 토론 질문",
      "argument_point": "두 번째 질문의 핵심 논점 요약"
    }
  ],
  "news_topic_match_report": [ // [검증 ①] 뉴스 내용과 각 토론 질문 간의 정합성 검증 리포트
    {
      "topic_id": "topic_001", // 위 recommended_topics의 topic_id와 정확히 일칭해야 함
      "question": "topic_001의 question 문장과 동일하게 복사",
      "rating": "높음", // "높음" | "중간" | "낮음" 중 택1
      "reason": "질문이 뉴스의 핵심 쟁점과 어떻게 부합하는지 50자 이내로 쉽게 서술"
    },
    {
      "topic_id": "topic_002",
      "question": "topic_002의 question 문장과 동일하게 복사",
      "rating": "높음", // "높음" | "중간" | "낮음" 중 택1
      "reason": "질문이 뉴스의 핵심 쟁점과 어떻게 부합하는지 50자 이내로 쉽게 서술"
    }
  ]
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsedData = JSON.parse(responseText);

    return NextResponse.json({
      analyzed_news_id: news_id,
      news_title: title,
      ...parsedData,
    });

  } catch (error: unknown) {
    console.error('[Gemini Analyze API Error] Details:', getErrorMessage(error));
    console.log('[Gemini Analyze API] Falling back to Dynamic Mock Data.');
    return NextResponse.json(createDynamicMockAnalysis(newsItem));
  }
}
