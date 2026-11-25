import React, { useState } from 'react';
import {
  Reply,
  Smile,
  Star,
  Pin,
  Forward,
  Copy,
  Edit3,
  Trash2,
  Check,
  CheckCheck,
  FileText,
  Download,
  MoreHorizontal,
  Timer,
  ExternalLink,
  Flag,
  Eye,
} from 'lucide-react';
import type { Message, PollMetadata, UserSettings } from '../types/chat';
import { Avatar } from './Avatar';
import {
  QUICK_REACTIONS,
  extractFirstUrl,
  formatFileSize,
  formatMessageTime,
} from '../lib/formatters';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showSenderInfo: boolean;
  isGroup: boolean;
  currentUserId: string;
  settings: UserSettings;
  isStarred: boolean;
  isHighlighted: boolean;
  searchQuery?: string;
  onReply: (message: Message) => void;
  onReact: (messageId: string, emoji: string) => void;
  onEdit: (message: Message) => void;
  onDeleteForMe: (messageId: string) => void;
  onDeleteForAll: (messageId: string) => void;
  onToggleStar: (messageId: string) => void;
  onTogglePin: (messageId: string, currentPinned: boolean) => void;
  onForward: (message: Message) => void;
  onVotePoll: (messageId: string, optionIndex: number) => void;
  onJumpToMessage: (messageId: string) => void;
  onOpenImage: (url: string, name: string) => void;
  onShowReadReceipts: (message: Message) => void;
  onReportMessage: (message: Message) => void;
}

function renderFormattedText(text: string, searchQuery?: string): React.ReactNode {
  if (!text) return null;

  // Handle code blocks first
  const segments = text.split(/(```[\s\S]*?```)/g);
  return segments.map((seg, idx) => {
    if (seg.startsWith('```') && seg.endsWith('```') && seg.length >= 6) {
      const codeContent = seg.slice(3, -3).replace(/^\w+\n/, '');
      return (
        <pre
          key={idx}
          className="my-1.5 p-2.5 rounded-xl bg-black/40 border border-white/10 font-mono text-xs overflow-x-auto text-slate-100"
        >
          <code>{codeContent}</code>
        </pre>
      );
    }

    // Split inline tokens: links, inline code, bold, italic, strikethrough
    const parts = seg.split(/(https?:\/\/[^\s<>"']+|`[^`]+`|\*\*[^*]+\*\*|~~[^~]+~~|\*[^*]+\*)/g);
    return (
      <React.Fragment key={idx}>
        {parts.map((part, pIdx) => {
          if (!part) return null;
          if (/^https?:\/\//i.test(part)) {
            return (
              <a
                key={pIdx}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-current/60 hover:opacity-80 break-all"
              >
                {part}
              </a>
            );
          }
          if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
            return (
              <code
                key={pIdx}
                className="px-1.5 py-0.5 rounded bg-black/25 font-mono text-[0.88em]"
              >
                {part.slice(1, -1)}
              </code>
            );
          }
          if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
            return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
          }
          if (part.startsWith('~~') && part.endsWith('~~') && part.length >= 4) {
            return <del key={pIdx}>{part.slice(2, -2)}</del>;
          }
          if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
            return <em key={pIdx}>{part.slice(1, -1)}</em>;
          }

          if (searchQuery && searchQuery.trim()) {
            const q = searchQuery.trim();
            const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            const subParts = part.split(regex);
            return (
              <React.Fragment key={pIdx}>
                {subParts.map((sp, sIdx) =>
                  sp.toLowerCase() === q.toLowerCase() ? (
                    <mark key={sIdx} className="bg-amber-400 text-slate-900 rounded px-0.5">
                      {sp}
                    </mark>
                  ) : (
                    sp
                  )
                )}
              </React.Fragment>
            );
          }
          return part;
        })}
      </React.Fragment>
    );
  });
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  showSenderInfo,
  isGroup,
  currentUserId,
  settings,
  isStarred,
  isHighlighted,
  searchQuery,
  onReply,
  onReact,
  onEdit,
  onDeleteForMe,
  onDeleteForAll,
  onToggleStar,
  onTogglePin,
  onForward,
  onVotePoll,
  onJumpToMessage,
  onOpenImage,
  onShowReadReceipts,
  onReportMessage,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showReactionTray, setShowReactionTray] = useState(false);
  const [showMobileSheet, setShowMobileSheet] = useState(false);
  const [copied, setCopied] = useState(false);

  if (message.message_type === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span className="px-3 py-1 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)]">
          {message.sender?.full_name ? `${message.sender.full_name} ` : ''}
          {message.content}
        </span>
      </div>
    );
  }

  // Group reactions by emoji
  const reactionCounts = new Map<string, { count: number; reactedByMe: boolean }>();
  for (const r of message.reactions || []) {
    const existing = reactionCounts.get(r.emoji) || { count: 0, reactedByMe: false };
    existing.count += 1;
    if (r.user_id === currentUserId) existing.reactedByMe = true;
    reactionCounts.set(r.emoji, existing);
  }

  const readCount = (message.reads || []).filter((r) => r.user_id !== currentUserId).length;
  const firstUrl =
    settings.linkPreviews && !message.deleted_for_all && message.message_type === 'text'
      ? extractFirstUrl(message.content)
      : null;

  const bubbleRadius =
    settings.bubbleStyle === 'classic'
      ? 'rounded-lg'
      : settings.bubbleStyle === 'minimal'
        ? 'rounded-md'
        : isOwn
          ? 'rounded-2xl rounded-br-sm'
          : 'rounded-2xl rounded-bl-sm';

  const bubbleColors =
    settings.bubbleStyle === 'minimal'
      ? isOwn
        ? 'bg-[var(--accent-soft)] text-[var(--text-primary)] border border-[var(--accent)]/40'
        : 'bg-[var(--bg-panel)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
      : isOwn
        ? 'text-white shadow-sm'
        : 'bg-[var(--bg-bubble-in)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-sm';

  const spacingClass = settings.density === 'compact' ? 'py-0.5' : 'py-1.5';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    setShowActions(false);
  };

  return (
    <div
      id={`msg-${message.id}`}
      className={`group flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${spacingClass} ${
        isHighlighted ? 'message-highlight' : ''
      }`}
      onMouseLeave={() => {
        setShowActions(false);
        setShowReactionTray(false);
      }}
    >
      {/* Avatar column */}
      {settings.showAvatars && (isGroup || !isOwn) && (
        <div className="w-8 shrink-0 flex justify-center">
          {showSenderInfo && !isOwn ? (
            <Avatar
              src={message.sender?.avatar_url}
              name={message.sender?.full_name || message.sender?.email || 'User'}
              size="xs"
            />
          ) : (
            <div className="w-7" />
          )}
        </div>
      )}

      {/* Bubble + Reactions Container */}
      <div className={`relative max-w-[78%] md:max-w-[65%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        {showSenderInfo && !isOwn && isGroup && (
          <span className="text-[11px] font-semibold text-[var(--accent-text)] mb-1 px-1">
            {message.sender?.full_name || message.sender?.username || 'Member'}
          </span>
        )}

        <div
          onClick={(e) => {
            if (message.deleted_for_all) return;
            const target = e.target as HTMLElement;
            if (target.closest('a, button, audio, video, input')) return;
            if (window.innerWidth < 768) {
              setShowMobileSheet(true);
            }
          }}
          className={`relative px-3.5 py-2 ${bubbleRadius} ${bubbleColors}`}
          style={{
            background:
              isOwn && settings.bubbleStyle !== 'minimal' ? 'var(--bubble-out)' : undefined,
            fontSize: 'var(--chat-font-size)',
          }}
        >
          {/* Forwarded Tag */}
          {message.forwarded_from_id && !message.deleted_for_all && (
            <div className="flex items-center gap-1 text-[10px] opacity-75 italic mb-1">
              <Forward className="w-3 h-3" />
              Forwarded
            </div>
          )}

          {/* Reply Quote */}
          {message.reply_to && !message.deleted_for_all && (
            <button
              type="button"
              onClick={() => onJumpToMessage(message.reply_to!.id)}
              className={`w-full text-left mb-1.5 px-2.5 py-1.5 rounded-xl border-l-2 text-xs transition cursor-pointer ${
                isOwn && settings.bubbleStyle !== 'minimal'
                  ? 'bg-black/20 border-white/70 text-white/90 hover:bg-black/30'
                  : 'bg-[var(--bg-elevated)] border-[var(--accent)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <p className="font-semibold text-[11px] truncate">
                {message.reply_to.sender?.full_name || 'Message'}
              </p>
              <p className="truncate opacity-80">
                {message.reply_to.deleted_for_all
                  ? 'Deleted message'
                  : message.reply_to.content || `[${message.reply_to.message_type}]`}
              </p>
            </button>
          )}

          {/* Content */}
          {message.deleted_for_all ? (
            <p className="italic opacity-65 text-xs py-0.5">This message was deleted</p>
          ) : (
            <div className="space-y-1.5">
              {/* Image */}
              {message.message_type === 'image' && message.attachment_url && (
                <button
                  type="button"
                  onClick={() => onOpenImage(message.attachment_url, message.attachment_name || 'Image')}
                  className="block rounded-xl overflow-hidden max-w-xs sm:max-w-sm cursor-zoom-in"
                >
                  <img
                    src={message.attachment_url}
                    alt={message.attachment_name || 'Attachment'}
                    className="max-h-72 w-auto object-cover rounded-xl"
                  />
                </button>
              )}

              {/* Video */}
              {message.message_type === 'video' && message.attachment_url && (
                <video
                  src={message.attachment_url}
                  controls
                  className="max-h-72 max-w-xs sm:max-w-sm rounded-xl bg-black"
                />
              )}

              {/* Audio / Voice Note */}
              {message.message_type === 'audio' && message.attachment_url && (
                <div className="min-w-[220px] py-1">
                  <audio src={message.attachment_url} controls className="w-full h-9" />
                </div>
              )}

              {/* Generic File */}
              {message.message_type === 'file' && message.attachment_url && (
                <a
                  href={message.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={message.attachment_name}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition ${
                    isOwn && settings.bubbleStyle !== 'minimal'
                      ? 'bg-black/20 border-white/20 hover:bg-black/30'
                      : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <FileText className="w-7 h-7 shrink-0 opacity-85" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{message.attachment_name || 'File'}</p>
                    <p className="text-[10px] opacity-75">{formatFileSize(message.attachment_size)}</p>
                  </div>
                  <Download className="w-4 h-4 shrink-0 opacity-85" />
                </a>
              )}

              {/* Interactive Poll */}
              {message.message_type === 'poll' && (
                <div className="min-w-[240px] space-y-2 py-0.5">
                  {(() => {
                    const poll = message.metadata as unknown as PollMetadata;
                    const votes = message.poll_votes || [];
                    const totalVotes = votes.length;
                    return (
                      <>
                        <p className="font-semibold text-sm">{poll?.question || message.content}</p>
                        <div className="space-y-1.5">
                          {(poll?.options || []).map((opt, idx) => {
                            const optionVotes = votes.filter((v) => v.option_index === idx);
                            const myVote = optionVotes.some((v) => v.user_id === currentUserId);
                            const pct = totalVotes > 0 ? Math.round((optionVotes.length / totalVotes) * 100) : 0;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => onVotePoll(message.id, idx)}
                                className={`relative w-full text-left px-3 py-2 rounded-xl border overflow-hidden transition cursor-pointer ${
                                  myVote
                                    ? 'border-white/70 bg-white/15 font-semibold'
                                    : 'border-white/15 bg-black/15 hover:bg-black/25'
                                }`}
                              >
                                <div
                                  className="absolute inset-y-0 left-0 bg-white/15 transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                                <div className="relative flex items-center justify-between text-xs gap-2">
                                  <span>{opt}</span>
                                  <span>{pct}%</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] opacity-75">{totalVotes} vote{totalVotes === 1 ? '' : 's'}</p>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Text body */}
              {message.content && message.message_type !== 'poll' && (
                <div className="whitespace-pre-wrap break-words leading-relaxed">
                  {renderFormattedText(message.content, searchQuery)}
                </div>
              )}

              {/* Link Preview Card */}
              {firstUrl && (
                <a
                  href={firstUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border text-xs transition ${
                    isOwn && settings.bubbleStyle !== 'minimal'
                      ? 'bg-black/20 border-white/15 hover:bg-black/30'
                      : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{new URL(firstUrl).hostname}</p>
                    <p className="text-[11px] opacity-75 truncate">{firstUrl}</p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-75" />
                </a>
              )}
            </div>
          )}

          {/* Footer metadata: pin, star, edited, disappearing, time, read receipts */}
          <div className="flex items-center justify-end gap-1.5 mt-1 text-[10px] opacity-75 select-none">
            {message.expires_at && (
              <span title="Disappearing message" className="inline-flex">
                <Timer className="w-3 h-3" />
              </span>
            )}
            {message.is_pinned && (
              <span title="Pinned" className="inline-flex">
                <Pin className="w-3 h-3" />
              </span>
            )}
            {isStarred && (
              <span title="Starred" className="inline-flex">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              </span>
            )}
            {message.is_edited && !message.deleted_for_all && <span>(edited)</span>}
            <span>{formatMessageTime(message.created_at, settings.timeFormat)}</span>
            {isOwn && !message.deleted_for_all && (
              <button
                type="button"
                onClick={() => onShowReadReceipts(message)}
                className="inline-flex items-center cursor-pointer"
                title={readCount > 0 ? `Read by ${readCount}` : 'Sent'}
              >
                {readCount > 0 && settings.readReceipts ? (
                  <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Reactions Pills */}
        {reactionCounts.size > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 px-1">
            {Array.from(reactionCounts.entries()).map(([emoji, info]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(message.id, emoji)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition cursor-pointer ${
                  info.reactedByMe
                    ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--text-primary)]'
                    : 'bg-[var(--bg-panel)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <span>{emoji}</span>
                <span className="text-[11px] font-medium">{info.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Desktop Hover Action Toolbar */}
        {!message.deleted_for_all && (
          <div
            className={`hidden md:flex absolute top-0 ${
              isOwn ? '-left-2 -translate-x-full' : '-right-2 translate-x-full'
            } opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition items-center gap-0.5 bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-xl p-0.5 shadow-lg z-20`}
          >
            <button
              type="button"
              onClick={() => setShowReactionTray((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] cursor-pointer"
              title="React"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onReply(message)}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] cursor-pointer"
              title="Reply"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setShowActions((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] cursor-pointer"
              title="More options"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Quick Reaction Tray */}
        {showReactionTray && (
          <div
            className={`absolute -top-11 ${
              isOwn ? 'right-0' : 'left-0'
            } z-30 flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--bg-panel)] border border-[var(--border-strong)] shadow-xl`}
          >
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onReact(message.id, emoji);
                  setShowReactionTray(false);
                }}
                className="text-base hover:scale-125 transition cursor-pointer px-0.5"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Context Menu */}
        {showActions && (
          <div
            className={`absolute top-8 ${
              isOwn ? 'right-0' : 'left-0'
            } z-30 w-44 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-strong)] shadow-2xl p-1.5 text-xs space-y-0.5`}
          >
            <button
              type="button"
              onClick={() => {
                onToggleStar(message.id);
                setShowActions(false);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-primary)] cursor-pointer"
            >
              <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
              {isStarred ? 'Unstar message' : 'Star message'}
            </button>
            <button
              type="button"
              onClick={() => {
                onTogglePin(message.id, message.is_pinned);
                setShowActions(false);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-primary)] cursor-pointer"
            >
              <Pin className="w-3.5 h-3.5" />
              {message.is_pinned ? 'Unpin message' : 'Pin in chat'}
            </button>
            <button
              type="button"
              onClick={() => {
                onForward(message);
                setShowActions(false);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-primary)] cursor-pointer"
            >
              <Forward className="w-3.5 h-3.5" />
              Forward
            </button>
            {message.content && (
              <button
                type="button"
                onClick={handleCopy}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-primary)] cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? 'Copied!' : 'Copy text'}
              </button>
            )}
            {isOwn && message.message_type === 'text' && (
              <button
                type="button"
                onClick={() => {
                  onEdit(message);
                  setShowActions(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-primary)] cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit message
              </button>
            )}
            {isOwn && (
              <button
                type="button"
                onClick={() => {
                  onShowReadReceipts(message);
                  setShowActions(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-primary)] cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                Read receipts
              </button>
            )}
            <div className="border-t border-[var(--border-subtle)] my-1" />
            <button
              type="button"
              onClick={() => {
                onDeleteForMe(message.id);
                setShowActions(false);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete for me
            </button>
            {isOwn && (
              <button
                type="button"
                onClick={() => {
                  onDeleteForAll(message.id);
                  setShowActions(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-rose-500/15 text-rose-400 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete for everyone
              </button>
            )}
            {!isOwn && (
              <button
                type="button"
                onClick={() => {
                  onReportMessage(message);
                  setShowActions(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-rose-500/15 text-rose-400 cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5" />
                Report message
              </button>
            )}
          </div>
        )}

        {/* Mobile Bottom Action Sheet (tap message on phones) */}
        {showMobileSheet && !message.deleted_for_all && (
          <div
            onClick={() => setShowMobileSheet(false)}
            className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-t-3xl bg-[var(--bg-panel)] border-t border-[var(--border-strong)] p-4 pb-safe space-y-3 shadow-2xl"
            >
              <div className="w-10 h-1 rounded-full bg-[var(--border-strong)] mx-auto" />

              {/* Quick Reactions Row */}
              <div className="flex items-center justify-between px-2 py-2 rounded-2xl bg-[var(--bg-elevated)]">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onReact(message.id, emoji);
                      setShowMobileSheet(false);
                    }}
                    className="text-2xl p-1 active:scale-125 transition"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Action Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => {
                    onReply(message);
                    setShowMobileSheet(false);
                  }}
                  className="flex items-center gap-2.5 p-3 rounded-2xl bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                >
                  <Reply className="w-4 h-4 text-[var(--accent-text)]" />
                  Reply
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onToggleStar(message.id);
                    setShowMobileSheet(false);
                  }}
                  className="flex items-center gap-2.5 p-3 rounded-2xl bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                >
                  <Star className={`w-4 h-4 ${isStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
                  {isStarred ? 'Unstar' : 'Star'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onTogglePin(message.id, message.is_pinned);
                    setShowMobileSheet(false);
                  }}
                  className="flex items-center gap-2.5 p-3 rounded-2xl bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                >
                  <Pin className="w-4 h-4" />
                  {message.is_pinned ? 'Unpin' : 'Pin'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onForward(message);
                    setShowMobileSheet(false);
                  }}
                  className="flex items-center gap-2.5 p-3 rounded-2xl bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                >
                  <Forward className="w-4 h-4" />
                  Forward
                </button>
                {message.content && (
                  <button
                    type="button"
                    onClick={() => {
                      handleCopy();
                      setShowMobileSheet(false);
                    }}
                    className="flex items-center gap-2.5 p-3 rounded-2xl bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                )}
                {isOwn && message.message_type === 'text' && (
                  <button
                    type="button"
                    onClick={() => {
                      onEdit(message);
                      setShowMobileSheet(false);
                    }}
                    className="flex items-center gap-2.5 p-3 rounded-2xl bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit
                  </button>
                )}
                {isOwn && (
                  <button
                    type="button"
                    onClick={() => {
                      onShowReadReceipts(message);
                      setShowMobileSheet(false);
                    }}
                    className="flex items-center gap-2.5 p-3 rounded-2xl bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                  >
                    <Eye className="w-4 h-4" />
                    Read info
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onDeleteForMe(message.id);
                    setShowMobileSheet(false);
                  }}
                  className="flex items-center gap-2.5 p-3 rounded-2xl bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete for me
                </button>
                {isOwn ? (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteForAll(message.id);
                      setShowMobileSheet(false);
                    }}
                    className="flex items-center gap-2.5 p-3 rounded-2xl bg-rose-500/15 text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete all
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onReportMessage(message);
                      setShowMobileSheet(false);
                    }}
                    className="flex items-center gap-2.5 p-3 rounded-2xl bg-rose-500/15 text-rose-400"
                  >
                    <Flag className="w-4 h-4" />
                    Report
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
