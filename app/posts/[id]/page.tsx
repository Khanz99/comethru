'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

type Post = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  allow_chat_requests: boolean;
};

type Comment = {
  id: string;
  body: string;
  created_at: string;
};

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [likes, setLikes] = useState(0);
  const [likeError, setLikeError] = useState<string | null>(null);
  const [likeLoading, setLikeLoading] = useState(false);

  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setError(null);
      setLoading(true);

      const [
        { data: postData, error: postError },
        { data: likeData, error: likesError },
        { data: commentData, error: commentError },
      ] = await Promise.all([
        supabase
          .from('posts')
          .select('id, body, created_at, author_id, allow_chat_requests')
          .eq('id', postId)
          .single(),
        supabase
          .from('reactions')
          .select('id')
          .eq('target_type', 'post')
          .eq('target_id', postId),
        supabase
          .from('comments')
          .select('id, body, created_at')
          .eq('post_id', postId)
          .order('created_at', { ascending: true }),
      ]);

      if (postError) {
        setError(postError.message);
      } else {
        setPost(postData as Post);
        if (!likesError && likeData) setLikes(likeData.length);
        if (!commentError && commentData) setComments(commentData as Comment[]);
      }

      setLoading(false);
    }

    if (postId) load();
  }, [postId]);

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!newComment.trim()) {
      setSubmitError('Comment cannot be empty.');
      return;
    }

    setSubmitting(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setSubmitError('You must be logged in to comment.');
      setSubmitting(false);
      return;
    }

    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        author_id: user.id,
        body: newComment.trim(),
        status: 'live',
      })
      .select('id, body, created_at')
      .single();

    if (error) {
      setSubmitError(error.message);
      setSubmitting(false);
      return;
    }

    setComments((prev) => [...prev, data as Comment]);
    setNewComment('');
    setSubmitting(false);
  }

  async function handleLike() {
    setLikeError(null);
    setLikeLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLikeError('You must be logged in to like.');
      setLikeLoading(false);
      return;
    }

    const { error } = await supabase.from('reactions').upsert({
      user_id: user.id,
      target_type: 'post',
      target_id: postId,
      reaction: 'like',
    });

    if (error) {
      setLikeError(error.message);
      setLikeLoading(false);
      return;
    }

    setLikes((prev) => prev + 1);
    setLikeLoading(false);
  }

  async function handleRequestChat() {
    setChatError(null);
    setChatLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setChatError('You must be logged in to request a chat.');
      setChatLoading(false);
      return;
    }

    if (!post) {
      setChatError('Post not loaded.');
      setChatLoading(false);
      return;
    }

    if (user.id === post.author_id) {
      setChatError('You cannot start a chat with yourself.');
      setChatLoading(false);
      return;
    }

    const { data: existingChats, error: existingError } = await supabase
      .from('chats')
      .select('id, user_a, user_b')
      .or(
        `and(user_a.eq.${user.id},user_b.eq.${post.author_id}),and(user_a.eq.${post.author_id},user_b.eq.${user.id})`,
      )
      .limit(1);

    if (existingError) {
      setChatError(existingError.message);
      setChatLoading(false);
      return;
    }

    let chatId: string | null = null;

    if (existingChats && existingChats.length > 0) {
      chatId = existingChats[0].id;
    } else {
      const { data: newChat, error: insertError } = await supabase
        .from('chats')
        .insert({
          user_a: user.id,
          user_b: post.author_id,
          status: 'active',
        })
        .select('id')
        .single();

      if (insertError || !newChat) {
        setChatError(insertError?.message ?? 'Could not create chat.');
        setChatLoading(false);
        return;
      }

      chatId = newChat.id;
    }

    setChatLoading(false);
    router.push(`/chat/${chatId}`);
  }

  if (loading) {
    return (
      <main className="min-h-[calc(100dvh-57px)] bg-[#b8afa2] px-4 py-6 text-neutral-900">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm font-semibold text-neutral-700">Loading...</p>
        </div>
      </main>
    );
  }

  if (error || !post) {
    return (
      <main className="min-h-[calc(100dvh-57px)] bg-[#b8afa2] px-4 py-6 text-neutral-900">
        <div className="mx-auto max-w-2xl rounded-3xl bg-white/80 p-5 shadow-xl">
          <p className="text-sm font-semibold text-red-700">
            Error: {error ?? 'Post not found'}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100dvh-57px)] bg-[#b8afa2] px-3 py-5 text-neutral-900 sm:px-4 sm:py-8">
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full bg-white/70 px-4 py-2 text-xs font-black text-neutral-900 shadow-sm transition hover:bg-white"
        >
          ← Back
        </button>

        <article className="overflow-hidden rounded-[2rem] border border-black/10 bg-white/85 shadow-2xl backdrop-blur">
          <div className="border-b border-black/10 px-4 py-4 sm:px-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500">
              Anonymous post
            </p>

            <p className="mt-1 text-[11px] font-medium text-neutral-500">
              {new Date(post.created_at).toLocaleString()}
            </p>
          </div>

          <div className="px-4 py-5 sm:px-5">
            <p className="whitespace-pre-wrap break-words text-xl font-black leading-snug text-neutral-950 sm:text-2xl">
              {post.body}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleLike}
                disabled={likeLoading}
                className="inline-flex items-center justify-center rounded-full bg-black px-4 py-2 text-xs font-black text-white shadow-md transition hover:bg-neutral-800 disabled:opacity-50"
              >
                👍 {likeLoading ? 'Liking...' : 'Like'}
              </button>

              <span className="rounded-full bg-neutral-100 px-3 py-2 text-xs font-bold text-neutral-600">
                {likes} {likes === 1 ? 'like' : 'likes'}
              </span>
            </div>

            {likeError && (
              <p className="mt-2 text-xs font-semibold text-red-700">
                {likeError}
              </p>
            )}

            {post.allow_chat_requests ? (
              <section className="mt-5 rounded-[1.5rem] border border-neutral-800 bg-neutral-950 px-4 py-4 shadow-xl">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-black text-neutral-100">
                      Start a private chat
                    </h3>
                    <p className="mt-1 text-xs font-medium text-neutral-500">
                      Ask the anon about this post. Your username is never shown.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleRequestChat}
                    disabled={chatLoading}
                    className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-4 py-2 text-xs font-black text-black transition hover:bg-emerald-300 disabled:opacity-50"
                  >
                    {chatLoading ? 'Opening...' : 'Message anon'}
                  </button>
                </div>

                {chatError && (
                  <p className="mt-2 text-xs font-semibold text-red-400">
                    {chatError}
                  </p>
                )}
              </section>
            ) : (
              <p className="mt-4 rounded-2xl bg-neutral-100 px-4 py-3 text-xs font-semibold text-neutral-500">
                Chat requests are disabled for this post.
              </p>
            )}
          </div>
        </article>

        <section className="rounded-[2rem] border border-black/10 bg-white/80 p-4 shadow-2xl backdrop-blur sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500">
                Discussion
              </p>
              <h2 className="text-lg font-black text-neutral-950">
                Comments
              </h2>
            </div>

            <span className="rounded-full bg-black px-3 py-1 text-[11px] font-black text-white">
              {comments.length}
            </span>
          </div>

          <form onSubmit={handleAddComment} className="space-y-3">
            <textarea
              className="min-h-[100px] w-full resize-none rounded-3xl border border-black/10 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-black focus:bg-white"
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />

            {submitError && (
              <p className="text-sm font-semibold text-red-700">
                {submitError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-black px-5 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-neutral-800 disabled:opacity-50"
            >
              {submitting ? 'Posting...' : 'Add comment'}
            </button>
          </form>

          <div className="mt-5">
            {comments.length === 0 ? (
              <p className="rounded-3xl bg-neutral-100 px-4 py-4 text-sm font-semibold text-neutral-500">
                No comments yet. Be the first to say something.
              </p>
            ) : (
              <ul className="space-y-3">
                {comments.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-3xl border border-black/10 bg-neutral-50 px-4 py-3"
                  >
                    <p className="mb-1 text-[11px] font-bold text-neutral-400">
                      {new Date(c.created_at).toLocaleString()}
                    </p>
                    <p className="whitespace-pre-wrap break-words text-sm font-semibold leading-relaxed text-neutral-800">
                      {c.body}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
