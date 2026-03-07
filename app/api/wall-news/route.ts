// app/api/wall-news/route.ts
import { NextRequest, NextResponse } from 'next/server';

type WallConfig = {
  name: string;
  rssUrl?: string;
  newsQueryFallback?: string;
};

const WALLS: Record<string, WallConfig> = {
  ufs: {
    name: 'UFS Wall',
    rssUrl: 'https://www.ufs.ac.za/news/rss', // TODO: confirm real URL
    newsQueryFallback: 'University of the Free State students',
  },
  wits: {
    name: 'Wits Wall',
    rssUrl: 'https://www.wits.ac.za/news-archive/rss', // TODO: confirm real URL
    newsQueryFallback: 'Wits University students',
  },
};

type NewsItem = {
  title: string;
  link: string;
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const wallId = searchParams.get('wallId');

  if (!wallId || !WALLS[wallId]) {
    return NextResponse.json(
      { error: 'Unknown wallId' },
      { status: 400 },
    );
  }

  const wall = WALLS[wallId];

  if (!wall.rssUrl) {
    // No RSS configured yet for this wall
    return NextResponse.json<NewsItem[]>([]);
  }

  try {
    const res = await fetch(wall.rssUrl, {
      // Basic caching on the edge/network level
      next: { revalidate: 900 }, // 15 minutes
    });

    if (!res.ok) {
      throw new Error(`RSS fetch failed with status ${res.status}`);
    }

    const xml = await res.text();
    const items = parseSimpleRss(xml).slice(0, 6); // limit to first few

    return NextResponse.json<NewsItem[]>(items);
  } catch (err) {
    console.error('wall-news error', err);
    // In a real app you might fall back to a generic news API here
    return NextResponse.json<NewsItem[]>([]);
  }
}

/**
 * Very lightweight RSS parser:
 * - Looks for <item>...</item>
 * - Inside each item, extracts <title> and <link>
 * This assumes fairly standard RSS structure.
 */
function parseSimpleRss(xml: string): NewsItem[] {
  const items: NewsItem[] = [];

  const itemRegex = /<item[\s\S]*?<\/item>/gi;
  const titleRegex = /<title>(<!\[CDATA\[)?([\s\S]*?)(\]\]>)?<\/title>/i;
  const linkRegex = /<link>(<!\[CDATA\[)?([\s\S]*?)(\]\]>)?<\/link>/i;

  const rawItems = xml.match(itemRegex) || [];

  for (const raw of rawItems) {
    const titleMatch = raw.match(titleRegex);
    const linkMatch = raw.match(linkRegex);

    const title = titleMatch?.[2]?.trim() || '';
    const link = linkMatch?.[2]?.trim() || '';

    if (!title || !link) continue;

    items.push({ title, link });
  }

  return items;
}
