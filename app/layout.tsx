import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { NotificationsBell } from "./components/NotificationsBell";
import { NotificationCountProvider } from "./lib/notification-count-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "comethru",
  description: "Anonymous wall and chat",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-neutral-100`}
      >
        <NotificationCountProvider>
          <header className="sticky top-0 z-30 border-b border-neutral-900 bg-black/80 backdrop-blur">
            <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
              <Link
                href="/wall"
                className="text-base font-semibold tracking-tight text-neutral-100 sm:text-lg"
              >
                comethru
              </Link>

              <div className="flex items-center gap-3 sm:gap-5">
                <Link href="/wall" className="text-xs font-medium text-neutral-300 hover:text-neutral-100 sm:text-sm">
                  Wall
                </Link>
                <Link href="/posts/new" className="hidden text-xs font-medium text-neutral-300 hover:text-neutral-100 sm:block sm:text-sm">
                  New Post
                </Link>
                <Link href="/chat" className="text-xs font-medium text-neutral-300 hover:text-neutral-100 sm:text-sm">
                  Chats
                </Link>
                <Link href="/auth" className="hidden text-xs font-medium text-neutral-300 hover:text-neutral-100 sm:block sm:text-sm">
                  Account
                </Link>

                <NotificationsBell />
              </div>
            </nav>
          </header>

          <div className="min-h-[calc(100dvh-57px)]">
            {children}
          </div>
        </NotificationCountProvider>
      </body>
    </html>
  );
}