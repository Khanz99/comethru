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

    // success: go to Wall
    router.push('/wall');
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
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
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm border rounded p-4 space-y-4">
        <h1 className="text-xl font-bold text-center">Comethru Login</h1>

        <form className="space-y-3">
          <input
            type="email"
            className="w-full border rounded p-2"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            className="w-full border rounded p-2"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            onClick={handleLogin}
            disabled={loading}
            className="w-full px-3 py-2 rounded bg-black text-white disabled:opacity-50"
          >
            {loading ? 'Working...' : 'Log in'}
          </button>

          <button
            type="button"
            onClick={handleSignup}
            disabled={loading}
            className="w-full px-3 py-2 rounded border border-black disabled:opacity-50"
          >
            Sign up with email
          </button>
        </form>
      </div>
    </main>
  );
}

