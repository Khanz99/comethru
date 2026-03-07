'use client';

import Link from 'next/link';
import { useNotificationCount } from '../lib/notification-count-context';
// If you don't have the @ alias, use instead:
// import { useNotificationCount } from '../lib/notification-count-context';

export function NotificationsBell() {
  const { unreadCount } = useNotificationCount();

  const showBadge = unreadCount > 0;
  const displayCount = unreadCount > 9 ? '9+' : unreadCount;

  return (
    <Link
      href="/notifications"
      className="relative flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800 transition"
      aria-label="Notifications"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6 6 0 0 0-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>

      {showBadge && (
        <span className="absolute -top-1 -right-1 min-w-[18px] px-1.5 py-0.5 rounded-full bg-red-500 text-[10px] font-semibold text-white flex items-center justify-center">
          {displayCount}
        </span>
      )}
    </Link>
  );
}
