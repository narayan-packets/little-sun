import React, { useState } from 'react';
import { useAppState } from '../state/store';
import { SunMark } from './SunMark';

export const LoginScreen: React.FC = () => {
  const { signIn } = useAppState();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="w-full h-full flex items-center justify-center px-4"
      style={{
        backgroundColor: 'var(--bg)',
        color: 'var(--text)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div
        className="w-full max-w-[380px] p-7 border"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <div className="flex flex-col items-center text-center mb-6">
          <SunMark size={36} className="mb-3" />
          <h1 className="text-xl font-semibold tracking-tight">Little Sun</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="ls-email"
              className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--text)' }}
            >
              Email
            </label>
            <input
              id="ls-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full min-h-[44px] px-3.5 py-2.5 text-base border transition-colors"
              style={{
                backgroundColor: 'var(--bg)',
                borderColor: 'var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text)',
                fontSize: '16px',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="ls-password"
              className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--text)' }}
            >
              Password
            </label>
            <input
              id="ls-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full min-h-[44px] px-3.5 py-2.5 text-base border transition-colors"
              style={{
                backgroundColor: 'var(--bg)',
                borderColor: 'var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text)',
                fontSize: '16px',
              }}
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: 'var(--danger)' }} role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[44px] px-4 py-2.5 text-base font-medium transition-opacity disabled:opacity-60 cursor-pointer"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-contrast)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p
          className="mt-5 text-center text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          Access is by invitation.
        </p>
      </div>
    </div>
  );
};
