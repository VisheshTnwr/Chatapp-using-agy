import React from 'react';
import type { PresenceStatus } from '../types/chat';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  presence?: PresenceStatus;
  showPresence?: boolean;
  statusEmoji?: string;
  isGroup?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'w-7 h-7 text-xs',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

const DOT_SIZES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'w-2 h-2 border',
  sm: 'w-2.5 h-2.5 border-2',
  md: 'w-3 h-3 border-2',
  lg: 'w-3.5 h-3.5 border-2',
  xl: 'w-4 h-4 border-2',
};

const PRESENCE_COLORS: Record<PresenceStatus, string> = {
  online: 'bg-emerald-500',
  away: 'bg-amber-400',
  dnd: 'bg-rose-500',
  offline: 'bg-slate-500',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getColorFromName(name: string): string {
  const palette = [
    'from-indigo-500 to-violet-600',
    'from-emerald-500 to-teal-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600',
    'from-sky-500 to-blue-600',
    'from-fuchsia-500 to-purple-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  presence = 'offline',
  showPresence = false,
  statusEmoji,
  isGroup = false,
}) => {
  return (
    <div className="relative inline-flex shrink-0">
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${SIZE_CLASSES[size]} rounded-full object-cover ring-1 ring-white/10`}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div
          className={`${SIZE_CLASSES[size]} rounded-full bg-gradient-to-br ${getColorFromName(name)} flex items-center justify-center font-semibold text-white select-none shadow-sm`}
        >
          {isGroup ? `#${getInitials(name).slice(0, 1)}` : getInitials(name)}
        </div>
      )}

      {showPresence && (
        <span
          title={presence.toUpperCase()}
          className={`absolute bottom-0 right-0 ${DOT_SIZES[size]} ${PRESENCE_COLORS[presence]} rounded-full border-[var(--bg-sidebar)]`}
        />
      )}

      {statusEmoji && !showPresence && (
        <span className="absolute -bottom-0.5 -right-0.5 text-xs leading-none bg-[var(--bg-panel)] rounded-full p-0.5 border border-[var(--border-subtle)]">
          {statusEmoji}
        </span>
      )}
    </div>
  );
};
