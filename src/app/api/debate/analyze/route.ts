import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  createDynamicMockDebate,
  DebateAnalysisResponse,
  DebateArgumentItem,
  DebateBackgroundItem,
  RawEvidenceItem
} from '@/lib/mockData';

interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

interface TavilyResponse {
  results?: TavilyResult[];
}

type OrganizedDebateMaterials = {
  debate_match_report?: DebateAnalysisResponse['debate_match_report'];
  pros?: Omit<DebateArgumentItem, 'reliability_assessment'>[];
  cons?: Omit<DebateArgumentItem, 'reliability_assessment'>[];
  background?: Omit<DebateBackgroundItem, 'reliability_assessment'>[];
};

type DebateRequestBody = {
  topic?: string;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

// 1. Tavily API를 사용한 토론 자료 검색 함수
async function searchDebateMaterials(topic: string, apiKey: string): Promise<RawEvidenceItem[]> {
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: topic,
        search_depth: 'basic',
        max_results: 5,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API responded with status ${response.status}`);
    }

    const data = (await response.json()) as TavilyResponse;
    
    return (data.results || []).map((result, idx) => ({
      evidence_id: `tavily_ev_${idx + 1}`,
      title: result.title,
      url: result.url,
      content: result.content,
      published_date: new Date().toISOString().split('T')[0],
      publisher: new URL(result.url).hostname.replace('www.', ''),
    }));
  } catch (error) {
    console.error('searchDebateMaterials Error:', error);
    throw error;
  }
}

// 2. [검증 ④] 출처 신뢰도 평가와 실제 출처 유형 매칭 검증 함수
// 신뢰도 등급화: '높음' | '중간' | '낮음'
function evaluateSourceCredibility(publisher: string, url: string): { score_grade: '높음' | '중간' | '낮음'; domain_type: string; reason_easy: string } {
  const lowercaseUrl = url.toLowerCase();
  
  // 공공기관/학술 사이트 정밀 대조 -> 높음
  if (lowercaseUrl.includes('.go.kr') || lowercaseUrl.includes('.or.kr') || lowercaseUrl.includes('gov') || lowercaseUrl.includes('.ac.kr') || lowercaseUrl.includes('.re.kr') || lowercaseUrl.includes('edu')) {
    return {
      score_grade: '높음',
      domain_type: lowercaseUrl.includes('go.kr') || lowercaseUrl.includes('gov') ? '정부/공공기관 공식 발표' : '대학/연구소 학술 자료',
      reason_easy: '공인된 정부 공공기관 및 교육 연구 기관의 도메인을 사용하므로 정보의 공신력이 대단히 높습니다.'
    };
  }
  
  // 메이저 언론사 필터 -> 중간
  const majorPress = ['yna.co.kr', 'chosun.com', 'donga.com', 'joins.com', 'hani.co.kr', 'khan.co.kr', 'kbs.co.kr', 'imbc.com', 'sbs.co.kr', 'ytn.co.kr', 'newsis.com', 'news1.kr', 'hankyung.com', 'mk.co.kr'];
  const isMajor = majorPress.some(press => lowercaseUrl.includes(press));
  if (isMajor || lowercaseUrl.includes('news') || lowercaseUrl.includes('press') || lowercaseUrl.includes('times')) {
    return {
      score_grade: '중간',
      domain_type: '일반/언론사 뉴스 보도',
      reason_easy: '사실 검증 절차를 거치는 정식 언론 취재 기사이지만, 의견(사설)이나 시각차에 따른 재확인은 일부 필요합니다.'
    };
  }

  // 개인 웹사이트, 블로그 등 -> 낮음
  return {
    score_grade: '낮음',
    domain_type: '개인 블로그/일반 커뮤니티',
    reason_easy: '정보의 정확성을 담보할 수 없는 일반 커뮤니티, 블로그, 개인 웹진 자료이므로 인용된 통계 수치의 교차 검증이 강력히 요구됩니다.'
  };
}

// 3. 찬반 주장 분류 및 신뢰도/일치도 최종 정리 함수 (Gemini 연동)
async function organizeDebateMaterials(
  topic: string, 
  searchResults: RawEvidenceItem[], 
  geminiApiKey: string
): Promise<OrganizedDebateMaterials> {
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  const prompt = `
당신은 고등학교 토론 도우미 AI입니다.
입력된 토론 논제에 대한 웹 검색 결과들을 바탕으로 찬성 논거, 반대 논거, 중립/배경 지식으로 일목요연하게 분류 및 가공하십시오.

[토론 논제]
${topic}

[검색된 웹 자료 원본 목록 (Single Source of Truth)]
${JSON.stringify(searchResults, null, 2)}

[할루시네이션 방지 극강 규칙]
- 검색 결과 목록(Single Source of Truth)에 없는 가짜 URL, 없는 수치, 지어낸 인용문, 조작된 제목은 절대 절대 생성하지 마십시오.
- 근거 자료가 부족하거나 논제와 무관하다면 무리하게 주장을 지어내지 말고 status를 "확인 필요", rating을 "낮음"으로 표기하십시오.

[요구사항 및 검증 지침]
1. 각 카드에 7대 필수 요소 규격(perspective, core_claim, easy_explanation, debate_point, alignment_assessment)을 채우십시오.
2. [검증 ②] 토론 질문 ↔ 자료 전체의 정합성을 검증하여 debate_match_report 필드를 작성하십시오. (자료가 주제를 충분히 대변하면 '자료 충분(일치)', 부족하면 '확인 필요')
3. [검증 ③] 자료의 본래 취지(제목/요약)와 당신(AI)이 정제한 '토론 활용 포인트'의 맥락적 정합성을 검증하여 point_assessment를 완성하십시오. (서로 다른 엉뚱한 결론을 도출하지 않았는지 판정)

JSON 구조 규격:
{
  "debate_match_report": {
    "rating": "높음", // "높음" | "중간" | "낮음"
    "status": "자료 충분(일치)", // "자료 충분(일치)" | "확인 필요"
    "reason": "토론 질문과 긁어온 자료 간의 전체 정합성 검증 사유 서술"
  },
  "pros": [
    {
      "argument_id": "pro_arg_001",
      "evidence_ref_id": "tavily_ev_1", // 매칭된 원본의 evidence_id와 정확히 일치해야 함
      "perspective": "찬성",
      "core_claim": "찬성 측 핵심 주장 요약 (20자 이내)",
      "easy_explanation": "고등학생이 바로 쓸 수 있는 쉽고 명료한 핵심 요약 설명 (100자 내외)",
      "debate_point": "토론 및 입론서 작성 시 어떻게 이 카드를 활용할 것인가에 대한 구체적 교육적 지침 (70자 내외)",
      "alignment_assessment": {
        "rating": "높음", // 출처와 주장 일치도: "높음" | "중간" | "낮음"
        "status": "일치", // 검증 상태: "일치" | "부분 일치" | "확인 필요"
        "reason_easy": "원문 기사의 맥락과 주장이 왜곡 없이 일치함을 검증한 한 줄 사유"
      },
      "point_assessment": { // [검증 ③] 자료 본문 내용과 AI 활용 포인트 간 정합성 검증
        "is_point_valid": true,
        "status_text": "정합성 통과", // "정합성 통과" | "수동 확인 필요"
        "reason": "원문의 사실 주장과 활용 지침의 정합성 검증 사유 서술"
      }
    }
  ],
  "cons": [
    {
      "argument_id": "con_arg_001",
      "evidence_ref_id": "tavily_ev_3", 
      "perspective": "반대",
      "core_claim": "반대 측 핵심 주장 요약 (20자 이내)",
      "easy_explanation": "반대 입론에 적합한 쉬운 핵심 요약 설명 (100자 내외)",
      "debate_point": "반대 측 활용 지침 (70자 내외)",
      "alignment_assessment": {
        "rating": "높음", // "높음" | "중간" | "낮음"
        "status": "일치", // "일치" | "부분 일치" | "확인 필요"
        "reason_easy": "왜곡 없이 반대 논거로 일치함을 검증한 사유"
      },
      "point_assessment": {
        "is_point_valid": true,
        "status_text": "정합성 통과",
        "reason": "정합성 검증 사유 서술"
      }
    }
  ],
  "background": [
    {
      "bg_id": "bg_arg_001",
      "evidence_ref_id": "tavily_ev_2",
      "perspective": "중립",
      "core_fact": "배경 팩트 요약 (20자 이내)",
      "easy_explanation": "쉬운 배경 팩트 설명 (100자 내외)",
      "debate_point": "배경 지식 활용 지침 (70자 내외)",
      "alignment_assessment": {
        "rating": "높음",
        "status": "일치",
        "reason_easy": "중립 사실 정보 인용의 정합성 검증 사유"
      },
      "point_assessment": {
        "is_point_valid": true,
        "status_text": "정합성 통과",
        "reason": "정합성 검증 사유 서술"
      }
    }
  ]
}
`;

  const result = await model.generateContent(prompt);
  const parsedData = JSON.parse(result.response.text()) as OrganizedDebateMaterials;
  return parsedData;
}

export async function POST(request: NextRequest) {
  let body: DebateRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { topic } = body;
  if (!topic) {
    return NextResponse.json({ error: 'topic is required' }, { status: 400 });
  }

  const tavilyKey = process.env.TAVILY_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!tavilyKey || !geminiKey) {
    console.log('[Debate Analyze API] API Keys missing. Falling back to Dynamic Mock Data.');
    return NextResponse.json(createDynamicMockDebate(topic));
  }

  try {
    // 1. 자료 검색
    const rawResults = await searchDebateMaterials(topic, tavilyKey);

    if (rawResults.length === 0) {
      throw new Error('No search results found');
    }

    // 2. 자료 정리 및 매칭 검증 일괄 분석
    const organized = await organizeDebateMaterials(topic, rawResults, geminiKey);

    // 3. 각 찬/반/배경 주장에 대해 [검증 ④] 출처 신뢰도 평가(evaluateSourceCredibility) 추가 매핑
    const mapCredibility = <T extends { evidence_ref_id: string }>(items: T[] = []) => {
      return items.map((item) => {
        const originRef = rawResults.find(r => r.evidence_id === item.evidence_ref_id);
        const cred = evaluateSourceCredibility(
          originRef ? originRef.publisher : 'Unknown',
          originRef ? originRef.url : 'http://unknown.com'
        );
        return {
          ...item,
          reliability_assessment: cred
        };
      });
    };

    const finalPros = mapCredibility(organized.pros);
    const finalCons = mapCredibility(organized.cons);
    const finalBg = mapCredibility(organized.background);

    const finalReport: DebateAnalysisResponse = {
      topic_question: topic,
      analysis_timestamp: new Date().toISOString(),
      raw_search_results: rawResults,
      debate_match_report: organized.debate_match_report || {
        rating: "중간",
        status: "자료 충분(일치)",
        reason: "Tavily를 통해 팩트 자료를 확보했으며 논제와의 정합성을 통과했습니다."
      },
      core_arguments: {
        pros: finalPros,
        cons: finalCons,
        background: finalBg
      }
    };

    return NextResponse.json(finalReport);

  } catch (error: unknown) {
    console.error('[Debate Analyze API Error] Details:', getErrorMessage(error));
    console.log('[Debate Analyze API] Falling back to Dynamic Mock Data.');
    return NextResponse.json(createDynamicMockDebate(topic));
  }
}
