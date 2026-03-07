import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { NotificationsBell } from "./components/NotificationsBell";
import NotificationCountProvider from "./NotificationCountContext";

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
          <header className="sticky top-0 z-20 border-b border-neutral-900 bg-black/80 backdrop-blur">
            <nav className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
              <Link
                href="/wall"
                className="text-lg font-semibold tracking-tight text-neutral-100"
              >
                comethru
              </Link>
              <div className="flex items-center gap-5">
                <Link
                  href="/wall"
                  className="text-sm font-medium text-neutral-300 hover:text-neutral-100"
                >
                  Wall
                </Link>
                <Link
                  href="/posts/new"
                  className="text-sm font-medium text-neutral-300 hover:text-neutral-100"
                >
                  New Post
                </Link>
                <Link
                  href="/chat"
                  className="text-sm font-medium text-neutral-300 hover:text-neutral-100"
                >
                  Chats
                </Link>
                <Link
                  href="/auth"
                  className="text-sm font-medium text-neutral-300 hover:text-neutral-100"
                >
                  Account
                </Link>

                {/* Dynamic notifications bell */}
                <NotificationsBell />
              </div>
            </nav>
          </header>

          <main className="mx-auto flex min-h-[calc(100vh-56px)] max-w-xl flex-col px-4 py-4">
            {children}
          </main>
        </NotificationCountProvider>
      </body>
    </html>
  );
}
