import React from 'react';
import { X, Star, ArrowUpRight } from 'lucide-react';
import type { Message, TimeFormat } from '../types/chat';
import { formatMessageTime } from '../lib/formatters';

interface StarredMessagesModalProps {
  messages: Message[];
  timeFormat: TimeFormat;
  onClose: () => void;
  onJumpToMessage: (conversationId: string, messageId: string) => void;
  onUnstar: (messageId: string) => void;
}

export const StarredMessagesModal: React.FC<StarredMessagesModalProps> = ({
  messages,
  timeFormat,
  onClose,
  onJumpToMessage,
  onUnstar,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-strong)] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            <h3 className="font-bold text-base text-[var(--text-primary)]">Starred Messages</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {messages.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--text-muted)]">
              No starred messages yet. Star important messages to find them quickly here.
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className="p-3.5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
                  <span className="font-semibold text-[var(--text-primary)]">
                    {msg.sender?.full_name || msg.sender?.email || 'Member'}
                  </span>
                  <span>{formatMessageTime(msg.created_at, timeFormat)}</span>
                </div>
                <p className="text-sm text-[var(--text-primary)] break-words">
                  {msg.content || msg.attachment_name || `[${msg.message_type}]`}
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => onUnstar(msg.id)}
                    className="text-xs text-[var(--text-muted)] hover:text-rose-400 transition cursor-pointer"
                  >
                    Remove star
                  </button>
                  <button
                    onClick={() => {
                      onJumpToMessage(msg.conversation_id, msg.id);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-text)] hover:underline cursor-pointer"
                  >
                    Jump to chat
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
