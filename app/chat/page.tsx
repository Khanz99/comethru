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

const floatStyles = [
  'rotate-[-4deg] translate-x-2',
  'rotate-[3deg] -translate-x-3',
  'rotate-[-2deg] translate-x-8',
  'rotate-[4deg] -translate-x-8',
  'rotate-[-3deg] translate-x-4',
  'rotate-[2deg] -translate-x-2',
];

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
  const [lastMessages, setLastMessages] = useState<Record<string, LastMessage>>({});
  const [unreadMap, setUnreadMap] = useState<Record<string, boolean>>({});
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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
        new Set(chats.map((chat) => (chat.user_a === user.id ? chat.user_b : chat.user_a))),
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
        if (!lm[m.chat_id]) lm[m.chat_id] = m;
      });
      setLastMessages(lm);

      const { data: readsData } = await supabase
        .from('chat_reads')
        .select('chat_id, user_id, last_read_at')
        .eq('user_id', user.id)
        .in('chat_id', chatIds);

      if (readsData) {
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

      setDetailLoading(false);
    }

if (!chatId || !currentUserId) return;

const selectedChat = chats.find((chat) => chat.id === chatId);

if (!selectedChat) {
  setDetailError('Chat not found or you do not have access.');
  setDetailLoading(false);
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

          await supabase.from('chat_reads').upsert({
            chat_id: chatId,
            user_id: currentUserId,
            last_read_at: new Date().toISOString(),
          });
        },
      )
      .subscribe();

    chatChannelRef.current = chatChannel;

    const typingChannel = supabase.channel(`typing:${chatId}`);
    typingChannel
      .on('broadcast', { event: 'typing' }, ({ payload }: { payload: { userId: string; isTyping: boolean } }) => {
        if (payload.userId !== currentUserId) setOtherTyping(payload.isTyping);
      })
      .subscribe();

    typingChannelRef.current = typingChannel;

    return () => {
      if (chatChannelRef.current) supabase.removeChannel(chatChannelRef.current);
      if (typingChannelRef.current) supabase.removeChannel(typingChannelRef.current);
      chatChannelRef.current = null;
      typingChannelRef.current = null;
    };
  }, [chatId, currentUserId, chats]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!chatId || !input.trim()) return;

    setDetailError(null);
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
      typingChannelRef.current?.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUserId, isTyping: false },
      });
    }, 1000);

    setTypingTimeout(timeout);
  }

  function openChat(id: string) {
    const params = new URLSearchParams(window.location.search);
    params.set('chatId', id);
    router.push(`/chat?${params.toString()}`);
  }

  const listContent = (() => {
    if (listLoading) return <div className="p-4 text-sm">Loading chats...</div>;

    if (listError) return <div className="p-4 text-sm text-red-700">{listError}</div>;

    if (chats.length === 0) {
      return (
        <div className="p-4">
          <h1 className="text-xl font-black mb-4">Your chats</h1>
          <p className="text-sm text-neutral-600">
            No chats yet. Request a chat from a post to start.
          </p>
        </div>
      );
    }

    return (
      <div className="p-4">
        <h1 className="text-xl font-black mb-4 text-black">Your chats</h1>

        <ul className="space-y-3">
          {chats.map((chat) => {
            const otherId =
              currentUserId && chat.user_a === currentUserId ? chat.user_b : chat.user_a;

            const otherName = profilesMap[otherId] ?? 'Anon user';
            const last = lastMessages[chat.id];
            const preview = last ? last.body.slice(0, 50) : 'No messages yet';
            const time = last
              ? new Date(last.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '';

            const hasUnread = unreadMap[chat.id] ?? false;
            const isActive = chatId === chat.id;

            return (
              <li
                key={chat.id}
                onClick={() => openChat(chat.id)}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm transition hover:scale-[1.01] ${
                  isActive ? 'bg-white border-black' : 'bg-white/70 border-white/50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black text-sm font-black text-white">
                    {otherName ? otherName.charAt(0).toUpperCase() : 'A'}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-black text-black">
                      Chat with {otherName}
                    </span>
                    <span className="truncate text-xs text-neutral-600">
                      {preview}
                      {last && last.body.length > 50 ? '…' : ''}
                    </span>
                    <span className="mt-1 text-[10px] text-neutral-500 capitalize">
                      Status: {chat.status}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {time && <span className="text-[10px] text-neutral-500">{time}</span>}
                  {hasUnread && <span className="h-2.5 w-2.5 rounded-full bg-black" />}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  })();

  const detailContent = (() => {
    if (!chatId) {
      return (
        <div className="hidden md:flex flex-1 items-center justify-center text-sm text-neutral-700">
          Select a chat from the left.
        </div>
      );
    }

    if (detailLoading) {
      return (
        <div className="flex-1 flex items-center justify-center text-sm text-neutral-700">
          Loading chat...
        </div>
      );
    }

    if (detailError) {
      return (
        <div className="flex-1 flex items-center justify-center text-sm text-red-700">
          {detailError}
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col bg-[#b8afa2] text-neutral-900">
        <header className="flex items-center gap-3 px-5 py-4">
          <button
            type="button"
            onClick={() => router.push('/chat')}
            className="md:hidden rounded-full bg-white/70 px-3 py-1 text-xs font-bold"
          >
            ← Back
          </button>

          <div>
            <h2 className="text-sm font-black">Private chat</h2>
            <p className="text-[11px] text-neutral-700">
              Messages between you two
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-6">
          <div className="mx-auto flex max-w-xl flex-col gap-5">
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

              return (
                <div
                  key={m.id}
                  className={`flex items-end gap-2 ${
                    isMe ? 'justify-end' : 'justify-start'
                  } ${floatStyles[index % floatStyles.length]}`}
                >
                  {!isMe && (
                    <div className="h-7 w-7 shrink-0 rounded-full bg-black shadow-md" />
                  )}

                  <div
                    className={`max-w-[75%] rounded-2xl bg-white px-4 py-3 shadow-lg ${
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
                    <div className="h-7 w-7 shrink-0 rounded-full bg-emerald-500 shadow-md" />
                  )}
                </div>
              );
            })}

            {otherTyping && (
              <div className="flex items-center gap-2 text-xs text-neutral-700">
                <div className="h-6 w-6 rounded-full bg-black" />
                <span>Them is typing…</span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        <form onSubmit={handleSend} className="px-5 py-4">
          <div className="mx-auto flex max-w-xl items-center gap-2 rounded-full bg-white/80 p-2 shadow-lg">
            <input
              className="flex-1 bg-transparent px-3 py-2 text-sm font-medium text-neutral-900 placeholder:text-neutral-500 focus:outline-none"
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
              className="rounded-full bg-black px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>

          {detailError && (
            <p className="mx-auto mt-2 max-w-xl text-xs text-red-700">
              {detailError}
            </p>
          )}
        </form>
      </div>
    );
  })();

  return (
    <div className="flex w-full gap-4 bg-[#f5f1ea] p-4">
      <div className="w-full md:w-1/3 overflow-hidden rounded-3xl bg-[#b8afa2] shadow-lg">
        {listContent}
      </div>

      <div className="hidden md:flex md:w-2/3 overflow-hidden rounded-3xl bg-[#b8afa2] shadow-lg">
        {detailContent}
      </div>

      {chatId && (
        <div className="fixed inset-0 z-30 bg-[#b8afa2] md:hidden">
          {detailContent}
        </div>
      )}
    </div>
  );
}


