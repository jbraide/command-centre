'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error('Invalid email or password');
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-[var(--border)] bg-[var(--panel)] p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-[var(--accent)] tracking-wider">
          $ COMMAND CENTER
        </h1>
        <p className="text-sm text-[var(--muted)] mt-2">sign in to continue</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
            placeholder="you@example.com"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-[var(--muted)] mb-1">password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
            placeholder="••••••••"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[var(--accent)] text-[var(--background)] font-bold py-2.5 text-sm tracking-wider hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {loading ? 'SIGNING IN...' : 'SIGN IN'}
        </button>
      </form>

      <p className="text-center text-sm text-[var(--muted)] mt-6">
        no account?{' '}
        <Link href="/register" className="text-[var(--accent)] hover:underline">
          sign up
        </Link>
      </p>
    </div>
  );
}
