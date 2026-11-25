import React, { useState } from 'react';
import { Lock, LogOut, ShieldAlert } from 'lucide-react';

interface AppLockOverlayProps {
  expectedPin: string;
  userEmail: string;
  onUnlock: () => void;
  onSignOut: () => void;
}

export const AppLockOverlay: React.FC<AppLockOverlayProps> = ({
  expectedPin,
  userEmail,
  onUnlock,
  onSignOut,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === expectedPin) {
      setError('');
      onUnlock();
    } else {
      setError('Incorrect PIN. Please try again.');
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-app)]/95 backdrop-blur-xl flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-strong)] p-7 shadow-2xl text-center space-y-5"
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-text)] flex items-center justify-center">
          <Lock className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">PulseChat Locked</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">{userEmail}</p>
        </div>

        <input
          type="password"
          inputMode="numeric"
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Enter your App Lock PIN"
          autoFocus
          className="w-full px-4 py-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-strong)] text-center text-lg tracking-widest text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
        />

        {error && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-rose-400">
            <ShieldAlert className="w-3.5 h-3.5" />
            {error}
          </div>
        )}

        <button
          type="submit"
          className="w-full py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold text-sm transition cursor-pointer"
        >
          Unlock
        </button>

        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out instead
        </button>
      </form>
    </div>
  );
};
