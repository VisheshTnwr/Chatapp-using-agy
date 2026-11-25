import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Users,
  Settings,
  Star,
  Pin,
  VolumeX,
  Archive,
  Hash,
  MessageSquarePlus,
  Link2,
  CircleDot,
} from 'lucide-react';
import type {
  ConversationWithDetails,
  PresenceStatus,
  Profile,
  UserSettings,
} from '../types/chat';
import { Avatar } from './Avatar';
import { formatConversationTime } from '../lib/formatters';

interface SidebarProps {
  currentUser: Profile;
  settings: UserSettings;
  conversations: ConversationWithDetails[];
  activeConversationId: string | null;
  onlineUserIds: Set<string>;
  typingByConv: Record<string, string[]>;
  drafts: Record<string, string>;
  onSelectConversation: (id: string) => void;
  onOpenNewChat: (initialTab: 'direct' | 'group' | 'invite') => void;
  onOpenSettings: () => void;
  onOpenStarred: () => void;
  onChangePresence: (status: PresenceStatus) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

type FilterTab = 'all' | 'unread' | 'direct' | 'groups' | 'archived';

const PRESENCE_OPTIONS: { value: PresenceStatus; label: string; dot: string }[] = [
  { value: 'online', label: 'Online', dot: 'bg-emerald-500' },
  { value: 'away', label: 'Away', dot: 'bg-amber-400' },
  { value: 'dnd', label: 'Do Not Disturb', dot: 'bg-rose-500' },
  { value: 'offline', label: 'Invisible', dot: 'bg-slate-500' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  settings,
  conversations,
  activeConversationId,
  onlineUserIds,
  typingByConv,
  drafts,
  onSelectConversation,
  onOpenNewChat,
  onOpenSettings,
  onOpenStarred,
  onChangePresence,
  searchInputRef,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [showPresenceMenu, setShowPresenceMenu] = useState(false);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return conversations
      .filter((conv) => {
        const isArchived = conv.my_membership.is_archived;
        if (filter === 'archived') {
          if (!isArchived) return false;
        } else if (isArchived) {
          return false;
        }

        if (filter === 'unread' && conv.unread_count === 0) return false;
        if (filter === 'direct' && conv.type !== 'direct') return false;
        if (filter === 'groups' && conv.type === 'direct') return false;

        if (!query) return true;
        const displayName =
          conv.type === 'direct'
            ? conv.other_user?.full_name || conv.other_user?.email || ''
            : conv.title;
        const username = conv.other_user?.username || '';
        const email = conv.other_user?.email || '';
        const preview = conv.last_message?.content || '';
        return (
          displayName.toLowerCase().includes(query) ||
          username.toLowerCase().includes(query) ||
          email.toLowerCase().includes(query) ||
          preview.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        if (a.my_membership.is_pinned !== b.my_membership.is_pinned) {
          return a.my_membership.is_pinned ? -1 : 1;
        }
        const aTime = new Date(a.last_message?.created_at || a.updated_at).getTime();
        const bTime = new Date(b.last_message?.created_at || b.updated_at).getTime();
        return bTime - aTime;
      });
  }, [conversations, filter, search]);

  const totalUnread = useMemo(
    () => conversations.filter((c) => !c.my_membership.is_archived).reduce((acc, c) => acc + c.unread_count, 0),
    [conversations]
  );

  const getEffectivePresence = (other?: Profile | null): PresenceStatus => {
    if (!other) return 'offline';
    if (other.presence_status === 'offline') return 'offline';
    if (onlineUserIds.has(other.id)) return other.presence_status || 'online';
    return 'offline';
  };

  return (
    <aside className="w-full md:w-[340px] lg:w-[370px] shrink-0 h-full flex flex-col bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] select-none">
      {/* Top User Header */}
      <div className="p-3.5 pt-safe flex items-center justify-between border-b border-[var(--border-subtle)]">
        <div className="relative flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => setShowPresenceMenu((v) => !v)}
            className="relative flex items-center gap-2.5 text-left rounded-xl p-1 -ml-1 hover:bg-[var(--bg-hover)] transition cursor-pointer min-w-0"
            title="Change presence status"
          >
            <Avatar
              src={currentUser.avatar_url}
              name={currentUser.full_name || currentUser.email}
              size="md"
              presence={currentUser.presence_status}
              showPresence
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-[var(--text-primary)] truncate">
                  {currentUser.full_name || currentUser.username}
                </span>
                {currentUser.status_emoji && (
                  <span className="text-xs" title={currentUser.status_text || 'Status'}>
                    {currentUser.status_emoji}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] truncate flex items-center gap-1">
                <CircleDot className="w-2.5 h-2.5 text-[var(--accent-text)] shrink-0" />
                {currentUser.status_text || `@${currentUser.username}`}
              </p>
            </div>
          </button>

          {showPresenceMenu && (
            <div
              className="absolute left-0 top-14 z-30 w-48 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-strong)] shadow-xl p-1.5"
              onMouseLeave={() => setShowPresenceMenu(false)}
            >
              {PRESENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    onChangePresence(opt.value);
                    setShowPresenceMenu(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                    currentUser.presence_status === opt.value
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                      : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${opt.dot}`} />
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onOpenStarred}
            className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition cursor-pointer"
            title="Starred Messages"
          >
            <Star className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={() => onOpenNewChat('direct')}
            className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition cursor-pointer"
            title="New Chat"
          >
            <MessageSquarePlus className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition cursor-pointer"
            title="All Settings"
          >
            <Settings className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Search & Quick Actions */}
      <div className="p-3 space-y-2.5 border-b border-[var(--border-subtle)]">
        <div className="relative">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats, people, messages"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-base sm:text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'unread', label: totalUnread > 0 ? `Unread (${totalUnread})` : 'Unread' },
              { id: 'direct', label: 'Direct' },
              { id: 'groups', label: 'Groups' },
              { id: 'archived', label: 'Archived' },
            ] as { id: FilterTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                filter === tab.id
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Quick Create Buttons */}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => onOpenNewChat('direct')}
            className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New DM
          </button>
          <button
            onClick={() => onOpenNewChat('group')}
            className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            New Group
          </button>
          <button
            onClick={() => onOpenNewChat('invite')}
            className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
          >
            <Link2 className="w-3.5 h-3.5" />
            Join Code
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filteredConversations.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-2">
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              {filter === 'archived' ? 'No archived chats' : 'No conversations found'}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Start a direct chat by searching a name or username, or create a new group.
            </p>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const isDirect = conv.type === 'direct';
            const title = isDirect
              ? conv.my_membership.nickname ||
                conv.other_user?.full_name ||
                conv.other_user?.email ||
                'Direct Chat'
              : conv.title || 'Untitled Group';

            const avatarSrc = isDirect ? conv.other_user?.avatar_url : conv.avatar_url;
            const presence = isDirect ? getEffectivePresence(conv.other_user) : 'offline';
            const typingNames = typingByConv[conv.id] || [];
            const draftText = drafts[conv.id];

            let preview = 'No messages yet';
            if (typingNames.length > 0) {
              preview = `${typingNames.join(', ')} typing...`;
            } else if (draftText) {
              preview = `Draft: ${draftText}`;
            } else if (conv.last_message) {
              const m = conv.last_message;
              if (m.deleted_for_all) preview = 'This message was deleted';
              else if (m.message_type === 'image') preview = '📷 Photo';
              else if (m.message_type === 'video') preview = '🎬 Video';
              else if (m.message_type === 'audio') preview = '🎤 Voice message';
              else if (m.message_type === 'file') preview = `📎 ${m.attachment_name || 'File'}`;
              else if (m.message_type === 'poll') preview = '📊 Poll';
              else preview = m.content;
            }

            const timeLabel = formatConversationTime(
              conv.last_message?.created_at || conv.updated_at,
              settings.timeFormat
            );

            return (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition cursor-pointer ${
                  isActive
                    ? 'bg-[var(--accent-soft)] border border-[var(--accent)]/30'
                    : 'hover:bg-[var(--bg-hover)] border border-transparent'
                }`}
              >
                <Avatar
                  src={avatarSrc}
                  name={title}
                  size="md"
                  isGroup={!isDirect}
                  showPresence={isDirect}
                  presence={presence}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-[var(--text-primary)] truncate flex items-center gap-1">
                      {conv.type === 'channel' && <Hash className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />}
                      {title}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] shrink-0">{timeLabel}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p
                      className={`text-xs truncate ${
                        typingNames.length > 0
                          ? 'text-[var(--accent-text)] font-medium'
                          : draftText
                            ? 'text-rose-400'
                            : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {preview}
                    </p>

                    <div className="flex items-center gap-1 shrink-0">
                      {conv.my_membership.is_pinned && (
                        <Pin className="w-3 h-3 text-[var(--text-muted)]" />
                      )}
                      {conv.my_membership.is_muted && (
                        <VolumeX className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                      )}
                      {conv.my_membership.is_archived && (
                        <Archive className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                      )}
                      {conv.unread_count > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-[var(--accent)] text-white text-[10px] font-bold flex items-center justify-center">
                          {conv.unread_count > 99 ? '99+' : conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};
