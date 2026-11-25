import React, { useState } from 'react';
import {
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Bell,
  Lock,
  Database,
  AlertTriangle,
  User,
  KeyRound,
  LogIn,
  UserPlus,
} from 'lucide-react';
import {
  isSupabaseConfigured,
  normalizeUsername,
  registerWithNameAndPassword,
  signInWithNameAndPassword,
} from '../lib/supabase';

interface AuthScreenProps {
  authError?: string | null;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ authError }) => {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(authError || null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const previewHandle = normalizeUsername(name);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);

    if (name.trim().length < 3) {
      setError('Please enter a name with at least 3 characters.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const { data, error: signUpErr } = await registerWithNameAndPassword(name, password);
        if (signUpErr) {
          setError(signUpErr.message);
        } else if (!data.session) {
          setInfoMsg(
            'Account created, but your Supabase project has "Confirm email" enabled. In Supabase Dashboard -> Authentication -> Providers -> Email, turn OFF "Confirm email", then switch to Sign In.'
          );
          setMode('login');
        }
      } else {
        const { error: signInErr } = await signInWithNameAndPassword(name, password);
        if (signInErr) {
          setError(signInErr.message);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[var(--bg-app)] relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-emerald-500/15 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-4xl grid md:grid-cols-2 rounded-3xl overflow-hidden border border-[var(--border-strong)] bg-[var(--bg-panel)] shadow-2xl">
        {/* Left Brand & Features Panel */}
        <div className="p-8 md:p-10 flex flex-col justify-between bg-gradient-to-br from-indigo-600/20 via-[var(--bg-panel)] to-[var(--bg-sidebar)] border-b md:border-b-0 md:border-r border-[var(--border-subtle)]">
          <div>
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] text-xs font-semibold mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              Real-Time Workspace & Chat
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                  PulseChat
                </h1>
                <p className="text-xs text-[var(--text-secondary)]">Powered by Supabase</p>
              </div>
            </div>

            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mt-4">
              Fast, private, real-time messaging with direct chats, groups, channels, polls, voice
              notes, disappearing messages, and deep personalization.
            </p>
          </div>

          <div className="mt-8 space-y-3.5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Simple Name & Password Access
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Register in seconds with your display name and password.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Bell className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Live Presence, Typing & Read Receipts
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Realtime sync powered by Supabase Postgres & Channels.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Every Setting You Expect
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Themes, wallpapers, privacy controls, app lock PIN, and more.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sign-In / Register Form */}
        <div className="p-8 md:p-10 flex flex-col justify-center">
          <div className="flex gap-2 p-1 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                mode === 'register'
                  ? 'bg-[var(--accent)] text-white shadow'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Create Account
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                mode === 'login'
                  ? 'bg-[var(--accent)] text-white shadow'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </button>
          </div>

          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">
            {mode === 'register' ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-5">
            {mode === 'register'
              ? 'Choose a name and password to start chatting.'
              : 'Enter your name and password to sign in.'}
          </p>

          {!isSupabaseConfigured && (
            <div className="mb-5 p-3.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-200 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
              <span>Supabase `.env` credentials are missing.</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {infoMsg && (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs leading-relaxed">
              {infoMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Vishu"
                  autoComplete="username"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-strong)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              {previewHandle && !name.includes('@') && (
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  Handle: <span className="text-[var(--accent-text)]">@{previewHandle}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-strong)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isSupabaseConfigured}
              className="w-full py-3 px-5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? mode === 'register'
                  ? 'Creating account...'
                  : 'Signing in...'
                : mode === 'register'
                  ? 'Register & Start Chatting'
                  : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              Supabase Realtime DB
            </span>
            <span>Name & Password Auth</span>
          </div>
        </div>
      </div>
    </div>
  );
};
