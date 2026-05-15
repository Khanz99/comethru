'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

type Post = {
  id: string;
  body: string;
  created_at: string;
  comments_count: number;
  likes_count: number;
};

type Mode = 'new' | 'hot';

const cardStyles = [
  'bg-[#1f1f1f] text-white rotate-[-2deg]',
  'bg-[#b66f62] text-white rotate-[1.5deg]',
  'bg-[#8b6f9f] text-black rotate-[-1deg]',
  'bg-[#d8c8a8] text-black rotate-[2deg]',
  'bg-[#7891a8] text-white rotate-[-1.5deg]',
  'bg-[#b8c6b2] text-black rotate-[1deg]',
  'bg-[#e7b0b8] text-black rotate-[-2.5deg]',
  'bg-[#f0eee8] text-black rotate-[1.8deg]',
];

const sizeStyles = [
  'w-56 min-h-36',
  'w-64 min-h-44',
  'w-48 min-h-32',
  'w-72 min-h-40',
  'w-52 min-h-48',
];

export default function WallPage() {
  const router = useRouter();

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
  }, [mode]);

  return (
    <main className="min-h-screen bg-[#f5f1ea] px-4 py-8">
      <section className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tight">
              Comethru Wall
            </h1>
            <p className="text-sm text-neutral-600 mt-1">
              Anonymous thoughts from people around you.
            </p>

            <div className="mt-4 inline-flex items-center gap-4 text-base">
              <button
                type="button"
                onClick={() => setMode('new')}
                className={
                  mode === 'new'
                    ? 'font-bold text-black underline underline-offset-4'
                    : 'font-medium text-neutral-500 hover:text-black'
                }
              >
                New
              </button>

              <button
                type="button"
                onClick={() => setMode('hot')}
                className={
                  mode === 'hot'
                    ? 'font-bold text-black underline underline-offset-4'
                    : 'font-medium text-neutral-500 hover:text-black'
                }
              >
                Hot
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push('/posts/new')}
            className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-neutral-800 transition"
          >
            New post
          </button>
        </header>

        {loading && (
          <p className="text-sm text-neutral-500">
            Loading {mode === 'new' ? 'latest' : 'hot'} posts...
          </p>
        )}

        {error && <p className="text-sm text-red-600">Error: {error}</p>}

        {!loading && !error && posts.length === 0 && (
          <p className="text-sm text-neutral-500">No posts yet.</p>
        )}

        {!loading && !error && posts.length > 0 && (
          <div className="flex flex-wrap items-start justify-center gap-5 pt-4">
            {posts.map((p, index) => {
              const cardClass = cardStyles[index % cardStyles.length];
              const sizeClass = sizeStyles[index % sizeStyles.length];

              return (
                <Link
                  key={p.id}
                  href={`/posts/${p.id}`}
                  className={`${cardClass} ${sizeClass} group relative flex flex-col justify-between rounded-sm p-4 shadow-md transition duration-300 hover:z-10 hover:scale-105 hover:rotate-0`}
                >
                  <div>
                    <div className="mb-4 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-black/20 text-xs font-bold">
                        A
                      </div>

                      <div className="leading-tight">
                        <p className="text-xs font-bold">Anonymous</p>
                        <p className="text-[10px] opacity-70">
                          Comethru profile
                        </p>
                      </div>
                    </div>

                    <p className="text-xl font-black leading-tight tracking-tight">
                      {p.body}
                    </p>
                  </div>

                  <div className="mt-5 flex items-center justify-between text-[11px] font-semibold opacity-70">
                    <span>{p.comments_count} replies</span>
                    <span>{p.likes_count} likes</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

