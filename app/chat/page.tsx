'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

type Chat = {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
  status: string;
};

type Profile = {
  id: string;
  anon_name: string;
};

type LastMessage = {
  chat_id: string;
  body: string;
  created_at: string;
  sender_id: string;
};

type Read = {
  chat_id: string;
  user_id: string;
  last_read_at: string;
};

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading chat...</div>}>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatId = searchParams.get('chatId') || null;

  const [chats, setChats] = useState<Chat[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [lastMessages, setLastMessages] = useState<Record<string, LastMessage>>(
    {},
  );
  const [unreadMap, setUnreadMap] = useState<Record<string, boolean>>({});
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Detail state
  const [messages, setMessages] = useState<Message[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(
    null,
  );

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );
  const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );

  // 1) Load current user + chats + profiles + last messages + unread map
  useEffect(() => {
    async function load() {
      setListError(null);
      setListLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setListError('You must be logged in to see your chats.');
        setListLoading(false);
        return;
      }

      setCurrentUserId(user.id);

      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .select('id, user_a, user_b, created_at, status')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (chatError) {
        setListError(chatError.message);
        setListLoading(false);
        return;
      }

      const chats = (chatData ?? []) as Chat[];
      setChats(chats);

      if (chats.length === 0) {
        setListLoading(false);
        return;
      }

      const otherUserIds = Array.from(
        new Set(
          chats.map((chat) =>
            chat.user_a === user.id ? chat.user_b : chat.user_a,
          ),
        ),
      );

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, anon_name')
        .in('id', otherUserIds);

      if (profileError) {
        setListError(profileError.message);
        setListLoading(false);
        return;
      }

      const pMap: Record<string, string> = {};
      (profileData as Profile[]).forEach((p) => {
        pMap[p.id] = p.anon_name;
      });
      setProfilesMap(pMap);

      const chatIds = chats.map((c) => c.id);

      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .select('chat_id, body, created_at, sender_id')
        .in('chat_id', chatIds)
        .order('created_at', { ascending: false });

      if (messageError) {
        setListError(messageError.message);
        setListLoading(false);
        return;
      }

      const lm: Record<string, LastMessage> = {};
      (messageData as LastMessage[]).forEach((m) => {
        if (!lm[m.chat_id]) {
          lm[m.chat_id] = m;
        }
      });
      setLastMessages(lm);

      const { data: readsData, error: readsError } = await supabase
        .from('chat_reads')
        .select('chat_id, user_id, last_read_at')
        .eq('user_id', user.id)
        .in('chat_id', chatIds);

      if (!readsError && readsData) {
        const reads = readsData as Read[];
        const map: Record<string, boolean> = {};

        chats.forEach((chat) => {
          const last = lm[chat.id];
          if (!last) {
            map[chat.id] = false;
            return;
          }
          const read = reads.find((r) => r.chat_id === chat.id);
          const lastIsFromOther = last.sender_id !== user.id;

          map[chat.id] =
            lastIsFromOther &&
            (!read || new Date(last.created_at) > new Date(read.last_read_at));
        });

        setUnreadMap(map);
      }

      setListLoading(false);
    }

    load();
  }, []);

  // 2) Load detail + realtime + typing when chatId changes
  useEffect(() => {
    async function loadDetail(selectedChatId: string, userId: string) {
      setDetailError(null);
      setDetailLoading(true);
      setMessages([]);
      setOtherLastReadAt(null);
      setOtherTyping(false);

      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, body, created_at')
        .eq('chat_id', selectedChatId)
        .order('created_at', { ascending: true });

      if (error) {
        setDetailError(error.message);
        setDetailLoading(false);
        return;
      }

      setMessages((data ?? []) as Message[]);

      await supabase.from('chat_reads').upsert({
        chat_id: selectedChatId,
        user_id: userId,
        last_read_at: new Date().toISOString(),
      });

      const { data: chatData } = await supabase
        .from('chats')
        .select('user_a, user_b')
        .eq('id', selectedChatId)
        .single();

      if (chatData) {
        const otherUserId =
          chatData.user_a === userId ? chatData.user_b : chatData.user_a;

        const { data: readRow } = await supabase
          .from('chat_reads')
          .select('last_read_at')
          .eq('chat_id', selectedChatId)
          .eq('user_id', otherUserId)
          .maybeSingle();

        if (readRow?.last_read_at) {
          setOtherLastReadAt(readRow.last_read_at);
        }
      }

      setDetailLoading(false);
    }

    if (!chatId || !currentUserId) {
      if (chatChannelRef.current) {
        supabase.removeChannel(chatChannelRef.current);
        chatChannelRef.current = null;
      }
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }
      return;
    }

    loadDetail(chatId, currentUserId);

    const chatChannel = supabase
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

    chatChannelRef.current = chatChannel;

    const typingChannel = supabase.channel(`typing:${chatId}`);

    typingChannel
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

    typingChannelRef.current = typingChannel;

    return () => {
      if (chatChannelRef.current) {
        supabase.removeChannel(chatChannelRef.current);
        chatChannelRef.current = null;
      }
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }
    };
  }, [chatId, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!chatId) return;

    setDetailError(null);
    if (!input.trim()) return;
    setSending(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setDetailError('You must be logged in to send messages.');
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
      setDetailError(error.message);
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

  function openChat(id: string) {
    const params = new URLSearchParams(window.location.search);
    params.set('chatId', id);
    router.push(`/chat?${params.toString()}`);
  }

  // LEFT: list
  const listContent = (() => {
    if (listLoading) {
      return (
        <div className="p-4">
          <p>Loading chats...</p>
        </div>
      );
    }

    if (listError) {
      return (
        <div className="p-4">
          <p className="text-red-600">{listError}</p>
        </div>
      );
    }

    if (chats.length === 0) {
      return (
        <div className="p-4">
          <h1 className="text-xl font-bold mb-4">Your chats</h1>
          <p className="text-sm text-gray-500">
            No chats yet. Request a chat from a post to start.
          </p>
        </div>
      );
    }

    return (
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">Your chats</h1>
        <ul className="space-y-2">
          {chats.map((chat) => {
            const otherId =
              currentUserId && chat.user_a === currentUserId
                ? chat.user_b
                : chat.user_a;
            const otherName = profilesMap[otherId] ?? 'Anon user';

            const last = lastMessages[chat.id];
            const preview = last ? last.body.slice(0, 50) : 'No messages yet';
            const time = last
              ? new Date(last.created_at).toLocaleTimeString()
              : '';

            const hasUnread = unreadMap[chat.id] ?? false;
            const isActive = chatId === chat.id;

            return (
              <li
                key={chat.id}
                className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border bg-black cursor-pointer transition ${
                  hasUnread
                    ? 'border-emerald-500/70 hover:border-emerald-400'
                    : 'border-neutral-900 hover:border-neutral-700'
                } ${isActive ? 'bg-neutral-950' : ''}`}
                onClick={() => openChat(chat.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800 text-xs font-semibold text-neutral-100">
                    {otherName ? otherName.charAt(0).toUpperCase() : 'A'}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span
                      className={`text-sm font-medium ${
                        hasUnread ? 'text-neutral-50' : 'text-neutral-200'
                      }`}
                    >
                      Chat with {otherName}
                    </span>
                    <span
                      className={`text-xs truncate ${
                        hasUnread ? 'text-neutral-100' : 'text-neutral-400'
                      }`}
                    >
                      {preview}
                      {last && last.body.length > 50 ? '…' : ''}
                    </span>
                    <span className="mt-1 text-[11px] text-neutral-500 capitalize">
                      Status: {chat.status}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  {time && (
                    <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                      {time}
                    </span>
                  )}
                  {hasUnread && (
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.25)]" />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  })();

  // RIGHT: detail
  const detailContent = (() => {
    if (!chatId) {
      return (
        <div className="hidden md:flex flex-1 items-center justify-center text-sm text-neutral-500">
          Select a chat from the left.
        </div>
      );
    }

    if (detailLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p>Loading chat...</p>
        </div>
      );
    }

    if (detailError) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-red-600">{detailError}</p>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col bg-black text-neutral-100">
        <header className="flex items-center gap-3 border-b border-neutral-900 px-4 py-3 md:border-b-0 md:border-l">
          <button
            type="button"
            onClick={() => router.push('/chat')}
            className="md:hidden text-neutral-400 hover:text-neutral-100 text-sm"
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

        <div className="px-4 py-3 space-y-2">
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

        <form
          onSubmit={handleSend}
          className="sticky bottom-0 border-t border-neutral-900 px-3 py-3 bg-black"
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
          {detailError && (
            <p className="text-xs text-red-600 mt-2">{detailError}</p>
          )}
        </form>
      </div>
    );
  })();

  return (
    <div className="flex w-full gap-4">
      {/* Left: list */}
      <div className="w-full md:w-1/3 border border-neutral-900 rounded-xl overflow-hidden bg-black">
        {listContent}
      </div>

      {/* Right: detail desktop */}
      <div className="hidden md:flex md:w-2/3 border border-neutral-900 rounded-xl bg-black">
        {detailContent}
      </div>

      {/* Mobile full-screen detail */}
      {chatId && (
        <div className="fixed inset-0 z-30 bg-black md:hidden">
          {detailContent}
        </div>
      )}
    </div>
  );
}



