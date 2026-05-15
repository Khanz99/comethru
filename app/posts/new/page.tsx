'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function NewPostPage() {
  const router = useRouter();

  const [body, setBody] = useState('');
  const [allowChat, setAllowChat] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!body.trim()) {
      setError('Post cannot be empty.');
      return;
    }

    setSubmitting(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError('You must be logged in to post.');
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from('posts').insert({
      author_id: user.id,
      body: body.trim(),
      type: 'confession',
      status: 'live',
      allow_chat_requests: allowChat,
    });

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setBody('');
    setAllowChat(true);

    router.push('/wall');
  }

  return (
    <main className="min-h-screen bg-white px-6 py-8">
      <section className="mx-auto max-w-6xl bg-[#f5f1e9] px-6 py-12 md:px-10">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-black text-black">New Post</h1>
            <p className="mt-2 text-lg text-neutral-700">
              Share an anonymous thought with the Comethru wall.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push('/wall')}
            className="rounded-full bg-black px-7 py-3 text-sm font-black text-white shadow-md transition hover:scale-[1.02]"
          >
            Back to wall
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-8 md:grid-cols-[1fr_1.5fr] md:items-start"
        >
          <aside className="-rotate-1 rounded-md bg-[#1f1f1f] p-7 text-white shadow-lg">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-black text-lg font-black">
                A
              </div>

              <div>
                <h2 className="text-xl font-black">Anonymous</h2>
                <p className="text-sm font-semibold text-white/70">
                  Comethru profile
                </p>
              </div>
            </div>

            <p className="mt-10 text-3xl font-black leading-tight">
              What do you need to get off your chest today?
            </p>

            <div className="mt-12 flex justify-between text-sm font-bold text-white/70">
              <span>{body.length} characters</span>
              <span>{allowChat ? 'Chats on' : 'Chats off'}</span>
            </div>
          </aside>

          <div className="rounded-md bg-white p-6 shadow-lg md:p-8">
            <header className="mb-7">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.25em] text-[#b97065]">
                comethru
              </p>
              <h2 className="text-3xl font-black text-black">
                Write your post
              </h2>
              <p className="mt-2 text-sm text-neutral-600">
                Keep it honest, anonymous, and respectful.
              </p>
            </header>

            <textarea
              className="min-h-[280px] w-full resize-none rounded-3xl border-0 bg-[#fbf4f5] px-5 py-5 text-lg font-bold leading-8 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="Start typing your confession..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />

            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-3 text-sm font-black text-black">
                <input
                  type="checkbox"
                  checked={allowChat}
                  onChange={(e) => setAllowChat(e.target.checked)}
                  className="h-4 w-4 accent-black"
                />
                Allow chat requests
              </label>

              <span className="text-sm font-bold text-neutral-500">
                {body.length} characters
              </span>
            </div>

            {error && (
              <p className="mt-5 rounded-2xl bg-[#fbf4f5] px-4 py-3 text-sm font-bold text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full rounded-full bg-black px-5 py-4 text-sm font-black text-white shadow-md transition hover:scale-[1.01] disabled:opacity-50"
            >
              {submitting ? 'Posting...' : 'Post to wall'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}