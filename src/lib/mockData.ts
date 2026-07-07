// 뉴스 검색 결과 아이템 타입
export interface NewsItem {
  news_id: string;
  title: string;
  original_url: string;
  naver_news_url: string;
  description: string;
  published_date: string;
  publisher: string;
}

// 뉴스 검색 결과 데이터 타입
export interface NewsSearchResponse {
  search_keyword: string;
  total_results: number;
  news_list: NewsItem[];
}

// 뉴스-질문 매칭 검증 아이템 타입
export interface NewsTopicMatchItem {
  topic_id: string;
  question: string;
  rating: '높음' | '중간' | '낮음';
  reason: string;
}

// 뉴스 분석 데이터 타입
export interface NewsAnalysisResponse {
  analyzed_news_id: string;
  news_title: string;
  summary: string[];
  debate_suitability: {
    score: number;
    grade: '적합' | '보통' | '부적합';
    reason: string;
  };
  core_issues: string[];
  recommended_topics: {
    topic_id: string;
    question: string;
    argument_point: string;
  }[];
  news_topic_match_report: NewsTopicMatchItem[]; // [검증 ①] 뉴스 내용 ↔ 토론 질문 매칭 검증
}

// 토론 자료 원본 아이템 타입
export interface RawEvidenceItem {
  evidence_id: string;
  title: string;
  url: string;
  content: string;
  published_date: string;
  publisher: string;
}

// 찬반 분석 논거 아이템 타입 (규칙 7대 요소 모두 포함)
export interface DebateArgumentItem {
  argument_id: string;
  evidence_ref_id: string; // 3. 자료 카드 링크는 원본 URL 바인딩 용도
  perspective: '찬성' | '반대'; // 7-4. 관점
  core_claim: string; // 자료 제목 대용
  easy_explanation: string; // 7-6. 핵심 요약
  debate_point: string; // 7-7. 토론 활용 포인트
  
  // 7-5. 신뢰도 평가 데이터
  reliability_assessment: {
    score_grade: '높음' | '중간' | '낮음';
    domain_type: string;
    reason_easy: string;
  };
  
  // 7-8 & 7-9. 출처와 주장 일치도 및 검증 상태
  alignment_assessment: {
    rating: '높음' | '중간' | '낮음'; // 출처와 주장 일치도
    status: '일치' | '부분 일치' | '확인 필요'; // 검증 상태
    reason_easy: string;
  };

  // [검증 ③] 자료 제목/요약 ↔ AI가 만든 활용 포인트 매칭 검증 결과
  point_assessment: {
    is_point_valid: boolean;
    status_text: '정합성 통과' | '수동 확인 필요';
    reason: string;
  };
}

// 중립/배경 지식 아이템 타입
export interface DebateBackgroundItem {
  bg_id: string;
  evidence_ref_id: string;
  perspective: '중립';
  core_fact: string;
  easy_explanation: string;
  debate_point: string;
  reliability_assessment: {
    score_grade: '높음' | '중간' | '낮음';
    domain_type: string;
    reason_easy: string;
  };
  alignment_assessment: {
    rating: '높음' | '중간' | '낮음';
    status: '일치' | '부분 일치' | '확인 필요';
    reason_easy: string;
  };
  point_assessment: {
    is_point_valid: boolean;
    status_text: '정합성 통과' | '수동 확인 필요';
    reason: string;
  };
}

// 최종 토론 자료 정리 리포트 타입
export interface DebateAnalysisResponse {
  topic_question: string;
  analysis_timestamp: string;
  raw_search_results: RawEvidenceItem[];
  
  // [검증 ②] 토론 질문 ↔ 자료 매칭 검증 리포트
  debate_match_report: {
    rating: '높음' | '중간' | '낮음';
    status: '자료 충분(일치)' | '확인 필요';
    reason: string;
  };

  core_arguments: {
    pros: DebateArgumentItem[];
    cons: DebateArgumentItem[];
    background: DebateBackgroundItem[];
  };
}

// ==================== MOCK DATASETS ====================

export const mockNewsSearchData: Record<string, NewsSearchResponse> = {
  default: {
    search_keyword: "AI 교육",
    total_results: 3,
    news_list: [
      {
        news_id: "news_naver_001",
        title: "교육부, 교실 속 AI 디지털교과서 도입 본격화",
        original_url: "https://www.moe.go.kr/boardCnts/view.do?boardID=294&boardSeq=94522",
        naver_news_url: "https://n.news.naver.com/mnews/article/001/0014567890",
        description: "교육부가 내년부터 초중고 교실에 AI 디지털교과서를 본격 도입하기로 결정했습니다. 이에 따라 찬반 논란도 뜨거워지고 있습니다.",
        published_date: "2026-07-07T10:00:00+09:00",
        publisher: "연합뉴스"
      },
      {
        news_id: "news_naver_002",
        title: "생성형 AI 시대의 교육 혁신, 일선 교사들의 고민은?",
        original_url: "https://www.eduinnews.co.kr/news/articleView.html?idxno=60234",
        naver_news_url: "https://n.news.naver.com/mnews/article/002/0012345678",
        description: "교실 안의 생성형 AI 도입에 대해 교사들은 수업 활용 가능성에는 공감하면서도 학생들의 무분별한 사용 및 표절 대필 우려를 표했습니다.",
        published_date: "2026-07-06T15:30:00+09:00",
        publisher: "에듀인뉴스"
      }
    ]
  }
};

export const mockNewsAnalysisData: Record<string, NewsAnalysisResponse> = {
  "news_naver_001": {
    analyzed_news_id: "news_naver_001",
    news_title: "교육부, 교실 속 AI 디지털교과서 도입 본격화",
    summary: [
      "교육부가 내년부터 초중고교에 AI 디지털교과서를 전격 도입함.",
      "학생 맞춤형 교육 서비스 제공이라는 장점과 디지털 기기 과의존 우려가 상존함.",
      "일선 교육 현장에서는 인프라 보완 및 교사 대상 연수 확대 필요성을 지적함."
    ],
    debate_suitability: {
      score: 9,
      grade: "적합",
      reason: "교육 정책의 급격한 변화를 다루고 있어 시의성이 높으며, '학습 효율성 극대화'와 '인프라 및 부작용 우려'라는 대립적인 가치가 뚜렷하여 토론 논제로 적합합니다."
    },
    core_issues: [
      "AI를 통한 개인 맞춤형 교육의 실효성 여부",
      "디지털 기기 노출 증가에 따른 집중력 저하 및 중독 우려"
    ],
    recommended_topics: [
      {
        topic_id: "topic_001",
        question: "학교에서 생성형 AI 사용을 허용해야 하는가?",
        argument_point: "학생들의 학습 자율성 보장 vs 표절 등 부정행위 방지"
      },
      {
        topic_id: "topic_002",
        question: "AI 디지털교과서 도입은 공교육의 불평등을 완화할 것인가?",
        argument_point: "소외지역 학생 교육 기회 확대 vs 디지털 격차에 따른 불평등 심화"
      }
    ],
    news_topic_match_report: [
      {
        topic_id: "topic_001",
        question: "학교에서 생성형 AI 사용을 허용해야 하는가?",
        rating: "높음",
        reason: "교실 내 디지털교과서 도입에 따른 부작용 및 활용 방향성을 직접 관통하는 핵심 논제이므로 정합성이 높습니다."
      },
      {
        topic_id: "topic_002",
        question: "AI 디지털교과서 도입은 공교육의 불평등을 완화할 것인가?",
        rating: "높음",
        reason: "뉴스 본문에서 다룬 '일선 학교의 인프라 보완 필요성'이 취약계층 교육 격차 이슈와 밀접하게 맞닿아 있습니다."
      }
    ]
  }
};

export const mockDebateAnalysisData: Record<string, DebateAnalysisResponse> = {
  "default": {
    topic_question: "학교에서 생성형 AI 사용을 허용해야 하는가?",
    analysis_timestamp: "2026-07-07T11:24:36+09:00",
    raw_search_results: [
      {
        evidence_id: "tavily_ev_001",
        title: "[시론] 학교 교실 속 생성형 AI, 규제보다 올바른 활용법 가르쳐야",
        url: "https://www.kukinews.com/newsView/kuk202403150021",
        content: "미래 인재 양성을 위해서는 학교에서 생성형 AI 사용을 전면 금지하기보다, 올바른 프롬프트 작성법과 윤리 교육을 병행하여 도구로서 활용하는 방법을 가르쳐야 한다.",
        published_date: "2024-03-15",
        publisher: "쿠키뉴스"
      },
      {
        evidence_id: "tavily_ev_002",
        title: "뉴욕시 공립학교, 챗GPT 사용 금지 해제... '교육적 가치 인정'",
        url: "https://www.yna.co.kr/view/AKR20230519129500009",
        content: "뉴욕시 교육청은 당초 우려와 달리 챗GPT가 학생들의 비판적 사고력을 키우는 도구로 사용될 수 있음을 확인하고 공립학교 내 차단을 해제하기로 결정했다.",
        published_date: "2023-05-19",
        publisher: "연합뉴스"
      },
      {
        evidence_id: "tavily_ev_003",
        title: "학습 도구인가 표절 도구인가... 대학가 챗GPT 과제 대필 논란 확산",
        url: "https://www.chosun.com/national/education/2023/03/02/XYZ12345",
        content: "학생들이 챗GPT로 작성한 보고서를 그대로 제출하는 사례가 늘면서 교사들의 평가 공정성에 비상이 걸렸다. 일부 학교는 사용 금지를 검토 중이다.",
        published_date: "2023-03-02",
        publisher: "조선일보"
      }
    ],
    debate_match_report: {
      rating: "높음",
      status: "자료 충분(일치)",
      reason: "수집된 3건의 주요 웹 자료가 '생성형 AI의 교육 현장 허용 및 금지' 실태와 찬반 논거를 명확하게 담고 있어 논제 분석에 매우 충분합니다."
    },
    core_arguments: {
      pros: [
        {
          argument_id: "pro_arg_001",
          evidence_ref_id: "tavily_ev_001",
          perspective: "찬성",
          core_claim: "학교 교실 속 생성형 AI, 올바른 활용법 교육 필요",
          easy_explanation: "생성형 AI는 무조건 막기보다 올바르게 쓰는 법을 가르칠 때 창의성과 문제 해결력을 키워줄 수 있습니다.",
          debate_point: "찬성 측 입론 단계에서 '금지가 아닌 교육적 통제와 활용의 이점'을 소명하는 논거 카드로 사용하기 좋습니다.",
          reliability_assessment: {
            score_grade: "중간",
            domain_type: "언론사 기고/칼럼",
            reason_easy: "언론사에 실린 전문가의 칼럼으로 내용 자체는 설득력이 높으나, 정부의 공식 통계는 아니므로 중간 신뢰도입니다."
          },
          alignment_assessment: {
            rating: "높음",
            status: "일치",
            reason_easy: "원본 기사의 '교실 속 생성형 AI 활용법 교육 필요' 주장과 완전히 일치합니다."
          },
          point_assessment: {
            is_point_valid: true,
            status_text: "정합성 통과",
            reason: "원문의 '올바른 활용법 가르쳐야 한다'는 핵심 취지와 AI가 제시한 '교육적 통제 활용론' 입론 포인트가 일맥상통합니다."
          }
        },
        {
          argument_id: "pro_arg_002",
          evidence_ref_id: "tavily_ev_002",
          perspective: "찬성",
          core_claim: "뉴욕시 공립학교, 챗GPT 사용 금지 철회",
          easy_explanation: "세계적인 교육 도시인 뉴욕시에서도 챗GPT가 학생들의 비판적 사고력을 길러준다는 점을 인정하고 사용 제한을 풀었습니다.",
          debate_point: "자료의 신뢰도가 높은 구체적인 글로벌 실증 정책 사례로, 찬성 측의 설득력을 배가시키는 반박 방어용 카드로 유용합니다.",
          reliability_assessment: {
            score_grade: "높음",
            domain_type: "해외 교육청 공식 발표 보도",
            reason_easy: "미국 최대 학군인 뉴욕시 교육청의 실제 공식 발표 자료를 바탕으로 한 보도로서 객관적인 신뢰도가 매우 높습니다."
          },
          alignment_assessment: {
            rating: "높음",
            status: "일치",
            reason_easy: "뉴욕시 교육청이 사용 금지를 철회하고 교육적 가치를 인정한 팩트와 논지가 정확히 일치합니다."
          },
          point_assessment: {
            is_point_valid: true,
            status_text: "정합성 통과",
            reason: "뉴욕시의 실제 사용 금지 해제 사실이 활용 포인트인 '실증 정책 사례 제시'와 정확하게 매칭됩니다."
          }
        }
      ],
      cons: [
        {
          argument_id: "con_arg_001",
          evidence_ref_id: "tavily_ev_003",
          perspective: "반대",
          core_claim: "학습 도구인가 표절 도구인가... 과제 대필 확산 우려",
          easy_explanation: "학생들이 챗GPT로 과제를 대필하여 제출하면 공정한 평가가 어렵고 학업 성취도를 정확히 측정할 수 없게 됩니다.",
          debate_point: "반대 측 입론 시 '공정한 평가 마비 및 학습 문해력 저하'를 강력하게 주장할 수 있는 핵심 논거 카드입니다.",
          reliability_assessment: {
            score_grade: "중간",
            domain_type: "국내 주요 언론사 기획 취재",
            reason_easy: "실제 대학과 중고교의 대필 실태 및 교사들의 인터뷰를 담은 상세 취재 기사로 현실성이 높은 정보입니다."
          },
          alignment_assessment: {
            rating: "높음",
            status: "일치",
            reason_easy: "기사에서 챗GPT 과제 대필로 인한 공정성 비상을 직접 다루고 있어, 학교 사용 규제(반대)의 타당한 근거가 됩니다."
          },
          point_assessment: {
            is_point_valid: true,
            status_text: "정합성 통과",
            reason: "원문에서 지적한 과제 대필과 공정성 훼손 현상이 활용 포인트인 '평가 마비 논거 확보'와 정확히 결부됩니다."
          }
        }
      ],
      background: [
        {
          bg_id: "bg_arg_001",
          evidence_ref_id: "tavily_ev_002",
          perspective: "중립",
          core_fact: "해외 교육청의 AI 사용 통제 완화 추세",
          easy_explanation: "뉴욕시 공립학교들은 처음에 표절 우려로 챗GPT를 금지했었으나, 교육적 잠재력을 확인한 후 사용 금지 조치를 전면 철회한 이력이 있습니다.",
          debate_point: "토론의 역사적 흐름이나 국내 도입 논쟁 시 사전 배경 지식 브리핑 용도로 활용하기 좋습니다.",
          reliability_assessment: {
            score_grade: "높음",
            domain_type: "해외 교육청 공식 보도",
            reason_easy: "공식 행정 처분을 기반으로 한 보도이므로 신뢰도가 높습니다."
          },
          alignment_assessment: {
            rating: "높음",
            status: "일치",
            reason_easy: "해외 대학교나 공립학교들의 실제 규제 흐름 변화 사실을 왜곡 없이 정확히 인용했습니다."
          },
          point_assessment: {
            is_point_valid: true,
            status_text: "정합성 통과",
            reason: "규제 철회 이력 팩트와 토론 배경 설명 활용 지침이 서로 잘 조화됩니다."
          }
        }
      ]
    }
  }
};

export function getMockNewsSearch(keyword: string): NewsSearchResponse {
  return {
    ...mockNewsSearchData.default,
    search_keyword: keyword
  };
}

export function getMockNewsAnalysis(newsId: string): NewsAnalysisResponse {
  return mockNewsAnalysisData[newsId] || mockNewsAnalysisData["news_naver_001"];
}

export function getMockDebateAnalysis(topic: string): DebateAnalysisResponse {
  const defaultData = mockDebateAnalysisData.default;
  return {
    ...defaultData,
    topic_question: topic
  };
}

// ==================== DYNAMIC MOCK GENERATORS FOR ROBUSTNESS ====================

export function createDynamicMockAnalysis(news: { news_id: string; title: string; description: string }): NewsAnalysisResponse {
  const title = news.title;
  const desc = news.description || "기사 설명이 충분하지 않아 제목 중심으로 분석했습니다.";
  
  let topic = "해당 이슈";
  
  // 키워드 사전을 고교 토론용 명료한 토픽으로 맵핑
  if (title.includes("저어새") || title.includes("생태") || title.includes("환경") || title.includes("조류")) {
    topic = "생태 보존을 위한 개발 제한";
  } else if (title.includes("AI") || title.includes("디지털") || title.includes("교과서")) {
    topic = "공교육 내 AI 디지털교과서 도입";
  } else if (title.includes("폭염") || title.includes("숲") || title.includes("정원") || title.includes("녹지") || title.includes("공원")) {
    topic = "도심 속 녹지 공간(숲·공원) 의무 조성";
  } else if (title.includes("기본소득") || title.includes("복지")) {
    topic = "전 국민 기본소득 지급 제도";
  } else {
    // 조사 및 형용사형 어미를 일부 제거하는 클리닝
    const cleanedTitle = title
      .replace(/[[\]]/g, '')
      .replace(/(하는|피하는|가장|똑똑한|열다|연다|위한|도입|본격화|기적의|발자취|글로벌)/g, '')
      .trim();
    const words = cleanedTitle.split(' ').filter(w => w.length > 1);
    if (words.length > 0) {
      topic = words.slice(0, 2).join(' ');
    }
  }

  const topicId1 = `topic_${Date.now()}_1`;
  const topicId2 = `topic_${Date.now()}_2`;

  return {
    analyzed_news_id: news.news_id,
    news_title: title,
    summary: [
      `최근 보도된 "${title}" 기사는 사회적으로 높은 관심을 끌고 있습니다. 핵심 내용은 "${desc.slice(0, 80)}"입니다.`,
      `본 사안을 계기로 하여 "${topic}" 사업의 실제 기후 완화 효과와 지자체 예산 투입 효율성에 대한 여론이 팽팽히 대치 중입니다.`,
      `주민들과 일선 행정 전문가들 사이에서는 실질적인 재정 지원 및 환경 가이드라인 제정을 요구하는 목소리가 높습니다.`
    ],
    debate_suitability: {
      score: 8,
      grade: "적합",
      reason: `최신 시사 정책적 변화를 다루어 시의성이 높으며, "${topic}"에 따르는 경제적 비용과 공공 복지 웰빙 가치의 충돌이 뚜렷하여 토론으로 적합합니다.`
    },
    core_issues: [
      `"${topic}"을 통한 도시 열섬 완화 및 친환경 인프라 확충 효과`,
      `"${topic}" 추진 과정에서 발생하는 자치단체의 과도한 재정적 부담 및 사유재산 갈등`
    ],
    recommended_topics: [
      {
        topic_id: topicId1,
        question: `지방자치단체는 도시 열섬 현상 예방을 위해 "${topic}"을 법적으로 의무화해야 하는가?`,
        argument_point: `기후 위기 대응 및 공공 복지 증진 vs 지자체 재정 악화 및 사유지 개발권 침해`
      },
      {
        topic_id: topicId2,
        question: `효과적인 "${topic}" 추진을 위해 개발 제한 구역 및 관련 환경 규제를 완화해야 하는가?`,
        argument_point: `신속한 기후 대책 공간 확보 vs 무분별한 개발 조장 및 제도적 형평성 상실 우려`
      }
    ],
    news_topic_match_report: [
      {
        topic_id: topicId1,
        question: `지방자치단체는 도시 열섬 현상 예방을 위해 "${topic}"을 법적으로 의무화해야 하는가?`,
        rating: "높음",
        reason: `전주시의 도심 숲 조성 정책이 유발하는 공공성 예산 갈등을 직접 관통하여 부합도가 매우 우수합니다.`
      },
      {
        topic_id: topicId2,
        question: `효과적인 "${topic}" 추진을 위해 개발 제한 구역 및 관련 환경 규제를 완화해야 하는가?`,
        rating: "높음",
        reason: `숲과 정원을 조성하는 과정에서 파생될 수 있는 그린벨트 규제 조율 필요성과 결부되어 있어 실효성이 큽니다.`
      }
    ]
  };
}

export function createDynamicMockDebate(topic: string): DebateAnalysisResponse {
  return {
    topic_question: topic,
    analysis_timestamp: new Date().toISOString(),
    raw_search_results: [
      {
        evidence_id: "tavily_ev_001",
        title: `[정책 분석] ${topic}의 도입 현황과 사회적 찬반 쟁점`,
        url: "https://www.debate-compass.org/news/1",
        content: `최근 화두가 된 "${topic}"에 대해 찬성 진영은 도입에 따른 혁신과 성장을 주장하는 반면, 반대 측은 신뢰성 부족 및 공정성 상실 등의 문제를 제기하고 있습니다.`,
        published_date: new Date().toISOString().split('T')[0],
        publisher: "디베이트나침반 포럼"
      },
      {
        evidence_id: "tavily_ev_002",
        title: `[행정 보고서] ${topic} 정착을 위한 정부 가이드라인 수립 방향`,
        url: "https://www.moe.go.kr/policy/1",
        content: `정부와 공공기관의 최신 분석 보고서에 따르면 ${topic} 관련 표준 규정 수립과 안전 대책 마련은 성공적인 사회적 합의의 필수 전제조건입니다.`,
        published_date: new Date().toISOString().split('T')[0],
        publisher: "국가행정연구원"
      }
    ],
    debate_match_report: {
      rating: "높음",
      status: "자료 충분(일치)",
      reason: `논제 "${topic}"와 직접적으로 일치하는 공공 행정 보고서 및 사회 정책 여론 기사가 대조되어 자료가 충분히 수집되었습니다.`
    },
    core_arguments: {
      pros: [
        {
          argument_id: "pro_arg_1",
          evidence_ref_id: "tavily_ev_001",
          perspective: "찬성",
          core_claim: `${topic} 적극 지지 및 전면 추진`,
          easy_explanation: `${topic}은 새로운 성장의 기회를 열어주며, 비판적 문제 해결을 돕는 필수적인 제도적 혁신이자 도구입니다.`,
          debate_point: "찬성 측 기본 입론에서 발전과 실증적 이익을 입증하는 가장 강력한 통계적 근거로 차용하십시오.",
          reliability_assessment: {
            score_grade: "중간",
            domain_type: "정책 분석 포럼 보고",
            reason_easy: "학회 기고문 형태의 분석으로 전반적인 논리가 탄탄하지만 정부 공문서는 아니므로 중간 신뢰도입니다."
          },
          alignment_assessment: {
            rating: "높음",
            status: "일치",
            reason_easy: `논리 구성상 도입 필요성과 긍정적 측면이 왜곡 없이 일치함을 검증 완료했습니다.`
          },
          point_assessment: {
            is_point_valid: true,
            status_text: "정합성 통과",
            reason: "도입 이점 및 활용 취지가 토론 활용 지침에 올바르게 결합되었습니다."
          }
        }
      ],
      cons: [
        {
          argument_id: "con_arg_1",
          evidence_ref_id: "tavily_ev_001",
          perspective: "반대",
          core_claim: `${topic} 무리한 도입 규제 및 제재 필요`,
          easy_explanation: `${topic}은 검증되지 않은 인프라와 신뢰성의 부재로 인해 평가의 왜곡 및 새로운 불평등을 야기할 위험이 높습니다.`,
          debate_point: "반대 입론 단계에서 도입 시 예상되는 치명적인 실무적 부작용과 손실을 공격하는 방어 카드로 쓰기 좋습니다.",
          reliability_assessment: {
            score_grade: "중간",
            domain_type: "정책 분석 포럼 보고",
            reason_easy: "학회 기고문 형태의 분석으로 전반적인 논리가 탄탄하지만 정부 공문서는 아니므로 중간 신뢰도입니다."
          },
          alignment_assessment: {
            rating: "높음",
            status: "일치",
            reason_easy: `부작용 발생 실태 보도 자료와 반대 측 논리가 부합합니다.`
          },
          point_assessment: {
            is_point_valid: true,
            status_text: "정합성 통과",
            reason: "반대 측 논거와 자료 매핑 정합성이 정상적으로 확인되었습니다."
          }
        }
      ],
      background: [
        {
          bg_id: "bg_arg_1",
          evidence_ref_id: "tavily_ev_002",
          perspective: "중립",
          core_fact: `${topic} 가이드라인 제정 움직임`,
          easy_explanation: `${topic}에 대한 국내외 정책 논의 이력과 기본 가이드라인 제정 움직임을 보여주는 배경 정보입니다.`,
          debate_point: "본격적인 토론 시작 전 논의 배경을 청중에게 환기시키는 입론 도입부용 정보입니다.",
          reliability_assessment: {
            score_grade: "높음",
            domain_type: "정부 공식 연구 보고서",
            reason_easy: "정부의 공식 도메인에서 확보한 자료이므로 객관적 신뢰도가 매우 높습니다."
          },
          alignment_assessment: {
            rating: "높음",
            status: "일치",
            reason_easy: `공식 정책 보고서 원문의 배경 지식 요약과 내용이 부합합니다.`
          },
          point_assessment: {
            is_point_valid: true,
            status_text: "정합성 통과",
            reason: "정책 배경 사실관계와 토론 안내 지침이 상호 연계됩니다."
          }
        }
      ]
    }
  };
}
