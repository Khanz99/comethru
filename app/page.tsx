'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './lib/supabaseClient';

const previewCards = [
  {
    body: "Does anyone else feel like they're just going through the motions lately?",
    replies: 14,
    likes: 32,
    bg: 'bg-[#1f1f1f] text-white',
    rotate: '-rotate-2',
    size: 'w-48',
  },
  {
    body: 'Finally got the courage to quit. No plan, just faith.',
    replies: 8,
    likes: 61,
    bg: 'bg-[#b8afa2] text-[#1f1f1f]',
    rotate: 'rotate-[1.5deg]',
    size: 'w-44',
    mt: 'mt-5',
  },
  {
    body: "Secretly proud of how far I've come. Just needed to tell someone.",
    replies: 22,
    likes: 88,
    bg: 'bg-[#b97065] text-white',
    rotate: '-rotate-1',
    size: 'w-52',
  },
  {
    body: "Anyone want to talk? I'll start a chat with whoever replies first.",
    replies: 3,
    likes: 19,
    bg: 'bg-[#f5f1ea] text-[#1f1f1f] border border-[#e0dbd2]',
    rotate: 'rotate-2',
    size: 'w-44',
    mt: 'mt-3',
  },
];

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        router.replace('/wall');
        return;
      }

      setIsLoggedIn(false);
      setChecked(true);
    }

    checkUser();
  }, [router]);

  if (!checked) {
    return (
      <main className="min-h-screen bg-[#f5f1ea] flex items-center justify-center">
        <span className="text-sm text-neutral-500">Loading...</span>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f1ea]">
      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pt-20 pb-10 text-center">
        <p className="mb-5 text-[11px] font-black uppercase tracking-[0.3em] text-[#b97065]">
          anonymous · real-time · community
        </p>

        <h1 className="text-5xl font-black leading-[1.05] tracking-tight text-[#1f1f1f] sm:text-6xl">
          Say what&apos;s on<br />your mind.
        </h1>

        <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-neutral-600">
          Comethru is an anonymous wall where you post your thoughts, get replies,
          and connect one-on-one — no names, no filters, just people.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/auth"
            className="rounded-full bg-[#1f1f1f] px-8 py-4 text-sm font-black text-white shadow-sm transition hover:scale-[1.02]"
          >
            Join the wall
          </Link>
          <Link
            href="/wall"
            className="rounded-full border-2 border-[#1f1f1f] bg-transparent px-8 py-4 text-sm font-black text-[#1f1f1f] transition hover:bg-[#1f1f1f] hover:text-white"
          >
            Read the wall
          </Link>
        </div>
      </section>

      {/* Wall preview cards */}
      <section className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-center gap-4">
          {previewCards.map((card, i) => (
            <div
              key={i}
              className={`${card.bg} ${card.rotate} ${card.size} ${card.mt ?? ''} shrink-0 rounded-sm p-4 shadow-md`}
            >
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-black/20 text-xs font-black">
                  A
                </div>
                <div className="leading-tight">
                  <p className="text-xs font-black">Anonymous</p>
                  <p className="text-[10px] opacity-60">Comethru profile</p>
                </div>
              </div>

              <p className="text-sm font-black leading-snug">{card.body}</p>

              <div className="mt-4 flex items-center justify-between text-[10px] font-bold opacity-60">
                <span>{card.replies} replies</span>
                <span>{card.likes} likes</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-4xl px-6 pb-20">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            {
              icon: '📌',
              title: 'The wall',
              desc: 'Post anonymously. Your thoughts go up on the community wall for everyone to see.',
            },
            {
              icon: '💬',
              title: 'Private chat',
              desc: 'Connect one-on-one. Request a private chat from any post you vibe with.',
            },
            {
              icon: '🔔',
              title: 'Notifications',
              desc: 'Get notified when someone replies, likes your post, or sends a chat request.',
            },
            {
              icon: '🎭',
              title: 'Stay anonymous',
              desc: 'No real names. No profiles. Just your words and whoever reads them.',
            },
          ].map((f) => (
            <div key={f.title} className="rounded-xl bg-white p-5 shadow-sm">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[#f5f1ea] text-lg">
                {f.icon}
              </div>
              <h3 className="mb-1 text-sm font-black text-[#1f1f1f]">{f.title}</h3>
              <p className="text-xs leading-relaxed text-neutral-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer strip */}
      <footer className="bg-[#1f1f1f] py-6 text-center text-xs font-bold text-white/40">
        made with ♥ ·{' '}
        <span className="text-[#b97065]">comethru</span> · say it already
      </footer>
    </main>
  );
}