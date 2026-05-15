// app/api/wall-news/route.ts
import { NextRequest, NextResponse } from 'next/server';

type WallNewsConfig = {
  query: string;
};

const WALL_NEWS_CONFIG: Record<string, WallNewsConfig> = {
  ufs: {
    query: '"University of the Free State" OR "UFS" Bloemfontein',
  },
  wits: {
    query: '"University of the Witwatersrand" OR "Wits" Johannesburg',
  },
};

type NewsItem = {
  title: string;
  link: string;
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const wallId = searchParams.get('wallId') || '';

  const config = WALL_NEWS_CONFIG[wallId];
  if (!config) {
    return NextResponse.json<NewsItem[]>([]);
  }

  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) {
    console.error('Missing GNEWS_API_KEY');
    return NextResponse.json<NewsItem[]>([]);
  }

  try {
    const url = new URL('https://gnews.io/api/v4/search');
    url.searchParams.set('q', config.query);
    url.searchParams.set('lang', 'en');
    url.searchParams.set('country', 'za');
    url.searchParams.set('max', '6');
    url.searchParams.set('apikey', apiKey);

    const res = await fetch(url.toString(), {
      next: { revalidate: 900 }, // cache for 15 minutes
    });

    if (!res.ok) {
      throw new Error(`GNews failed with status ${res.status}`);
    }

    const json = (await res.json()) as {
      articles?: { title: string; url: string }[];
    };

    const items: NewsItem[] =
      json.articles?.map((a) => ({
        title: a.title,
        link: a.url,
      })) ?? [];

    return NextResponse.json(items.slice(0, 6));
  } catch (err) {
    console.error('wall-news error', err);
    return NextResponse.json<NewsItem[]>([]);
  }
}

