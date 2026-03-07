'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

type Post = {
  id: string;
  body: string;
  created_at: string;
  comments_count: number;
  likes_count: number;
};

type Mode = 'new' | 'hot';

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

export default function CampusWallPage() {
  const router = useRouter();
  const params = useParams<{ wallId: string }>();
  const searchParams = useSearchParams();
  const wallId = params.wallId;
  const wall = WALLS[wallId];

  const [posts, setPosts] = useState<Post[]>([]);
  const [mode, setMode] = useState<Mode>(
    (searchParams.get('mode') as Mode) || 'new',
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);

  // 1) Load posts (for now: same as global wall, later filter by wallId)
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('posts_with_counts')
        .select('id, body, created_at, comments_count, likes_count, status')
        .eq('status', 'live')
        .order(mode === 'hot' ? 'likes_count' : 'created_at', {
          ascending: false,
        })
        .limit(20);

      if (error) {
        setError(error.message);
      } else if (data) {
        setPosts(data as Post[]);
      }
      setLoading(false);
    }

    load();
  }, [mode, wallId]);

  // 2) Load news via a simple API route (so we keep RSS parsing on the server)
  useEffect(() => {
    if (!wall) return;
    async function loadNews() {
      setNewsLoading(true);
      try {
        const res = await fetch(`/api/wall-news?wallId=${wallId}`);
        if (!res.ok) throw new Error('Failed to load news');
        const json = (await res.json()) as NewsItem[];
        setNews(json);
      } catch {
        setNews([]);
      } finally {
        setNewsLoading(false);
      }
    }
    loadNews();
  }, [wallId, wall]);

  if (!wall) {
    return (
      <main className="min-h-screen max-w-xl mx-auto px-4 py-4">
        <p className="text-sm text-red-500">Unknown wall.</p>
      </main>
    );
  }

  function updateMode(next: Mode) {
    setMode(next);
    const params = new URLSearchParams(window.location.search);
    params.set('mode', next);
    router.replace(`/wall/${wallId}?${params.toString()}`);
  }

  return (
    <main className="min-h-screen max-w-xl mx-auto px-4 py-4 space-y-4">
      {/* Wall header */}
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{wall.name}</h1>
          <p className="text-xs text-neutral-500">
            Anonymous student wall for {wallId.toUpperCase()} campus.
          </p>
          <div className="inline-flex items-center gap-4 text-base mt-1">
            <button
              type="button"
              onClick={() => updateMode('new')}
              className={
                mode === 'new'
                  ? 'font-semibold text-neutral-100'
                  : 'font-medium text-neutral-500 hover:text-neutral-300'
              }
            >
              New
            </button>
            <button
              type="button"
              onClick={() => updateMode('hot')}
              className={
                mode === 'hot'
                  ? 'font-semibold text-neutral-100'
                  : 'font-medium text-neutral-500 hover:text-neutral-300'
              }
            >
              Hot
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push('/posts/new')}
          className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 transition"
        >
          New post
        </button>
      </header>

      {/* News strip */}
      <section className="rounded-2xl border border-neutral-900 bg-neutral-950 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-neutral-300">
            Latest campus news
          </span>
          <span className="text-[10px] text-neutral-500">
            Source: official site / news API
          </span>
        </div>
        {newsLoading && (
          <p className="text-[11px] text-neutral-500">
            Fetching latest updates…
          </p>
        )}
        {!newsLoading && news.length === 0 && (
          <p className="text-[11px] text-neutral-500">
            No news available at the moment.
          </p>
        )}
        {!newsLoading && news.length > 0 && (
          <ul className="space-y-1">
            {news.slice(0, 4).map((item) => (
              <li key={item.link}>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-emerald-300 hover:underline"
                >
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Posts loading / errors */}
      {loading && (
        <p className="text-sm text-neutral-400">
          Loading {mode === 'new' ? 'latest' : 'hot'} posts...
        </p>
      )}
      {error && <p className="text-sm text-red-500">Error: {error}</p>}
      {!loading && !error && posts.length === 0 && (
        <p className="text-sm text-neutral-500">No posts yet.</p>
      )}

      {/* Mobile posts list */}
      {!loading && !error && posts.length > 0 && (
        <div className="flex flex-col gap-3 sm:hidden mt-4">
          {posts.map((p) => (
            <Link
              key={p.id}
              href={`/posts/${p.id}`}
              className="rounded-2xl border border-neutral-900 bg-neutral-950 px-4 py-3 text-sm text-neutral-100 hover:border-neutral-700 transition-transform duration-200 hover:scale-[1.02]"
            >
              <p className="line-clamp-3">{p.body}</p>
              <div className="mt-2 text-[11px] text-neutral-500">
                {p.comments_count} replies · {p.likes_count} likes
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Desktop circular layout (same as your main wall, reused) */}
      {!loading && !error && posts.length > 0 && (
        <div className="mt-4 hidden sm:flex items-center justify-center">
          <div className="relative w-[360px] h-[360px]">
            {posts[0] && (
              <Link
                href={`/posts/${posts[0].id}`}
                className="absolute left-1/2 top-1/2 w-44 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-neutral-950 border border-emerald-500 px-4 py-3 text-xs text-neutral-100 text-center shadow-lg transition-transform duration-200 hover:scale-105"
              >
                <p className="line-clamp-4">{posts[0].body}</p>
                <div className="mt-2 text-[10px] text-neutral-400">
                  {posts[0].comments_count} replies · {posts[0].likes_count} likes
                </div>
              </Link>
            )}

            <div className="absolute inset-0 wall-rotate-slow">
              {posts.slice(1, 9).map((p, index, arr) => {
                const angle = (index / arr.length) * 2 * Math.PI;
                const radius = 130;
                const x = radius * Math.cos(angle);
                const y = radius * Math.sin(angle);
                const angleDeg = (angle * 180) / Math.PI;

                const colors = [
                  'bg-emerald-500 text-black border-emerald-400',
                  'bg-sky-500 text-black border-sky-400',
                  'bg-violet-500 text-black border-violet-400',
                  'bg-amber-500 text-black border-amber-400',
                  'bg-rose-500 text-black border-rose-400',
                  'bg-fuchsia-500 text-black border-fuchsia-400',
                  'bg-lime-500 text-black border-lime-400',
                  'bg-cyan-500 text-black border-cyan-400',
                ];
                const colorClass = colors[index % colors.length];

                return (
                  <Link
                    key={p.id}
                    href={`/posts/${p.id}`}
                    className={`absolute w-32 rounded-xl px-3 py-2 text-[11px] shadow-sm border ${colorClass} transition-transform duration-200 hover:scale-110`}
                    style={{
                      left: `calc(50% + ${x}px)`,
                      top: `calc(50% + ${y}px)`,
                      transform: `translate(-50%, -50%) rotate(${-angleDeg}deg)`,
                    }}
                  >
                    <p className="line-clamp-3">{p.body}</p>
                    <div className="mt-1 text-[9px] opacity-80">
                      {p.comments_count} · {p.likes_count}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
