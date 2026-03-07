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
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(
    null,
  );

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );

  // 1) Load current user + existing messages
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

      // Mark chat as read for this user on initial load
      await supabase.from('chat_reads').upsert({
        chat_id: chatId,
        user_id: user.id,
        last_read_at: new Date().toISOString(),
      });

      // Fetch other user's last_read_at
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

  // 2) Realtime subscription for new messages in this chat
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

          // If the current user is in this chat, update last_read_at too
          if (currentUserId) {
            await supabase.from('chat_reads').upsert({
              chat_id: chatId,
              user_id: currentUserId,
              last_read_at: new Date().toISOString(),
            });

            // Refresh other user's last_read_at
            const { data: chatData } = await supabase
              .from('chats')
              .select('user_a, user_b')
              .eq('id', chatId)
              .single();

            if (chatData) {
              const otherUserId =
                chatData.user_a === currentUserId
                  ? chatData.user_b
                  : chatData.user_a;

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
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, currentUserId]);

  // 3) Typing indicator: single channel instance per chat
  useEffect(() => {
    if (!chatId || !currentUserId) return;

    const channel = supabase.channel(`typing:${chatId}`);
    typingChannelRef.current = channel;

    channel
      .on(
        'broadcast',
        { event: 'typing' },
        ({
          payload,
        }: {
          payload: { userId: string; isTyping: boolean };
        }) => {
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

  // 4) Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 5) Send message
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

    // Realtime will append the new message
    if (error) {
      setError(error.message);
      setSending(false);
      return;
    }

    setInput('');
    setSending(false);
  }

  // 6) Broadcast typing events using the same channel
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

  // Compute "Seen" for the last message you sent
  const seenLabel = (() => {
    if (!currentUserId || !otherLastReadAt || messages.length === 0) {
      return null;
    }

    const lastSentByMe = [...messages]
      .reverse()
      .find((m) => m.sender_id === currentUserId);

    if (!lastSentByMe) return null;

    const isSeen =
      new Date(otherLastReadAt) >= new Date(lastSentByMe.created_at);

    if (!isSeen) return null;

    return (
      <div className="mt-1 pr-2 text-right">
        <span className="text-[10px] text-neutral-500">Seen</span>
      </div>
    );
  })();

  if (loading) {
    return (
      <main className="min-h-screen max-w-xl mx-auto p-4">
        <p>Loading...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen max-w-xl mx-auto p-4">
        <p className="text-red-600">{error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen max-w-xl mx-auto flex flex-col bg-black text-neutral-100">
      {/* Header */}
      <header className="flex itemscenter gap-3 border-b border-neutral-900 px-4 py-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-neutral-400 hover:text-neutral-100 text-sm"
        >
          ← Back
        </button>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">Chat</span>
          <span className="text-[11px] text-neutral-500">
            Messages are private between you two
          </span>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 flex flex-col px-4 py-3 overflow-y-auto space-y-2">
        {messages.length === 0 && (
          <p className="text-sm text-neutral-500 mt-4">
            No messages yet. Say hi 👋
          </p>
        )}

        {messages.map((m) => {
          const isMe = currentUserId === m.sender_id;
          const time = new Date(m.created_at).toLocaleTimeString();

          return (
            <div
              key={m.id}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                  isMe
                    ? 'bg-emerald-500 text-black rounded-br-sm'
                    : 'bg-neutral-900 text-neutral-100 rounded-bl-sm'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-[10px] uppercase tracking-wide opacity-70">
                    {isMe ? 'You' : 'Them'}
                  </span>
                  <span className="text-[9px] opacity-70">{time}</span>
                </div>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            </div>
          );
        })}

        {seenLabel}

        {otherTyping && (
          <div className="px-1 pt-1 text-[11px] text-neutral-500">
            Them is typing…
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSend}
        className="border-t border-neutral-900 px-3 py-3 bg-black"
      >
        <div className="flex items-center gap-2">
          <input
            className="flex-1 rounded-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              handleTyping();
            }}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="px-4 py-2 rounded-full bg-emerald-500 text-xs font-semibold text-black disabled:opacity-40"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-600 mt-2">{error}</p>
        )}
      </form>
    </main>
  );
}


