'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

const floatStyles = [
  'sm:rotate-[-2deg]',
  'sm:rotate-[2deg]',
  'sm:rotate-[-1deg]',
  'sm:rotate-[1deg]',
  'sm:rotate-[-2deg]',
  'sm:rotate-[2deg]',
];

export default function ChatDetailPage() {
  const params = useParams();
  const router = useRouter();
  const chatId = params.id as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    async function load() {
      setError(null);
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError('You must be logged in to view this chat.');
        setLoading(false);
        return;
      }

      setCurrentUserId(user.id);

      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, body, created_at')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setMessages((data ?? []) as Message[]);

      await supabase.from('chat_reads').upsert({
        chat_id: chatId,
        user_id: user.id,
        last_read_at: new Date().toISOString(),
      });

      const { data: chatData } = await supabase
        .from('chats')
        .select('user_a, user_b')
        .eq('id', chatId)
        .single();

      if (chatData) {
        const otherUserId =
          chatData.user_a === user.id ? chatData.user_b : chatData.user_a;

        const { data: readRow } = await supabase
          .from('chat_reads')
          .select('last_read_at')
          .eq('chat_id', chatId)
          .eq('user_id', otherUserId)
          .maybeSingle();

        if (readRow?.last_read_at) {
          setOtherLastReadAt(readRow.last_read_at);
        }
      }

      setLoading(false);
    }

    if (chatId) load();
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;

    const channel = supabase
      .channel(`chat-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);

          if (currentUserId) {
            await supabase.from('chat_reads').upsert({
              chat_id: chatId,
              user_id: currentUserId,
              last_read_at: new Date().toISOString(),
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, currentUserId]);

  useEffect(() => {
    if (!chatId || !currentUserId) return;

    const channel = supabase.channel(`typing:${chatId}`);
    typingChannelRef.current = channel;

    channel
      .on(
        'broadcast',
        { event: 'typing' },
        ({ payload }: { payload: { userId: string; isTyping: boolean } }) => {
          if (payload.userId !== currentUserId) {
            setOtherTyping(payload.isTyping);
          }
        },
      )
      .subscribe();

    return () => {
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }
    };
  }, [chatId, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!input.trim()) return;

    setSending(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError('You must be logged in to send messages.');
      setSending(false);
      return;
    }

    const { error } = await supabase.from('messages').insert({
      chat_id: chatId,
      sender_id: user.id,
      body: input.trim(),
      status: 'sent',
    });

    if (error) {
      setError(error.message);
      setSending(false);
      return;
    }

    setInput('');
    setSending(false);
  }

  function handleTyping() {
    if (!typingChannelRef.current || !currentUserId) return;

    typingChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUserId, isTyping: true },
    });

    if (typingTimeout) clearTimeout(typingTimeout);

    const timeout = setTimeout(() => {
      if (!typingChannelRef.current) return;

      typingChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUserId, isTyping: false },
      });
    }, 1000);

    setTypingTimeout(timeout);
  }

  const seenLabel = (() => {
    if (!currentUserId || !otherLastReadAt || messages.length === 0) return null;

    const lastSentByMe = [...messages]
      .reverse()
      .find((m) => m.sender_id === currentUserId);

    if (!lastSentByMe) return null;

    const isSeen = new Date(otherLastReadAt) >= new Date(lastSentByMe.created_at);
    if (!isSeen) return null;

    return (
      <div className="w-full pr-3 text-right text-[10px] text-neutral-500">
        Seen
      </div>
    );
  })();

  if (loading) {
    return (
      <main className="flex h-[calc(100svh-57px)] w-full max-w-full flex-col overflow-hidden bg-[#b8afa2] p-4 text-neutral-900">
        <p className="text-sm text-white">Loading...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex h-[calc(100svh-57px)] w-full max-w-full flex-col overflow-hidden bg-[#b8afa2] p-4 text-neutral-900">
        <p className="text-sm text-red-700">{error}</p>
      </main>
    );
  }

  return (
    <main className="flex h-[calc(100svh-57px)] w-full max-w-full flex-col overflow-hidden bg-[#b8afa2] text-neutral-900">
      <header className="flex shrink-0 items-center gap-3 bg-[#b8afa2]/90 px-3 py-3 backdrop-blur sm:px-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="shrink-0 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold shadow-sm hover:bg-white"
        >
          ← Back
        </button>

        <div className="min-w-0">
          <h1 className="truncate text-sm font-black">Private chat</h1>
          <p className="truncate text-[11px] text-neutral-700">
            Messages between you two
          </p>
        </div>
      </header>

      <section className="min-h-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-4 sm:px-4 sm:py-6">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4 overflow-x-hidden sm:gap-5">
          {messages.length === 0 && (
            <p className="mt-10 text-center text-sm text-neutral-700">
              No messages yet. Say hi 👋
            </p>
          )}

          {messages.map((m, index) => {
            const isMe = currentUserId === m.sender_id;
            const time = new Date(m.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            const floatClass = floatStyles[index % floatStyles.length];

            return (
              <div
                key={m.id}
                className={`flex w-full max-w-full items-end gap-2 overflow-hidden ${
                  isMe ? 'justify-end' : 'justify-start'
                } ${floatClass}`}
              >
                {!isMe && (
                  <div className="h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-950 shadow-md sm:h-7 sm:w-7" />
                )}

                <div
                  className={`min-w-0 max-w-[78%] rounded-2xl bg-white px-3 py-2.5 shadow-lg sm:max-w-[75%] sm:px-4 sm:py-3 ${
                    isMe ? 'rounded-br-md' : 'rounded-bl-md'
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2 text-[10px] font-bold text-neutral-500">
                    <span>{isMe ? 'You' : 'Them'}</span>
                    <span>·</span>
                    <span>{time}</span>
                  </div>

                  <p className="whitespace-pre-wrap break-words text-sm font-semibold leading-snug">
                    {m.body}
                  </p>
                </div>

                {isMe && (
                  <div className="h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-emerald-400 to-black shadow-md sm:h-7 sm:w-7" />
                )}
              </div>
            );
          })}

          {seenLabel}

          {otherTyping && (
            <div className="flex w-full max-w-full items-center gap-2 overflow-hidden text-xs text-neutral-700">
              <div className="h-6 w-6 shrink-0 rounded-full bg-neutral-800" />
              <span className="min-w-0 truncate">Them is typing…</span>
            </div>
          )}

          <div ref={bottomRef} className="h-3 shrink-0" />
        </div>
      </section>

      <form
        onSubmit={handleSend}
        className="shrink-0 bg-[#b8afa2]/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-4"
      >
        <div className="mx-auto flex w-full max-w-xl items-center gap-2 rounded-full bg-white/80 p-2 shadow-lg">
          <input
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm font-medium text-neutral-900 placeholder:text-neutral-500 focus:outline-none"
            placeholder="Type something..."
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              handleTyping();
            }}
          />

          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="shrink-0 rounded-full bg-black px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>

        {error && (
          <p className="mx-auto mt-2 max-w-xl text-xs text-red-700">{error}</p>
        )}
      </form>
    </main>
  );
}


