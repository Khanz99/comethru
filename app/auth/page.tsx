'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function AuthPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push('/wall');
  }

  async function handleSignup() {
    setError(null);

    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setError('Check your email to confirm your account, then log in.');
  }

  return (
    <main className="min-h-screen bg-white px-6 py-8">
      <section className="mx-auto max-w-6xl bg-[#f5f1e9] px-6 py-12 md:px-10">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-black text-black">My Account</h1>
            <p className="mt-2 text-lg text-neutral-700">
              Log in, sign up, and manage your Comethru access.
            </p>
          </div>

          <div className="rounded-full bg-black px-6 py-3 text-sm font-bold text-white">
            comethru profile
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-[1fr_1.4fr] md:items-start">
          <aside className="-rotate-1 rounded-md bg-[#1f1f1f] p-7 text-white shadow-lg">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-black text-lg font-black">
                A
              </div>

              <div>
                <h2 className="text-xl font-black">Anonymous</h2>
                <p className="text-sm font-semibold text-white/70">
                  Comethru profile
                </p>
              </div>
            </div>

            <p className="mt-10 text-3xl font-black leading-tight">
              Your account is where your wall, chats, and posts come together.
            </p>

            <div className="mt-12 flex justify-between text-sm font-bold text-white/70">
              <span>Wall access</span>
              <span>Chat access</span>
            </div>
          </aside>

          <div className="rounded-md bg-white p-6 shadow-lg md:p-8">
            <header className="mb-7">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.25em] text-[#b97065]">
                comethru
              </p>
              <h2 className="text-3xl font-black text-black">Welcome back</h2>
              <p className="mt-2 text-sm text-neutral-600">
                Log in to post, chat, and read what others are sharing.
              </p>
            </header>

            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="email"
                className="w-full rounded-full border-0 bg-[#fbf4f5] px-5 py-4 text-sm font-bold text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <input
                type="password"
                className="w-full rounded-full border-0 bg-[#fbf4f5] px-5 py-4 text-sm font-bold text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {error && (
                <p className="rounded-2xl bg-[#fbf4f5] px-4 py-3 text-sm font-bold text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-black px-5 py-4 text-sm font-black text-white shadow-md transition hover:scale-[1.01] disabled:opacity-50"
              >
                {loading ? 'Working...' : 'Log in'}
              </button>

              <button
                type="button"
                onClick={handleSignup}
                disabled={loading}
                className="w-full rounded-full border border-black bg-white px-5 py-4 text-sm font-black text-black transition hover:bg-black hover:text-white disabled:opacity-50"
              >
                Sign up with email
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
