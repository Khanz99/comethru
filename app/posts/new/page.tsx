'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function NewPostPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading new post form...</div>}>
      <NewPostPageInner />
    </Suspense>
  );
}

function NewPostPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wallId = searchParams.get('wallId'); // e.g. "ufs" or "wits"

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

    if (!wallId) {
      setError('Missing wall. Please start from a campus wall.');
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
      wall_id: wallId, // associate post with this wall
    });

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setBody('');
    setAllowChat(true);

    router.push(`/wall/${wallId}`);
  }

  const wallLabel = wallId ? wallId.toUpperCase() : 'a wall';

  return (
    <main className="min-h-screen max-w-xl mx-auto p-4 space-y-4">
      <header>
        <h1 className="text-2xl font-bold mb-1">New Post</h1>
        <p className="text-sm text-neutral-500">
          Posting to {wallLabel}. Make sure you started from the right campus wall.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          className="w-full min-h-[150px] border rounded p-2 bg-neutral-950 text-neutral-100 border-neutral-800"
          placeholder="Share your confession or message..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allowChat}
            onChange={(e) => setAllowChat(e.target.checked)}
          />
          Allow chat requests on this post
        </label>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
        >
          {submitting ? 'Posting...' : 'Post'}
        </button>
      </form>
    </main>
  );
}


