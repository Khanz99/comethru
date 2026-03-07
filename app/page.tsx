'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';

export default function Home() {
  const [status, setStatus] = useState('Checking Supabase...');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    async function run() {
      const { error } = await supabase.from('topics').select('*').limit(1);
      if (error) {
        setStatus(`Error: ${error.message}`);
      } else {
        setStatus('Supabase connection OK');
      }
    }
    run();
  }, []);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? null);
    }
    loadUser();
  }, []);

  async function handleLogout() {
    setAuthLoading(true);
    await supabase.auth.signOut();
    setUserEmail(null);
    setAuthLoading(false);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Comethru</h1>

      {userEmail ? (
        <p className="text-sm text-gray-600">Signed in as {userEmail}</p>
      ) : (
        <p className="text-sm text-gray-600">Not signed in</p>
      )}

      <p>{status}</p>

      <div className="flex gap-4 mt-4">
        <Link
          href="/wall"
          className="px-4 py-2 rounded bg-black text-white"
        >
          Go to Wall
        </Link>
        <Link
          href="/posts/new"
          className="px-4 py-2 rounded border border-black"
        >
          New Post
        </Link>

        {userEmail ? (
          <button
            onClick={handleLogout}
            disabled={authLoading}
            className="px-4 py-2 rounded border border-black disabled:opacity-50"
          >
            {authLoading ? 'Logging out...' : 'Log out'}
          </button>
        ) : (
          <Link
            href="/auth"
            className="px-4 py-2 rounded border border-black"
          >
            Log in / Sign up
          </Link>
        )}
      </div>
    </main>
  );
}
