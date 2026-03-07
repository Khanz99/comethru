'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

type NotificationCountContextValue = {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  decrementUnreadCount: () => void;
};

const NotificationCountContext =
  createContext<NotificationCountContextValue | undefined>(undefined);

export function NotificationCountProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [unreadCount, setUnreadCount] = useState(0);

  async function refreshUnreadCount() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setUnreadCount(0);
      return;
    }

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);

    if (error) {
      setUnreadCount(0);
      return;
    }

    setUnreadCount(count ?? 0);
  }

  function decrementUnreadCount() {
    setUnreadCount((prev) => (prev > 0 ? prev - 1 : 0));
  }

  useEffect(() => {
    refreshUnreadCount();
  }, []);

  return (
    <NotificationCountContext.Provider
      value={{ unreadCount, refreshUnreadCount, decrementUnreadCount }}
    >
      {children}
    </NotificationCountContext.Provider>
  );
}

export function useNotificationCount() {
  const ctx = useContext(NotificationCountContext);
  if (!ctx) {
    throw new Error(
      'useNotificationCount must be used within NotificationCountProvider',
    );
  }
  return ctx;
}
