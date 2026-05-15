'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import { useNotificationCount } from '../lib/notification-count-context';

type Notification = {
  id: string;
  type: string;
  body: string;
  created_at: string;
  read: boolean;
  target_url: string | null;
};

export default function NotificationsPage() {
  const router = useRouter();
  const { decrementUnreadCount } = useNotificationCount();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setError(null);
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError('You must be logged in to see notifications.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, body, created_at, read, target_url')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        setError(error.message);
      } else if (data) {
        setNotifications(data as Notification[]);
      }

      setLoading(false);
    }

    load();
  }, []);

  async function handleClickNotification(n: Notification) {
    if (!n.read) {
      decrementUnreadCount();
    }

    setNotifications((prev) =>
      prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)),
    );

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', n.id);

    if (error) {
      console.error('Mark notification as read error', error);
    }

    if (n.target_url) {
      router.push(n.target_url);
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <main className="min-h-screen bg-white px-6 py-8">
      <section className="mx-auto max-w-6xl bg-[#f5f1e9] px-6 py-12 md:px-10">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-black text-black">Notifications</h1>
            <p className="mt-2 text-lg text-neutral-700">
              Keep track of comments, chats, and activity on your posts.
            </p>
          </div>

          <div className="rounded-full bg-black px-7 py-3 text-sm font-black text-white shadow-md">
            {unreadCount} unread
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-[1fr_1.5fr] md:items-start">
          <aside className="-rotate-1 rounded-md bg-[#1f1f1f] p-7 text-white shadow-lg">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-black text-lg font-black">
                🔔
              </div>

              <div>
                <h2 className="text-xl font-black">Activity centre</h2>
                <p className="text-sm font-semibold text-white/70">
                  Comethru updates
                </p>
              </div>
            </div>

            <p className="mt-10 text-3xl font-black leading-tight">
              This is where your wall starts talking back.
            </p>

            <div className="mt-12 flex justify-between text-sm font-bold text-white/70">
              <span>{notifications.length} total</span>
              <span>{unreadCount} unread</span>
            </div>
          </aside>

          <div className="rounded-md bg-white p-6 shadow-lg md:p-8">
            <header className="mb-7">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.25em] text-[#b97065]">
                comethru
              </p>
              <h2 className="text-3xl font-black text-black">Recent activity</h2>
              <p className="mt-2 text-sm text-neutral-600">
                Tap a notification to open it and mark it as read.
              </p>
            </header>

            {loading && (
              <p className="rounded-2xl bg-[#fbf4f5] px-4 py-3 text-sm font-bold text-neutral-500">
                Loading notifications...
              </p>
            )}

            {error && (
              <p className="rounded-2xl bg-[#fbf4f5] px-4 py-3 text-sm font-bold text-red-600">
                Error: {error}
              </p>
            )}

            {!loading && !error && notifications.length === 0 && (
              <p className="rounded-2xl bg-[#fbf4f5] px-4 py-3 text-sm font-bold text-neutral-500">
                You don&apos;t have any notifications yet.
              </p>
            )}

            <ul className="space-y-3">
              {notifications.map((n) => {
                const time = new Date(n.created_at).toLocaleString();
                const isUnread = !n.read;

                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleClickNotification(n)}
                      className={`w-full rounded-2xl border px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                        isUnread
                          ? 'border-black bg-black text-white'
                          : 'border-neutral-200 bg-[#fbf4f5] text-black'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-2 h-3 w-3 shrink-0 rounded-full ${
                            isUnread ? 'bg-[#f1a6ad]' : 'bg-neutral-400'
                          }`}
                        />

                        <div className="min-w-0">
                          <p
                            className={`text-sm font-black ${
                              isUnread ? 'text-white' : 'text-black'
                            }`}
                          >
                            {n.body}
                          </p>

                          <p
                            className={`mt-1 text-xs font-bold ${
                              isUnread ? 'text-white/60' : 'text-neutral-500'
                            }`}
                          >
                            {time}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
