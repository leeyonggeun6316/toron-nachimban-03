'use client';

import React, { useState, useEffect } from 'react';
import { 
  NewsSearchResponse, 
  NewsItem, 
  NewsAnalysisResponse, 
  DebateAnalysisResponse
} from '../lib/mockData';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

export default function Home() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [currentScreen, setCurrentScreen] = useState<'HOME' | 'NEWS_SEARCH' | 'NEWS_ANALYZE' | 'DEBATE_RESULT'>('HOME');
  
  // 데이터 및 입력 상태 관리
  const [keyword, setKeyword] = useState('');
  const [topic, setTopic] = useState('');
  const [newsResults, setNewsResults] = useState<NewsSearchResponse | null>(null);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [newsAnalysis, setNewsAnalysis] = useState<NewsAnalysisResponse | null>(null);
  const [debateResults, setDebateResults] = useState<DebateAnalysisResponse | null>(null);
  
  // UX 제어 상태
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showPerspectiveData, setShowPerspectiveData] = useState(false);
  const [exportText, setExportText] = useState('');

  // 토론 준비 체크리스트 상태
  const [checklist, setChecklist] = useState([
    { id: 1, text: '찬성 측 입론의 핵심 근거를 2개 이상 확실하게 파악했나요?', checked: false },
    { id: 2, text: '반대 측의 예상 반론에 대비할 반박 자료를 준비했나요?', checked: false },
    { id: 3, text: '인용할 자료와 통계의 출처 신뢰도를 확인했나요?', checked: false },
    { id: 4, text: '토론에 사용될 핵심 전문 용어에 대한 명확한 정의를 내렸나요?', checked: false }
  ]);

  // 테마 토글 핸들러
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // 1. Naver API 뉴스 검색
  const handleSearchNews = async (searchWord: string) => {
    if (!searchWord.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/news/search?keyword=${encodeURIComponent(searchWord)}`);
      if (!res.ok) throw new Error('뉴스 검색에 실패했습니다.');
      const data: NewsSearchResponse = await res.json();
      setNewsResults(data);
      setCurrentScreen('NEWS_SEARCH');
    } catch (err: unknown) {
      setError(getErrorMessage(err) || '네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Gemini API 뉴스 토론 분석
  const handleAnalyzeNews = async (news: NewsItem) => {
    setSelectedNews(news);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/news/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(news)
      });
      if (!res.ok) throw new Error('뉴스 토론 가치 분석에 실패했습니다.');
      const data: NewsAnalysisResponse = await res.json();
      setNewsAnalysis(data);
      setCurrentScreen('NEWS_ANALYZE');
    } catch (err: unknown) {
      setError(getErrorMessage(err) || '뉴스 분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Tavily + Gemini 토론 자료 검색 및 찬반 분류
  const handleAnalyzeDebate = async (debateTopic: string) => {
    if (!debateTopic.trim()) return;
    setTopic(debateTopic);
    setShowPerspectiveData(false);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/debate/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: debateTopic })
      });
      if (!res.ok) throw new Error('자료 수집 및 일치도 평가에 실패했습니다.');
      const data: DebateAnalysisResponse = await res.json();
      setDebateResults(data);
      
      // 내보내기 텍스트 사전 빌드
      buildExportText(data);
      setCurrentScreen('DEBATE_RESULT');
    } catch (err: unknown) {
      setError(getErrorMessage(err) || '자료 분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 내보내기 마크다운 텍스트 조립
  const buildExportText = (data: DebateAnalysisResponse) => {
    let report = `=========================================\n`;
    report += `🧭 토론나침반 - 토론 자료 정합성 검증 보고서\n`;
    report += `일시: ${new Date(data.analysis_timestamp).toLocaleString('ko-KR')}\n`;
    report += `논제: ${data.topic_question}\n`;
    report += `=========================================\n\n`;

    report += `🛡️ 4단계 교차 검증 통계\n`;
    report += `- [검증 ①] 뉴스-질문 부합도: 뉴스 분석 화면 참고\n`;
    report += `- [검증 ②] 질문-자료 전체 정합성: ${data.debate_match_report.status} (${data.debate_match_report.rating})\n`;
    report += `- 사유: ${data.debate_match_report.reason}\n\n`;

    report += `👍 찬성 측 근거 자료 (Pros)\n`;
    report += `-----------------------------------------\n`;
    data.core_arguments.pros.forEach((item, idx) => {
      const ref = data.raw_search_results.find(r => r.evidence_id === item.evidence_ref_id);
      report += `[자료 ${idx+1}] ${item.core_claim}\n`;
      report += `- 출처: ${ref?.publisher || '확인필요'} / URL: ${ref?.url || '확인필요'}\n`;
      report += `- 핵심 요약: ${item.easy_explanation}\n`;
      report += `- 토론 활용 포인트: ${item.debate_point}\n`;
      report += `- 신뢰도 등급: ${item.reliability_assessment.score_grade} (${item.reliability_assessment.domain_type})\n`;
      report += `- 출처-주장 일치도: ${item.alignment_assessment.status} (${item.alignment_assessment.rating})\n\n`;
    });

    report += `👎 반대 측 근거 자료 (Cons)\n`;
    report += `-----------------------------------------\n`;
    data.core_arguments.cons.forEach((item, idx) => {
      const ref = data.raw_search_results.find(r => r.evidence_id === item.evidence_ref_id);
      report += `[자료 ${idx+1}] ${item.core_claim}\n`;
      report += `- 출처: ${ref?.publisher || '확인필요'} / URL: ${ref?.url || '확인필요'}\n`;
      report += `- 핵심 요약: ${item.easy_explanation}\n`;
      report += `- 토론 활용 포인트: ${item.debate_point}\n`;
      report += `- 신뢰도 등급: ${item.reliability_assessment.score_grade} (${item.reliability_assessment.domain_type})\n`;
      report += `- 출처-주장 일치도: ${item.alignment_assessment.status} (${item.alignment_assessment.rating})\n\n`;
    });

    report += `💡 중립 및 배경자료 (Background)\n`;
    report += `-----------------------------------------\n`;
    data.core_arguments.background.forEach((item, idx) => {
      const ref = data.raw_search_results.find(r => r.evidence_id === item.evidence_ref_id);
      report += `[배경자료 ${idx+1}] ${item.core_fact}\n`;
      report += `- 출처: ${ref?.publisher || '확인필요'} / URL: ${ref?.url || '확인필요'}\n`;
      report += `- 핵심 요약: ${item.easy_explanation}\n`;
      report += `- 토론 활용 포인트: ${item.debate_point}\n`;
      report += `- 신뢰도 등급: ${item.reliability_assessment.score_grade} (${item.reliability_assessment.domain_type})\n\n`;
    });

    report += `=========================================\n`;
    report += `본 자료는 '토론나침반' AI와 신뢰할 수 있는 웹 검색을 토대로 안전하게 수집된 정보입니다.\n`;
    setExportText(report);
  };

  const handleCheckboxToggle = (id: number) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(exportText);
    alert('검증 완료된 토론 리포트가 클립보드에 복사되었습니다! 발표 자료나 수행평가 보고서에 활용하세요.');
  };

  const resetToHome = () => {
    setKeyword('');
    setTopic('');
    setNewsResults(null);
    setSelectedNews(null);
    setNewsAnalysis(null);
    setDebateResults(null);
    setError(null);
    setCurrentScreen('HOME');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      
      {/* 1. NCP 스타일 다크 헤더 */}
      <header style={{
        borderBottom: '1px solid var(--border-color)',
        padding: '18px 0',
        backgroundColor: 'var(--bg-dark-hero)',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div onClick={resetToHome} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.9rem' }}>🧭</span>
            <div>
              <h1 className="gradient-title" style={{ fontSize: '1.45rem', margin: 0, letterSpacing: '-0.5px', fontWeight: 800 }}>토론나침반</h1>
              <p style={{ fontSize: '0.75rem', color: '#8c98a4', margin: 0 }}>고등학교 토론·발표의 길잡이</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              onClick={() => setShowGuideModal(true)}
              className="btn-secondary"
              style={{ 
                padding: '8px 14px', 
                fontSize: '0.85rem', 
                backgroundColor: 'rgba(255,255,255,0.06)', 
                color: '#ffffff', 
                borderColor: 'rgba(255,255,255,0.15)' 
              }}
            >
              📖 논제 작성 가이드
            </button>
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="btn-secondary" 
              style={{ 
                padding: '8px 14px', 
                fontSize: '0.85rem',
                backgroundColor: 'rgba(255,255,255,0.06)', 
                color: '#ffffff', 
                borderColor: 'rgba(255,255,255,0.15)' 
              }}
            >
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </div>
      </header>

      {/* 2. 에러 및 로딩 알럿 */}
      {error && (
        <div className="container" style={{ marginTop: '16px' }}>
          <div style={{
            backgroundColor: 'rgba(255, 59, 48, 0.1)',
            border: '1px solid var(--color-con)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            color: 'var(--text-primary)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.2rem' }}>⚠️</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{error}</span>
            </div>
            <button onClick={() => setError(null)} style={{ background: 'none', color: 'var(--text-primary)', fontWeight: 'bold' }}>✕</button>
          </div>
        </div>
      )}

      {loading && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(3, 11, 30, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          color: '#ffffff',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div className="spinner"></div>
          <div style={{ fontSize: '1rem', fontWeight: 600, letterSpacing: '-0.3px' }}>AI와 공신력 있는 웹 자료 교차 검증 중...</div>
        </div>
      )}

      {/* 3. 메인 콘텐츠 바디 */}
      <main style={{ flex: 1, padding: '40px 0' }}>
        
        {/* ==================== SCREEN 1: HOME (NCP Hero & Gateway Layout) ==================== */}
        {currentScreen === 'HOME' && (
          <div>
            
            {/* NCP 스타일 히어로 영역 */}
            <div className="ncp-hero-box" style={{ marginTop: '-40px', marginBottom: '40px' }}>
              <div className="container" style={{ textAlign: 'center' }}>
                <span style={{ 
                  fontSize: '0.85rem', 
                  fontWeight: 700, 
                  color: 'var(--accent-color)', 
                  backgroundColor: 'rgba(0,128,255,0.12)', 
                  padding: '5px 12px', 
                  borderRadius: '20px',
                  display: 'inline-block',
                  marginBottom: '16px'
                }}>
                  HIGH SCHOOL DEBATE COMPASS
                </span>
                <h2 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.25 }}>
                  고등학교 발표·토론 수업을 위한<br/>
                  <span className="gradient-title">가장 확실하고 똑똑한 자료 가이드</span>
                </h2>
                <p style={{ color: '#8c98a4', fontSize: '1.05rem', marginTop: '16px', maxWidth: '650px', marginLeft: 'auto', marginRight: 'auto' }}>
                  네이버 검색과 Tavily API를 연동하여 실제 팩트 기반의 출처만을 엄격하게 매칭합니다. 할루시네이션(가짜 자료) 없는 신뢰성 높은 토론 발표 리포트를 확보해 보세요.
                </p>
              </div>
            </div>

            {/* 게이트웨이 2개 기능 카드 배치 */}
            <div className="container">
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '32px',
                marginTop: '10px'
              }}>
                
                {/* 1번 기능: 뉴스로 토론 주제 찾기 */}
                <div className="glass-panel" style={{
                  padding: '36px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '24px',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(0,128,255,0.08)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontSize: '1.8rem',
                    color: 'var(--accent-color)'
                  }}>
                    📰
                  </div>
                  
                  <div>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '8px' }}>뉴스로 토론 주제 찾기</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6 }}>
                      실시간 최신 네이버 기사를 검색하여 시사성 있는 토론 논점과 AI 3줄 요약, 토론 추천 질문을 자동으로 생성합니다.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <input 
                      type="text" 
                      placeholder="예: AI 교육, 기후변화, 로봇"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchNews(keyword)}
                    />
                    <button onClick={() => handleSearchNews(keyword)} className="btn-primary" style={{ flexShrink: 0 }}>
                      검색 🔍
                    </button>
                  </div>
                </div>

                {/* 2번 기능: 토론 주제로 자료 찾기 */}
                <div className="glass-panel" style={{
                  padding: '36px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '24px',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(0,210,196,0.08)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontSize: '1.8rem',
                    color: 'var(--color-bg-info)'
                  }}>
                    ⚖️
                  </div>

                  <div>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '8px' }}>직접 주제로 토론 자료 찾기</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6 }}>
                      준비하고 있는 토론 주제를 직접 기입하면, 웹 검색(Tavily) 팩트 피드를 분류해 찬반 가이드 카드로 다듬어 줍니다.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <input 
                      type="text" 
                      placeholder="예: 학교 내 생성형 AI 사용을 허용해야 한다"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAnalyzeDebate(topic)}
                    />
                    <button onClick={() => handleAnalyzeDebate(topic)} className="btn-primary" style={{ flexShrink: 0, background: 'var(--color-bg-info)', boxShadow: '0 4px 14px rgba(0, 210, 196, 0.25)' }}>
                      자료수집 📡
                    </button>
                  </div>
                </div>

              </div>
            </div>
            
          </div>
        )}

        {/* ==================== SCREEN 2: NEWS SEARCH RESULTS (NCP Featured list) ==================== */}
        {currentScreen === 'NEWS_SEARCH' && newsResults && (
          <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={resetToHome} className="btn-secondary">← 메인으로</button>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>뉴스 검색 결과: &quot;{keyword}&quot;</h2>
              </div>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>총 {newsResults.news_list.length}개의 관련 기사를 찾았습니다.</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {newsResults.news_list.map((news) => (
                <div key={news.news_id} className="glass-panel" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span style={{ fontSize: '1.4rem' }}>📰</span>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{news.title}</h3>
                    </div>
                    <span style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      fontWeight: 600
                    }}>{news.publisher}</span>
                  </div>
                  
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.94rem', paddingLeft: '30px', lineHeight: 1.6 }}>{news.description}</p>
                  
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    flexWrap: 'wrap', 
                    gap: '12px', 
                    borderTop: '1px solid var(--border-color)', 
                    paddingTop: '16px', 
                    marginTop: '4px',
                    paddingLeft: '30px'
                  }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>발행일: {new Date(news.published_date).toLocaleDateString('ko-KR')}</span>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <a href={news.naver_news_url} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                        뉴스 원문 읽기 🔗
                      </a>
                      <button onClick={() => handleAnalyzeNews(news)} className="btn-primary" style={{ padding: '8px 18px', fontSize: '0.85rem', boxShadow: 'none' }}>
                        토론 가치 분석하기 🤖
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== SCREEN 3: NEWS ANALYSIS RESULTS SCREEN ==================== */}
        {currentScreen === 'NEWS_ANALYZE' && newsAnalysis && (
          <div className="container">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <button onClick={() => setCurrentScreen('NEWS_SEARCH')} className="btn-secondary">← 뉴스 목록으로</button>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>뉴스 분석 리포트</h2>
            </div>

            <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ color: 'var(--accent-color)', fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '1px' }}>NEWS REPORT ANALYSIS</span>
                  <h3 style={{ fontSize: '1.55rem', fontWeight: 800, marginTop: '4px', letterSpacing: '-0.3px' }}>{newsAnalysis.news_title}</h3>
                </div>
                {selectedNews?.naver_news_url && (
                  <a 
                    href={selectedNews.naver_news_url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn-secondary" 
                    style={{ padding: '10px 16px', fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    📰 뉴스 원문 읽기 🔗
                  </a>
                )}
              </div>

              {/* 요약 */}
              <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '24px', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--accent-color)' }}>
                <h4 style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '14px', color: 'var(--text-primary)' }}>💡 3줄 핵심 요약</h4>
                <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {newsAnalysis.summary.map((sum, i) => (
                    <li key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.94rem' }}>{sum}</li>
                  ))}
                </ul>
              </div>

              {/* 적합도 및 쟁점 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h4 style={{ fontWeight: 700, fontSize: '0.95rem' }}>🎯 토론 적합도 평가</h4>
                    <span style={{
                      backgroundColor: 
                        newsAnalysis.debate_suitability.grade === '적합' ? 'rgba(0, 128, 255, 0.12)' :
                        newsAnalysis.debate_suitability.grade === '보통' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 59, 48, 0.12)',
                      color:
                        newsAnalysis.debate_suitability.grade === '적합' ? '#0080ff' :
                        newsAnalysis.debate_suitability.grade === '보통' ? '#f59e0b' : '#ff3b30',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '0.78rem',
                      fontWeight: 'bold'
                    }}>{newsAnalysis.debate_suitability.grade} ({newsAnalysis.debate_suitability.score}점/10점)</span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                    {newsAnalysis.debate_suitability.reason}
                  </p>
                </div>

                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '24px' }}>
                  <h4 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '14px' }}>⚖️ 주요 갈등 지점(쟁점)</h4>
                  <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {newsAnalysis.core_issues.map((issue, idx) => (
                      <li key={idx} style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{issue}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 추천 토론 질문 리스트 (뉴스-질문 매칭 검증 추가) */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                <h4 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🙋‍♀️</span> 이런 질문으로 발표나 토론을 시작해 볼까요?
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {newsAnalysis.recommended_topics.map((topicItem) => {
                    // [검증 ①] 뉴스 내용 ↔ 토론 질문 매칭 대조
                    const matchReport = newsAnalysis.news_topic_match_report?.find(r => r.topic_id === topicItem.topic_id);
                    
                    return (
                      <div key={topicItem.topic_id} style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>논점: {topicItem.argument_point}</span>
                            <strong style={{ fontSize: '1.15rem', color: 'var(--text-primary)' }}>Q. {topicItem.question}</strong>
                          </div>
                          <button 
                            onClick={() => handleAnalyzeDebate(topicItem.question)} 
                            className="btn-primary" 
                            style={{ padding: '10px 20px', fontSize: '0.85rem', boxShadow: 'none' }}
                          >
                            이 주제로 자료 수집하기 →
                          </button>
                        </div>

                        {/* [검증 ①] 매칭 검증 UI 노출 */}
                        {matchReport && (
                          <div style={{
                            borderTop: '1px dotted var(--border-color)',
                            paddingTop: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.82rem'
                          }}>
                            <span style={{
                              backgroundColor: 
                                matchReport.rating === '높음' ? 'rgba(0, 210, 196, 0.12)' :
                                matchReport.rating === '중간' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 59, 48, 0.12)',
                              color: 
                                matchReport.rating === '높음' ? '#00d2c4' :
                                matchReport.rating === '중간' ? '#f59e0b' : '#ff3b30',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 'bold'
                            }}>
                              검증: 뉴스부합도 {matchReport.rating}
                            </span>
                            <span style={{ color: 'var(--text-secondary)' }}>{matchReport.reason}</span>
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ==================== SCREEN 4: DEBATE EVIDENCE RESULTS SCREEN ==================== */}
        {currentScreen === 'DEBATE_RESULT' && debateResults && (
          <div className="container">
            
            {/* 상단 액션 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={() => newsAnalysis ? setCurrentScreen('NEWS_ANALYZE') : setCurrentScreen('HOME')} className="btn-secondary">← 뒤로가기</button>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>실시간 팩트 체크 및 매칭 리포트</span>
                  <h2 style={{ fontSize: '1.45rem', fontWeight: '800', letterSpacing: '-0.3px' }}>논제: {debateResults.topic_question}</h2>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowExportModal(true)} className="btn-primary" style={{ background: 'var(--accent-color)', boxShadow: 'none' }}>
                  📥 검증된 리포트 다운로드
                </button>
              </div>
            </div>

            {/* [검증 ②] 토론 질문 ↔ 자료전체 매칭 검증 배너 */}
            {debateResults.debate_match_report && (
              <div style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1.5px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '18px 24px',
                marginBottom: '32px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                boxShadow: 'var(--card-shadow)'
              }}>
                <span style={{ fontSize: '2rem' }}>🛡️</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '0.95rem' }}>[검증 ②] 질문-자료 정합성 검증 완료</strong>
                    <span style={{
                      backgroundColor: debateResults.debate_match_report.status === '자료 충분(일치)' ? 'rgba(0, 210, 196, 0.12)' : 'rgba(255, 59, 48, 0.12)',
                      color: debateResults.debate_match_report.status === '자료 충분(일치)' ? '#00d2c4' : '#ff3b30',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold'
                    }}>
                      {debateResults.debate_match_report.status} (연관도: {debateResults.debate_match_report.rating})
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>{debateResults.debate_match_report.reason}</p>
                </div>
              </div>
            )}

            {/* 3단 분류 그리드 또는 팩트 우선 공개 모드 */}
            {!showPerspectiveData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                
                {/* 팩트 우선 학습 배너 */}
                <div style={{
                  backgroundColor: 'rgba(0, 128, 255, 0.03)',
                  border: '1.5px dashed var(--accent-color)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '28px 32px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '12px'
                }}>
                  <span style={{ fontSize: '2.4rem' }}>🧐</span>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>선입견 없는 팩트 대조 학습 모드</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '600px', lineHeight: 1.6 }}>
                      토론에 대한 찬반 편향을 예방하기 위해 논증 카드를 일시적으로 숨겨두었습니다.<br/>
                      아래의 **중립 사실 및 배경 자료**를 먼저 정독하며 팩트 체킹을 마친 뒤, 찬반 카드를 해제해 보세요!
                    </p>
                  </div>
                </div>

                {/* 중립 및 배경 자료 단독 노출 (2단 그리드 형태로 쾌적하게 렌더링) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '28px' }}>
                  
                  {/* 왼쪽: 중립 및 배경 자료 목록 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{
                      backgroundColor: 'var(--bg-bg-info-card)',
                      border: '1.5px solid var(--border-bg-info)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: 'var(--color-bg-info)'
                    }}>
                      <span style={{ fontSize: '1.2rem' }}>💡</span>
                      <strong style={{ fontSize: '1rem', fontWeight: 600 }}>중립 및 배경 지식</strong>
                    </div>

                    {debateResults.core_arguments.background.length === 0 ? (
                      <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <span>자료 부족 (확인 필요) ⚠️</span>
                      </div>
                    ) : (
                      debateResults.core_arguments.background.map((item) => {
                        const origin = debateResults.raw_search_results.find(r => r.evidence_id === item.evidence_ref_id);
                        return (
                          <div key={item.bg_id} className="glass-panel" style={{ padding: '24px', borderLeft: '3.5px solid var(--color-bg-info)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-bg-info)', backgroundColor: 'var(--bg-bg-info-card)', padding: '2px 6px', borderRadius: '4px' }}>
                                관점: {item.perspective}
                              </span>
                              <span style={{
                                fontSize: '0.7rem',
                                backgroundColor: 
                                  item.reliability_assessment.score_grade === '높음' ? 'rgba(0, 210, 196, 0.12)' :
                                  item.reliability_assessment.score_grade === '중간' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 59, 48, 0.12)',
                                color:
                                  item.reliability_assessment.score_grade === '높음' ? '#00d2c4' :
                                  item.reliability_assessment.score_grade === '중간' ? '#f59e0b' : '#ff3b30',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 600
                              }}>
                                신뢰도: {item.reliability_assessment.score_grade}
                              </span>
                            </div>
                            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>{item.core_fact}</h4>
                            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                              <span style={{ fontWeight: 600, display: 'block', marginBottom: '2px', color: 'var(--text-primary)' }}>📝 핵심 요약</span>
                              {item.easy_explanation}
                            </div>
                            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-tertiary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                              <span style={{ fontWeight: 600, display: 'block', marginBottom: '2px', color: 'var(--accent-color)' }}>💡 토론 활용 포인트</span>
                              {item.debate_point}
                            </div>
                            {origin && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>출처: {origin.publisher}</span>
                                <a href={origin.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--color-bg-info)', textDecoration: 'none', fontWeight: 500 }}>
                                  원문 URL 링크 ↗
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* 오른쪽: 실시간 수집된 뉴스 피드 원본 목록 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1.5px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: 'var(--text-secondary)'
                    }}>
                      <span style={{ fontSize: '1.2rem' }}>🌐</span>
                      <strong style={{ fontSize: '1rem', fontWeight: 600 }}>수집된 웹 뉴스 피드 원본 목록</strong>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {debateResults.raw_search_results.map((resItem) => (
                        <div key={resItem.evidence_id} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--accent-color)', fontWeight: 600 }}>{resItem.publisher}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>수집일: {resItem.published_date}</span>
                          </div>
                          <h5 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{resItem.title}</h5>
                          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 }}>
                            {resItem.content}
                          </p>
                          <a href={resItem.url} target="_blank" rel="noopener noreferrer" style={{ alignSelf: 'flex-end', fontSize: '0.75rem', color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 500 }}>
                            원문 읽기 ↗
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* 해제 액션 배너 (NCP 3D 블루 그라데이션 박스 모티브) */}
                <div style={{
                  background: 'linear-gradient(135deg, #0080ff, #00c6ff)',
                  borderRadius: 'var(--radius-md)',
                  padding: '32px 24px',
                  textAlign: 'center',
                  boxShadow: '0 10px 25px rgba(0, 128, 255, 0.15)',
                  marginTop: '12px'
                }}>
                  <p style={{ color: '#ffffff', fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px', letterSpacing: '-0.3px' }}>
                    🚦 중립 팩트와 수집 원본 탐독을 다 마치셨다면, 찬반 진영의 입론 전략 카드를 활성화하세요!
                  </p>
                  <button 
                    onClick={() => setShowPerspectiveData(true)} 
                    className="btn-secondary" 
                    style={{
                      backgroundColor: '#ffffff',
                      color: '#0080ff',
                      border: 'none',
                      padding: '14px 32px',
                      fontSize: '0.95rem',
                      fontWeight: 800,
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.12)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    찬성 / 반대 논리 카드 잠금 해제 🔓
                  </button>
                </div>

              </div>
            ) : (
              <div className="debate-columns-grid">
                
                {/* 1. 찬성 근거 (Pros) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div style={{
                    backgroundColor: 'var(--bg-pro-card)',
                    border: '1.5px solid var(--border-pro)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--color-pro)'
                  }}>
                    <span style={{ fontSize: '1.25rem' }}>👍</span>
                    <strong style={{ fontSize: '1rem', fontWeight: 700 }}>찬성 측 핵심 자료</strong>
                  </div>

                  {debateResults.core_arguments.pros.length === 0 ? (
                    <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <span>자료 부족 (확인 필요) ⚠️</span>
                    </div>
                  ) : (
                    debateResults.core_arguments.pros.map((item) => {
                      const origin = debateResults.raw_search_results.find(r => r.evidence_id === item.evidence_ref_id);
                      return (
                        <div key={item.argument_id} className="glass-panel" style={{ padding: '24px', borderLeft: '3.5px solid var(--color-pro)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-pro)', backgroundColor: 'var(--bg-pro-card)', padding: '2px 6px', borderRadius: '4px' }}>
                              관점: {item.perspective}
                            </span>
                            
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{
                                fontSize: '0.7rem',
                                backgroundColor: 
                                  item.reliability_assessment.score_grade === '높음' ? 'rgba(0, 128, 255, 0.12)' :
                                  item.reliability_assessment.score_grade === '중간' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 59, 48, 0.12)',
                                color:
                                  item.reliability_assessment.score_grade === '높음' ? '#0080ff' :
                                  item.reliability_assessment.score_grade === '중간' ? '#f59e0b' : '#ff3b30',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 600
                              }} title={item.reliability_assessment.reason_easy}>
                                신뢰도: {item.reliability_assessment.score_grade}
                              </span>
                              
                              <span style={{
                                fontSize: '0.7rem',
                                backgroundColor: 'var(--bg-tertiary)',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border-color)',
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}>
                                일치도: {item.alignment_assessment.rating}
                              </span>

                              <span style={{
                                fontSize: '0.7rem',
                                backgroundColor: 
                                  item.alignment_assessment.status === '일치' ? 'rgba(0, 210, 196, 0.12)' :
                                  item.alignment_assessment.status === '부분 일치' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 59, 48, 0.12)',
                                color:
                                  item.alignment_assessment.status === '일치' ? '#00d2c4' :
                                  item.alignment_assessment.status === '부분 일치' ? '#f59e0b' : '#ff3b30',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 700
                              }}>
                                검증: {item.alignment_assessment.status}
                              </span>
                            </div>
                          </div>

                          <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>{item.core_claim}</h4>
                          
                          <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                            <span style={{ fontWeight: 600, display: 'block', marginBottom: '2px', color: 'var(--text-primary)' }}>📝 핵심 요약</span>
                            {item.easy_explanation}
                          </div>

                          <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-tertiary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                            <span style={{ fontWeight: 600, display: 'block', marginBottom: '2px', color: 'var(--accent-color)' }}>💡 토론 활용 포인트</span>
                            {item.debate_point}
                          </div>

                          {item.point_assessment && (
                            <div style={{
                              fontSize: '0.75rem',
                              padding: '6px 10px',
                              backgroundColor: item.point_assessment.is_point_valid ? 'rgba(0, 210, 196, 0.06)' : 'rgba(255, 59, 48, 0.06)',
                              border: '1px dashed',
                              borderColor: item.point_assessment.is_point_valid ? 'rgba(0, 210, 196, 0.2)' : 'rgba(255, 59, 48, 0.2)',
                              borderRadius: '4px',
                              color: item.point_assessment.is_point_valid ? '#00d2c4' : '#ff3b30'
                            }}>
                              <strong>[검증 ③] {item.point_assessment.status_text}</strong>: {item.point_assessment.reason}
                            </div>
                          )}

                          {origin && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>출처: {origin.publisher}</span>
                              <a href={origin.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--color-pro)', textDecoration: 'none', fontWeight: 500 }}>
                                원문 URL 링크 ↗
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* 2. 반대 근거 (Cons) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div style={{
                    backgroundColor: 'var(--bg-con-card)',
                    border: '1.5px solid var(--border-con)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--color-con)'
                  }}>
                    <span style={{ fontSize: '1.25rem' }}>👎</span>
                    <strong style={{ fontSize: '1rem', fontWeight: 700 }}>반대 측 핵심 자료</strong>
                  </div>

                  {debateResults.core_arguments.cons.length === 0 ? (
                    <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <span>자료 부족 (확인 필요) ⚠️</span>
                    </div>
                  ) : (
                    debateResults.core_arguments.cons.map((item) => {
                      const origin = debateResults.raw_search_results.find(r => r.evidence_id === item.evidence_ref_id);
                      return (
                        <div key={item.argument_id} className="glass-panel" style={{ padding: '24px', borderLeft: '3.5px solid var(--color-con)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-con)', backgroundColor: 'var(--bg-con-card)', padding: '2px 6px', borderRadius: '4px' }}>
                              관점: {item.perspective}
                            </span>
                            
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{
                                fontSize: '0.7rem',
                                backgroundColor: 
                                  item.reliability_assessment.score_grade === '높음' ? 'rgba(0, 128, 255, 0.12)' :
                                  item.reliability_assessment.score_grade === '중간' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 59, 48, 0.12)',
                                color:
                                  item.reliability_assessment.score_grade === '높음' ? '#0080ff' :
                                  item.reliability_assessment.score_grade === '중간' ? '#f59e0b' : '#ff3b30',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 600
                              }} title={item.reliability_assessment.reason_easy}>
                                신뢰도: {item.reliability_assessment.score_grade}
                              </span>
                              
                              <span style={{
                                fontSize: '0.7rem',
                                backgroundColor: 'var(--bg-tertiary)',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border-color)',
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}>
                                일치도: {item.alignment_assessment.rating}
                              </span>

                              <span style={{
                                fontSize: '0.7rem',
                                backgroundColor: 
                                  item.alignment_assessment.status === '일치' ? 'rgba(0, 210, 196, 0.12)' :
                                  item.alignment_assessment.status === '부분 일치' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 59, 48, 0.12)',
                                color:
                                  item.alignment_assessment.status === '일치' ? '#00d2c4' :
                                  item.alignment_assessment.status === '부분 일치' ? '#f59e0b' : '#ff3b30',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 700
                              }}>
                                검증: {item.alignment_assessment.status}
                              </span>
                            </div>
                          </div>

                          <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>{item.core_claim}</h4>
                          
                          <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                            <span style={{ fontWeight: 600, display: 'block', marginBottom: '2px', color: 'var(--text-primary)' }}>📝 핵심 요약</span>
                            {item.easy_explanation}
                          </div>

                          <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-tertiary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                            <span style={{ fontWeight: 600, display: 'block', marginBottom: '2px', color: 'var(--accent-color)' }}>💡 토론 활용 포인트</span>
                            {item.debate_point}
                          </div>

                          {item.point_assessment && (
                            <div style={{
                              fontSize: '0.75rem',
                              padding: '6px 10px',
                              backgroundColor: item.point_assessment.is_point_valid ? 'rgba(0, 210, 196, 0.06)' : 'rgba(255, 59, 48, 0.06)',
                              border: '1px dashed',
                              borderColor: item.point_assessment.is_point_valid ? 'rgba(0, 210, 196, 0.2)' : 'rgba(255, 59, 48, 0.2)',
                              borderRadius: '4px',
                              color: item.point_assessment.is_point_valid ? '#00d2c4' : '#ff3b30'
                            }}>
                              <strong>[검증 ③] {item.point_assessment.status_text}</strong>: {item.point_assessment.reason}
                            </div>
                          )}

                          {origin && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>출처: {origin.publisher}</span>
                              <a href={origin.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--color-con)', textDecoration: 'none', fontWeight: 500 }}>
                                원문 URL 링크 ↗
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* 3. 배경자료 (Backgrounds) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div style={{
                    backgroundColor: 'var(--bg-bg-info-card)',
                    border: '1.5px solid var(--border-bg-info)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--color-bg-info)'
                  }}>
                    <span style={{ fontSize: '1.25rem' }}>💡</span>
                    <strong style={{ fontSize: '1rem', fontWeight: 700 }}>중립 및 배경 자료</strong>
                  </div>

                  {debateResults.core_arguments.background.length === 0 ? (
                    <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <span>자료 부족 (확인 필요) ⚠️</span>
                    </div>
                  ) : (
                    debateResults.core_arguments.background.map((item) => {
                      const origin = debateResults.raw_search_results.find(r => r.evidence_id === item.evidence_ref_id);
                      return (
                        <div key={item.bg_id} className="glass-panel" style={{ padding: '24px', borderLeft: '3.5px solid var(--color-bg-info)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-bg-info)', backgroundColor: 'var(--bg-bg-info-card)', padding: '2px 6px', borderRadius: '4px' }}>
                              관점: {item.perspective}
                            </span>
                            
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <span style={{
                                fontSize: '0.7rem',
                                backgroundColor: 
                                  item.reliability_assessment.score_grade === '높음' ? 'rgba(0, 210, 196, 0.12)' :
                                  item.reliability_assessment.score_grade === '중간' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 59, 48, 0.12)',
                                color:
                                  item.reliability_assessment.score_grade === '높음' ? '#00d2c4' :
                                  item.reliability_assessment.score_grade === '중간' ? '#f59e0b' : '#ff3b30',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 600
                              }}>
                                신뢰도: {item.reliability_assessment.score_grade}
                              </span>
                            </div>
                          </div>

                          <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>{item.core_fact}</h4>
                          
                          <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                            <span style={{ fontWeight: 600, display: 'block', marginBottom: '2px', color: 'var(--text-primary)' }}>📝 핵심 요약</span>
                            {item.easy_explanation}
                          </div>

                          <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-tertiary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                            <span style={{ fontWeight: 600, display: 'block', marginBottom: '2px', color: 'var(--accent-color)' }}>💡 토론 활용 포인트</span>
                            {item.debate_point}
                          </div>

                          {item.point_assessment && (
                            <div style={{
                              fontSize: '0.75rem',
                              padding: '6px 10px',
                              backgroundColor: item.point_assessment.is_point_valid ? 'rgba(0, 210, 196, 0.06)' : 'rgba(255, 59, 48, 0.06)',
                              border: '1px dashed',
                              borderColor: item.point_assessment.is_point_valid ? 'rgba(0, 210, 196, 0.2)' : 'rgba(255, 59, 48, 0.2)',
                              borderRadius: '4px',
                              color: item.point_assessment.is_point_valid ? '#00d2c4' : '#ff3b30'
                            }}>
                              <strong>[검증 ③] {item.point_assessment.status_text}</strong>: {item.point_assessment.reason}
                            </div>
                          )}

                          {origin && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>출처: {origin.publisher}</span>
                              <a href={origin.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--color-bg-info)', textDecoration: 'none', fontWeight: 500 }}>
                                원문 URL 링크 ↗
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            )}

            {/* 하단: 토론 자율 체크리스트 */}
            <div className="glass-panel" style={{ marginTop: '40px', padding: '30px' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>✅</span> 발표 직전! 토론 준비 체크리스트
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {checklist.map((item) => (
                  <label key={item.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '14px 18px',
                    backgroundColor: item.checked ? 'var(--bg-pro-card)' : 'var(--bg-tertiary)',
                    border: '1.5px solid',
                    borderColor: item.checked ? 'var(--border-pro)' : 'var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}>
                    <input 
                      type="checkbox" 
                      checked={item.checked} 
                      onChange={() => handleCheckboxToggle(item.id)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{
                      fontSize: '0.95rem',
                      color: item.checked ? 'var(--color-pro)' : 'var(--text-primary)',
                      textDecoration: item.checked ? 'line-through' : 'none',
                      fontWeight: item.checked ? 600 : 400
                    }}>{item.text}</span>
                  </label>
                ))}
              </div>
            </div>

          </div>
        )}

      </main>

      {/* 4. NCP 내보내기 팝업 모달 */}
      {showExportModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(3, 11, 30, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '650px',
            padding: '30px',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700 }}>📄 검증된 토론 자료 내보내기</h3>
              <button 
                onClick={() => setShowExportModal(false)}
                style={{ background: 'none', color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 'bold' }}
              >
                ×
              </button>
            </div>
            
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              아래 팩트 대조 및 정합성 검증이 완료된 보고서 내용을 인용하여 수행평가 보고서 제작에 활용하세요.
            </p>

            <textarea 
              readOnly 
              value={exportText}
              style={{
                width: '100%',
                height: '300px',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                resize: 'none',
                outline: 'none'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setShowExportModal(false)} className="btn-secondary">닫기</button>
              <button onClick={handleCopyToClipboard} className="btn-primary">클립보드 복사 📋</button>
            </div>
          </div>
        </div>
      )}

      {/* 4.5 논제 작성 가이드북 모달 (Guide Modal) */}
      {showGuideModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(3, 11, 30, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '700px',
            maxHeight: '85vh',
            overflowY: 'auto',
            padding: '30px',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🧭</span> 올바른 토론 논제 작성 가이드
              </h3>
              <button 
                onClick={() => setShowGuideModal(false)}
                style={{ background: 'none', color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 'bold' }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.92rem', lineHeight: '1.6' }}>
              <div>
                <strong style={{ color: 'var(--accent-color)', fontSize: '1.02rem', display: 'block', marginBottom: '6px' }}>💡 찬반 구도가 선명한 좋은 논제의 3대 조건</strong>
                <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--text-secondary)' }}>
                  <li><strong>긍정 평서문 사용</strong>: 질문형(&quot;~해야 하는가?&quot;)보다 평서문(&quot;~해야 한다&quot;)으로 끝맺을 때 찬반 입장이 선명해집니다.</li>
                  <li><strong>입증 책임 부여</strong>: 찬성 측이 기존의 제도를 변화시키거나 신규 정책을 찬성하는 입장이어야 토론이 균형을 이룹니다.</li>
                  <li><strong>중립적인 어휘</strong>: 가치 판단이 개입된 편향적인 수식어(예: 나쁜, 불법적인 등)를 논제에서 빼야 공평합니다.</li>
                </ul>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <strong style={{ color: 'var(--accent-color)', fontSize: '1.02rem', display: 'block', marginBottom: '10px' }}>🎯 애매모호한 논제 다듬기 예시</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'var(--color-con)', fontWeight: 600, fontSize: '0.8rem', display: 'block' }}>❌ 애매모호한 형태</span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>폭염 피하는 정책 의무화? / 환경 보전을 위해 규제를 푸는게 맞나?</span>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-pro-card)', border: '1px solid var(--border-pro)', padding: '12px 16px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'var(--color-pro)', fontWeight: 600, fontSize: '0.8rem', display: 'block' }}>✅ 좋은 토론 논제 (권장)</span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                      - 지자체는 도시 열섬 완화를 위해 도심 녹지(숲·공원) 조성을 법적으로 의무화해야 한다.<br/>
                      - 친환경 기후 인프라 확충을 위해 그린벨트(개발제한구역) 규제를 완화해야 한다.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '10px' }}>
              <button onClick={() => setShowGuideModal(false)} className="btn-primary" style={{ padding: '10px 20px', fontSize: '0.9rem' }}>
                확인하고 닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. NCP 스타일 프로페셔널 다크 푸터 */}
      <footer style={{
        backgroundColor: 'var(--bg-dark-hero)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '50px 0 30px 0',
        marginTop: '60px',
        color: '#8c98a4',
        fontSize: '0.85rem'
      }}>
        <div className="container">
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '30px',
            textAlign: 'left',
            marginBottom: '40px'
          }}>
            <div>
              <h4 style={{ color: '#ffffff', fontWeight: 600, marginBottom: '16px' }}>토론나침반 안내</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', padding: 0 }}>
                <li>서비스 소개</li>
                <li>고등학교 수행평가 활용 팁</li>
                <li>개인정보 처리방침</li>
              </ul>
            </div>
            <div>
              <h4 style={{ color: '#ffffff', fontWeight: 600, marginBottom: '16px' }}>개발자 및 출처</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', padding: 0 }}>
                <li>네이버 검색 API 연동</li>
                <li>Tavily Search API 연동</li>
                <li>Google Gemini 1.5 Flash</li>
              </ul>
            </div>
            <div>
              <h4 style={{ color: '#ffffff', fontWeight: 600, marginBottom: '16px' }}>교차 검증 규격</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', padding: 0 }}>
                <li>[검증 ①] 뉴스-질문 매칭</li>
                <li>[검증 ②] 질문-자료 정합성</li>
                <li>[검증 ③] 자료-포인트 일치</li>
                <li>[검증 ④] 출처-신뢰도 대조</li>
              </ul>
            </div>
          </div>

          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.05)',
            paddingTop: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <p style={{ margin: 0 }}>© 2026 NAVER Cloud Platform Style Debate Compass. All rights reserved.</p>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#677788' }}>
              본 서비스는 네이버 클라우드 플랫폼의 디자인 가이드를 준수하여 재구성된 고교용 교육 도구입니다.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
