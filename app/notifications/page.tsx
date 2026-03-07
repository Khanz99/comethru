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

    setNotifications(prev =>
      prev.map(item => (item.id === n.id ? { ...item, read: true } : item)),
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

  return (
    <main className="min-h-screen max-w-xl mx-auto px-4 py-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notifications</h1>
      </header>

      {loading && (
        <p className="text-sm text-neutral-400">Loading notifications...</p>
      )}
      {error && <p className="text-sm text-red-500">Error: {error}</p>}
      {!loading && !error && notifications.length === 0 && (
        <p className="text-sm text-neutral-500">
          You don&apos;t have any notifications yet.
        </p>
      )}

      <ul className="space-y-2">
        {notifications.map(n => {
          const time = new Date(n.created_at).toLocaleString();
          const isUnread = !n.read;

          const content = (
            <div className="flex items-start gap-3">
              <span
                className={`mt-2 h-2.5 w-2.5 rounded-full ${
                  isUnread ? 'bg-emerald-500' : 'bg-neutral-700'
                }`}
              />
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-neutral-100 truncate">{n.body}</p>
                <span className="text-[11px] text-neutral-500">{time}</span>
              </div>
            </div>
          );

          const baseClasses =
            'flex items-start gap-3 rounded-xl border px-3 py-2 text-sm cursor-pointer ' +
            (isUnread
              ? 'border-emerald-500/60 bg-neutral-950'
              : 'border-neutral-900 bg-black');

          return (
            <li key={n.id}>
              <div
                className={baseClasses}
                onClick={() => handleClickNotification(n)}
              >
                {content}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

