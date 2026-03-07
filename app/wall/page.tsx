'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

type Post = {
  id: string;
  body: string;
  created_at: string;
  comments_count: number;
  likes_count: number;
};

type Mode = 'new' | 'hot';

export default function WallPage({ params }: { params: { wallId: string } }) {
  const { wallId } = params;
  const router = useRouter();
  const searchParams = useSearchParams(); // reserved for future filters

  const [posts, setPosts] = useState<Post[]>([]);
  const [mode, setMode] = useState<Mode>('new');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('posts_with_counts')
        .select('id, body, created_at, comments_count, likes_count, status, wall_id')
        .eq('status', 'live')
        .eq('wall_id', wallId)
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

  const wallTitle =
    wallId === 'ufs'
      ? 'UFS Wall'
      : wallId === 'wits'
      ? 'Wits Wall'
      : 'Comethru Wall';

  return (
    <main className="min-h-screen max-w-xl mx-auto px-4 py-4 space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{wallTitle}</h1>
          <div className="inline-flex items-center gap-4 text-base">
            <button
              type="button"
              onClick={() => setMode('new')}
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
              onClick={() => setMode('hot')}
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
          onClick={() => router.push(`/posts/new?wallId=${wallId}`)}
          className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 transition"
        >
          New post
        </button>
      </header>

      {loading && (
        <p className="text-sm text-neutral-400">
          Loading {mode === 'new' ? 'latest' : 'hot'} posts...
        </p>
      )}
      {error && <p className="text-sm text-red-500">Error: {error}</p>}
      {!loading && !error && posts.length === 0 && (
        <p className="text-sm text-neutral-500">No posts yet.</p>
      )}

      {/* Mobile: simple vertical list */}
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

      {/* Desktop: circular layout */}
      {!loading && !error && posts.length > 0 && (
        <div className="mt-4 hidden sm:flex items-center justify-center">
          <div className="relative w-[360px] h-[360px]">
            {/* Center: latest post (static) */}
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

            {/* Rotating orbit: wrapper rotates, cards counter‑rotate so they stay upright */}
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

