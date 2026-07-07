import { NextRequest, NextResponse } from 'next/server';
import { getMockNewsSearch, NewsItem } from '@/lib/mockData';

interface NaverNewsItem {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
}

interface NaverNewsResponse {
  items?: NaverNewsItem[];
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword') || '';

  if (!keyword) {
    return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  // API 키가 없으면 Mock 데이터로 즉시 Fallback
  if (!clientId || !clientSecret) {
    console.log('[Naver Search API] API Keys missing. Falling back to Mock Data.');
    return NextResponse.json(getMockNewsSearch(keyword));
  }

  try {
    const naverUrl = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(keyword)}&display=10`;
    const response = await fetch(naverUrl, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });

    if (!response.ok) {
      throw new Error(`Naver API responded with status ${response.status}`);
    }

    const data = (await response.json()) as NaverNewsResponse;
    
    // HTML 엔티티 문자 디코더
    const decodeHtml = (str: string): string => {
      return str
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#039;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
    };

    // Naver 결과를 토론나침반 데이터 구조로 매핑
    const newsList: NewsItem[] = (data.items || []).map((item, idx) => {
      const cleanTitle = decodeHtml(item.title.replace(/<\/?[^>]+(>|$)/g, ""));
      const cleanDesc = decodeHtml(item.description.replace(/<\/?[^>]+(>|$)/g, ""));
      
      return {
        news_id: `news_naver_${Date.now()}_${idx}`,
        title: cleanTitle,
        original_url: item.originallink,
        naver_news_url: item.link,
        description: cleanDesc,
        published_date: item.pubDate,
        publisher: item.link.includes('naver.com') ? '네이버 뉴스' : '언론사 원문'
      };
    });

    return NextResponse.json({
      search_keyword: keyword,
      total_results: newsList.length,
      news_list: newsList,
    });

  } catch (error: unknown) {
    console.error('[Naver Search API Error] Details:', getErrorMessage(error));
    console.log('[Naver Search API] Falling back to Mock Data.');
    return NextResponse.json(getMockNewsSearch(keyword));
  }
}
