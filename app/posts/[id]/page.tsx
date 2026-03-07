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

    // Update UI
    setComments((prev) => [...prev, data as Comment]);
    setNewComment('');
    setSubmitting(false);

    // Create a notification for the post author (if not commenting on own post)
    if (post && user.id !== post.author_id) {
      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: post.author_id,
        type: 'comment',
        body: 'Someone commented on your post.',
        target_url: `/posts/${postId}`,
      });

      if (notifError) {
        console.error('Comment notification insert error', notifError);
      }
    }
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

    if (chatId) {
      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: post.author_id,
        type: 'chat',
        body: 'Someone started a chat with you about your post.',
        target_url: `/chat/${chatId}`,
      });

      if (notifError) {
        console.error('Notification insert error', notifError);
      } else {
        console.log('Notification inserted for', post.author_id, 'chat', chatId);
      }
    }

    setChatLoading(false);
    router.push(`/chat/${chatId}`);
  }

  if (loading) {
    return (
      <main className="min-h-screen max-w-xl mx-auto p-4">
        <p>Loading...</p>
      </main>
    );
  }

  if (error || !post) {
    return (
      <main className="min-h-screen max-w-xl mx-auto p-4">
        <p className="text-red-600">Error: {error ?? 'Post not found'}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen max-w-xl mx-auto p-4">
      <article className="mb-6 border rounded p-3">
        <p className="text-xs text-gray-500 mb-1">
          {new Date(post.created_at).toLocaleString()}
        </p>
        <p>{post.body}</p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleLike}
            disabled={likeLoading}
            className="px-3 py-1 rounded border border-black text-sm disabled:opacity-50"
          >
            👍 {likeLoading ? 'Liking...' : 'Like'}
          </button>
          <span className="text-xs text-gray-600">{likes} likes</span>
        </div>

        {likeError && (
          <p className="text-xs text-red-600 mt-1">{likeError}</p>
        )}

        {post.allow_chat_requests ? (
          <section className="mt-4 rounded-2xl border border-neutral-900 bg-neutral-950 px-4 py-4">
            <h3 className="text-sm font-semibold text-neutral-100">
              Start a private chat
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              Ask the anon about this post. Your username is never shown.
            </p>
            <button
              type="button"
              onClick={handleRequestChat}
              disabled={chatLoading}
              className="mt-3 inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-50 transition"
            >
              {chatLoading ? 'Opening chat...' : 'Message this anon'}
            </button>
            {chatError && (
              <p className="text-xs text-red-600 mt-2">{chatError}</p>
            )}
          </section>
        ) : (
          <p className="mt-3 text-xs text-gray-500">
            Chat requests are disabled for this post.
          </p>
        )}
      </article>

      <section className="space-y-4">
        <h2 className="font-semibold">Comments</h2>

        <form onSubmit={handleAddComment} className="space-y-2">
          <textarea
            className="w-full min-h-[80px] border rounded p-2"
            placeholder="Write a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          />
          {submitError && (
            <p className="text-red-600 text-sm">{submitError}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="px-3 py-1 rounded bg-black text-white disabled:opacity-50"
          >
            {submitting ? 'Posting...' : 'Add comment'}
          </button>
        </form>

        {comments.length === 0 && (
          <p className="text-sm text-gray-500">No comments yet.</p>
        )}
        <ul className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="border rounded p-2">
              <p className="text-xs text-gray-500 mb-1">
                {new Date(c.created_at).toLocaleString()}
              </p>
              <p>{c.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
