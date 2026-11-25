import type { TimeFormat } from '../types/chat';

export function formatMessageTime(iso: string, format: TimeFormat = '12h'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: format === '12h',
  });
}

export function formatConversationTime(iso: string, format: TimeFormat = '12h'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return formatMessageTime(iso, format);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatDateDivider(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatLastSeen(iso: string, format: TimeFormat = '12h'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'recently';
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return `today at ${formatMessageTime(iso, format)}`;
  }
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${formatMessageTime(iso, format)}`;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let idx = 0;
  let value = bytes;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx++;
  }
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export function formatDisappearingDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return 'Off';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

const SHORTCODE_MAP: Record<string, string> = {
  ':)': '😊',
  ':-)': '😊',
  ':D': '😄',
  ':-D': '😄',
  ':(': '😞',
  ':-(': '😞',
  ';)': '😉',
  ';-)': '😉',
  ':P': '😛',
  ':O': '😮',
  '<3': '❤️',
  '</3': '💔',
  ':+1:': '👍',
  ':-1:': '👎',
  ':fire:': '🔥',
  ':heart:': '❤️',
  ':rocket:': '🚀',
  ':100:': '💯',
  ':joy:': '😂',
  ':eyes:': '👀',
  ':clap:': '👏',
  ':party:': '🥳',
};

export function convertShortcodes(text: string): string {
  let out = text;
  for (const [code, emoji] of Object.entries(SHORTCODE_MAP)) {
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'g'), `$1${emoji}`);
  }
  return out;
}

export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  return match ? match[0] : null;
}

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '🙏'];

export const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: 'Smileys',
    emojis: ['😀', '😂', '🥹', '😊', '😍', '🤩', '😘', '😜', '🤔', '😎', '🥳', '😴', '🤯', '😭', '😤', '🫠'],
  },
  {
    label: 'Gestures',
    emojis: ['👍', '👎', '👏', '🙌', '🤝', '🙏', '💪', '✌️', '🤞', '🫡', '👋', '🫶', '☝️', '👀', '🧠', '✨'],
  },
  {
    label: 'Hearts & Objects',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '🔥', '💯', '⚡', '🚀', '🎉', '🏆', '☕', '🎵'],
  },
];
