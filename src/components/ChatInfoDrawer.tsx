import React, { useState } from 'react';
import {
  X,
  Pin,
  VolumeX,
  Volume2,
  Archive,
  Trash2,
  Download,
  UserX,
  LogOut,
  Copy,
  Check,
  RefreshCw,
  Timer,
  Shield,
  Users,
  Image as ImageIcon,
  FileText,
  Link as LinkIcon,
  UserPlus,
  Crown,
  Gauge,
  Lock,
} from 'lucide-react';
import type {
  ConversationWithDetails,
  MemberRole,
  Message,
  Profile,
  UserSettings,
} from '../types/chat';
import { Avatar } from './Avatar';
import {
  extractFirstUrl,
  formatDisappearingDuration,
  formatFileSize,
  formatLastSeen,
} from '../lib/formatters';
import { supabase } from '../lib/supabase';

interface ChatInfoDrawerProps {
  conversation: ConversationWithDetails;
  messages: Message[];
  currentUserId: string;
  settings: UserSettings;
  isBlocked: boolean;
  isOnline: boolean;
  onClose: () => void;
  onTogglePinChat: () => void;
  onSetMute: (muted: boolean, untilIso: string | null) => void;
  onToggleArchiveChat: () => void;
  onSetDisappearing: (seconds: number) => void;
  onSetSlowMode: (seconds: number) => void;
  onToggleOnlyAdmins: () => void;
  onClearChat: () => void;
  onExportChat: () => void;
  onToggleBlockUser: (targetId: string) => void;
  onLeaveGroup: () => void;
  onRegenerateInvite: () => Promise<void>;
  onAddMember: (userId: string) => Promise<void>;
  onChangeMemberRole: (userId: string, role: MemberRole) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  onUpdateGroupDetails: (title: string, description: string) => Promise<void>;
  onUpdateNickname: (nickname: string) => Promise<void>;
  onJumpToMessage: (messageId: string) => void;
}

type InfoTab = 'overview' | 'media' | 'files' | 'links' | 'members';

const DISAPPEARING_OPTIONS = [
  { label: 'Off', seconds: 0 },
  { label: '30 seconds', seconds: 30 },
  { label: '5 minutes', seconds: 300 },
  { label: '1 hour', seconds: 3600 },
  { label: '24 hours', seconds: 86400 },
  { label: '7 days', seconds: 604800 },
];

const SLOW_MODE_OPTIONS = [
  { label: 'Off', seconds: 0 },
  { label: '5s', seconds: 5 },
  { label: '15s', seconds: 15 },
  { label: '30s', seconds: 30 },
  { label: '60s', seconds: 60 },
];

export const ChatInfoDrawer: React.FC<ChatInfoDrawerProps> = ({
  conversation,
  messages,
  currentUserId,
  settings,
  isBlocked,
  isOnline,
  onClose,
  onTogglePinChat,
  onSetMute,
  onToggleArchiveChat,
  onSetDisappearing,
  onSetSlowMode,
  onToggleOnlyAdmins,
  onClearChat,
  onExportChat,
  onToggleBlockUser,
  onLeaveGroup,
  onRegenerateInvite,
  onAddMember,
  onChangeMemberRole,
  onRemoveMember,
  onUpdateGroupDetails,
  onUpdateNickname,
  onJumpToMessage,
}) => {
  const [tab, setTab] = useState<InfoTab>('overview');
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [editingGroup, setEditingGroup] = useState(false);
  const [groupTitle, setGroupTitle] = useState(conversation.title);
  const [groupDesc, setGroupDesc] = useState(conversation.description);
  const [nickname, setNickname] = useState(conversation.my_membership.nickname || '');
  const [addQuery, setAddQuery] = useState('');
  const [addCandidates, setAddCandidates] = useState<Profile[]>([]);

  const isDirect = conversation.type === 'direct';
  const myRole = conversation.my_membership.role;
  const isAdmin = myRole === 'owner' || myRole === 'admin';

  const displayName = isDirect
    ? conversation.my_membership.nickname ||
      conversation.other_user?.full_name ||
      conversation.other_user?.email ||
      'Direct Chat'
    : conversation.title;

  const mediaMessages = messages.filter(
    (m) => !m.deleted_for_all && (m.message_type === 'image' || m.message_type === 'video') && m.attachment_url
  );
  const fileMessages = messages.filter(
    (m) => !m.deleted_for_all && m.message_type === 'file' && m.attachment_url
  );
  const linkMessages = messages.filter((m) => !m.deleted_for_all && extractFirstUrl(m.content));
  const pinnedMessages = messages.filter((m) => !m.deleted_for_all && m.is_pinned);

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(conversation.invite_code);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 1800);
  };

  const searchMembersToAdd = async (q: string) => {
    setAddQuery(q);
    if (!q.trim()) {
      setAddCandidates([]);
      return;
    }
    const existingIds = new Set(conversation.members.map((m) => m.user_id));
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,username.ilike.%${q}%`)
      .limit(10);
    setAddCandidates(((data as Profile[]) || []).filter((u) => !existingIds.has(u.id)));
  };

  return (
    <aside className="w-full sm:w-80 lg:w-96 shrink-0 h-full bg-[var(--bg-sidebar)] border-l border-[var(--border-subtle)] flex flex-col">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <h3 className="font-bold text-sm text-[var(--text-primary)]">
          {isDirect ? 'Contact Info' : conversation.type === 'channel' ? 'Channel Info' : 'Group Info'}
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] cursor-pointer"
        >
          <X className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="px-3 py-2 border-b border-[var(--border-subtle)] flex gap-1 overflow-x-auto">
        {(
          [
            { id: 'overview', label: 'Overview' },
            { id: 'media', label: `Media (${mediaMessages.length})` },
            { id: 'files', label: `Files (${fileMessages.length})` },
            { id: 'links', label: `Links (${linkMessages.length})` },
            ...(!isDirect ? [{ id: 'members', label: `Members (${conversation.members.length})` }] : []),
          ] as { id: InfoTab; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
              tab === t.id
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {tab === 'overview' && (
          <>
            {/* Profile / Group Header */}
            <div className="text-center space-y-2.5">
              <div className="flex justify-center">
                <Avatar
                  src={isDirect ? conversation.other_user?.avatar_url : conversation.avatar_url}
                  name={displayName}
                  size="xl"
                  isGroup={!isDirect}
                  showPresence={isDirect}
                  presence={
                    isDirect && isOnline
                      ? conversation.other_user?.presence_status || 'online'
                      : 'offline'
                  }
                />
              </div>

              {editingGroup && !isDirect ? (
                <div className="space-y-2 text-left">
                  <input
                    value={groupTitle}
                    onChange={(e) => setGroupTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-strong)] text-sm text-[var(--text-primary)]"
                    placeholder="Group title"
                  />
                  <textarea
                    value={groupDesc}
                    onChange={(e) => setGroupDesc(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-strong)] text-xs text-[var(--text-primary)]"
                    placeholder="Description"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        await onUpdateGroupDetails(groupTitle, groupDesc);
                        setEditingGroup(false);
                      }}
                      className="flex-1 py-1.5 rounded-xl bg-[var(--accent)] text-white text-xs font-semibold cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingGroup(false)}
                      className="px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] text-xs text-[var(--text-secondary)] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <h4 className="font-bold text-base text-[var(--text-primary)]">{displayName}</h4>
                    {isDirect && conversation.other_user && (
                      <p className="text-xs text-[var(--text-secondary)]">
                        @{conversation.other_user.username} · {conversation.other_user.email}
                      </p>
                    )}
                    {!isDirect && (
                      <p className="text-xs text-[var(--text-secondary)]">
                        {conversation.members.length} members · {conversation.type}
                      </p>
                    )}
                  </div>

                  {isDirect && conversation.other_user?.bio && (
                    <p className="text-xs text-[var(--text-secondary)] bg-[var(--bg-elevated)] rounded-xl p-2.5 border border-[var(--border-subtle)]">
                      {conversation.other_user.bio}
                    </p>
                  )}

                  {isDirect && conversation.other_user && (
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {isOnline
                        ? 'Online now'
                        : `Last seen ${formatLastSeen(conversation.other_user.last_seen, settings.timeFormat)}`}
                    </p>
                  )}

                  {!isDirect && (
                    <div className="space-y-2">
                      {conversation.description && (
                        <p className="text-xs text-[var(--text-secondary)] bg-[var(--bg-elevated)] rounded-xl p-2.5">
                          {conversation.description}
                        </p>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => setEditingGroup(true)}
                          className="text-xs text-[var(--accent-text)] hover:underline cursor-pointer"
                        >
                          Edit group details
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Custom Nickname for DM */}
            {isDirect && (
              <div className="p-3 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Custom Contact Nickname
                </label>
                <div className="flex gap-2">
                  <input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Optional nickname..."
                    className="flex-1 px-2.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                  />
                  <button
                    onClick={() => onUpdateNickname(nickname)}
                    className="px-3 py-1.5 rounded-xl bg-[var(--accent)] text-white text-xs font-medium cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {/* Group Invite Code */}
            {!isDirect && (
              <div className="p-3 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Invite Code
                  </span>
                  {isAdmin && (
                    <button
                      onClick={onRegenerateInvite}
                      className="inline-flex items-center gap-1 text-[11px] text-[var(--accent-text)] hover:underline cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Regenerate
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--bg-elevated)] font-mono text-xs text-[var(--text-primary)]">
                  <span>{conversation.invite_code}</span>
                  <button
                    onClick={handleCopyInvite}
                    className="p-1 rounded-lg hover:bg-[var(--bg-hover)] cursor-pointer"
                  >
                    {copiedInvite ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Quick Chat Controls */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] px-1">
                Chat Preferences
              </p>

              <button
                onClick={onTogglePinChat}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Pin className="w-4 h-4 text-[var(--accent-text)]" />
                  {conversation.my_membership.is_pinned ? 'Unpin conversation' : 'Pin conversation'}
                </span>
                <span className="text-[var(--text-muted)]">
                  {conversation.my_membership.is_pinned ? 'Pinned' : 'Off'}
                </span>
              </button>

              <div className="px-3 py-2.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--text-primary)]">
                  <span className="flex items-center gap-2.5">
                    {conversation.my_membership.is_muted ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                    )}
                    Mute Notifications
                  </span>
                  <span className="text-[var(--text-muted)]">
                    {conversation.my_membership.is_muted ? 'Muted' : 'Active'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  <button
                    onClick={() => onSetMute(false, null)}
                    className={`py-1 rounded-lg text-[10px] font-medium cursor-pointer ${
                      !conversation.my_membership.is_muted
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                    }`}
                  >
                    Unmute
                  </button>
                  <button
                    onClick={() =>
                      onSetMute(true, new Date(Date.now() + 3600 * 1000).toISOString())
                    }
                    className="py-1 rounded-lg text-[10px] font-medium bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] cursor-pointer"
                  >
                    1h
                  </button>
                  <button
                    onClick={() =>
                      onSetMute(true, new Date(Date.now() + 8 * 3600 * 1000).toISOString())
                    }
                    className="py-1 rounded-lg text-[10px] font-medium bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] cursor-pointer"
                  >
                    8h
                  </button>
                  <button
                    onClick={() => onSetMute(true, null)}
                    className={`py-1 rounded-lg text-[10px] font-medium cursor-pointer ${
                      conversation.my_membership.is_muted && !conversation.my_membership.mute_until
                        ? 'bg-rose-500 text-white'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                    }`}
                  >
                    Always
                  </button>
                </div>
              </div>

              <button
                onClick={onToggleArchiveChat}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Archive className="w-4 h-4 text-amber-400" />
                  {conversation.my_membership.is_archived ? 'Unarchive chat' : 'Archive chat'}
                </span>
              </button>

              {/* Disappearing Messages Timer */}
              <div className="px-3 py-2.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--text-primary)]">
                  <span className="flex items-center gap-2.5">
                    <Timer className="w-4 h-4 text-sky-400" />
                    Disappearing Messages
                  </span>
                  <span className="text-[var(--text-muted)]">
                    {formatDisappearingDuration(conversation.disappearing_seconds)}
                  </span>
                </div>
                {(isDirect || isAdmin) && (
                  <select
                    value={conversation.disappearing_seconds}
                    onChange={(e) => onSetDisappearing(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                  >
                    {DISAPPEARING_OPTIONS.map((opt) => (
                      <option key={opt.seconds} value={opt.seconds}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Admin-only Group Moderation */}
              {!isDirect && isAdmin && (
                <div className="p-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] space-y-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    Admin Moderation
                  </p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-[var(--text-primary)]">
                      <Gauge className="w-3.5 h-3.5 text-amber-400" />
                      Slow Mode
                    </span>
                    <select
                      value={conversation.slow_mode_seconds}
                      onChange={(e) => onSetSlowMode(Number(e.target.value))}
                      className="px-2 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                    >
                      {SLOW_MODE_OPTIONS.map((opt) => (
                        <option key={opt.seconds} value={opt.seconds}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={onToggleOnlyAdmins}
                    className="w-full flex items-center justify-between text-xs py-1 cursor-pointer"
                  >
                    <span className="flex items-center gap-2 text-[var(--text-primary)]">
                      <Lock className="w-3.5 h-3.5 text-indigo-400" />
                      Only admins can send
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        conversation.only_admins_can_send
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                      }`}
                    >
                      {conversation.only_admins_can_send ? 'On' : 'Off'}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Pinned Messages Summary */}
            {pinnedMessages.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] px-1">
                  Pinned Messages ({pinnedMessages.length})
                </p>
                <div className="space-y-1.5">
                  {pinnedMessages.map((pm) => (
                    <button
                      key={pm.id}
                      onClick={() => onJumpToMessage(pm.id)}
                      className="w-full text-left p-2.5 rounded-xl bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] truncate cursor-pointer"
                    >
                      📌 {pm.content || `[${pm.message_type}]`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Danger / Export Actions */}
            <div className="space-y-1.5 pt-2 border-t border-[var(--border-subtle)]">
              <button
                onClick={onExportChat}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[var(--bg-hover)] text-xs text-[var(--text-primary)] cursor-pointer"
              >
                <Download className="w-4 h-4 text-sky-400" />
                Export chat history (JSON)
              </button>
              <button
                onClick={onClearChat}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-rose-500/10 text-xs text-rose-400 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Clear chat for me
              </button>
              {isDirect && conversation.other_user && (
                <button
                  onClick={() => onToggleBlockUser(conversation.other_user!.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-rose-500/10 text-xs text-rose-400 cursor-pointer"
                >
                  <UserX className="w-4 h-4" />
                  {isBlocked ? 'Unblock user' : 'Block user'}
                </button>
              )}
              {!isDirect && (
                <button
                  onClick={onLeaveGroup}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-rose-500/10 text-xs text-rose-400 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Leave {conversation.type}
                </button>
              )}
            </div>
          </>
        )}

        {tab === 'media' && (
          <div className="grid grid-cols-3 gap-2">
            {mediaMessages.length === 0 ? (
              <div className="col-span-3 py-10 text-center text-xs text-[var(--text-muted)]">
                <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No shared photos or videos yet
              </div>
            ) : (
              mediaMessages.map((m) => (
                <a
                  key={m.id}
                  href={m.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square rounded-xl overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
                >
                  {m.message_type === 'image' ? (
                    <img
                      src={m.attachment_url}
                      alt={m.attachment_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video src={m.attachment_url} className="w-full h-full object-cover" />
                  )}
                </a>
              ))
            )}
          </div>
        )}

        {tab === 'files' && (
          <div className="space-y-2">
            {fileMessages.length === 0 ? (
              <div className="py-10 text-center text-xs text-[var(--text-muted)]">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No shared files yet
              </div>
            ) : (
              fileMessages.map((m) => (
                <a
                  key={m.id}
                  href={m.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]"
                >
                  <FileText className="w-6 h-6 text-[var(--accent-text)] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                      {m.attachment_name}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {formatFileSize(m.attachment_size)}
                    </p>
                  </div>
                </a>
              ))
            )}
          </div>
        )}

        {tab === 'links' && (
          <div className="space-y-2">
            {linkMessages.length === 0 ? (
              <div className="py-10 text-center text-xs text-[var(--text-muted)]">
                <LinkIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No shared links yet
              </div>
            ) : (
              linkMessages.map((m) => {
                const url = extractFirstUrl(m.content)!;
                return (
                  <a
                    key={m.id}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-2.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]"
                  >
                    <p className="text-xs font-medium text-[var(--accent-text)] truncate">{url}</p>
                    <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
                      {m.content}
                    </p>
                  </a>
                );
              })
            )}
          </div>
        )}

        {tab === 'members' && !isDirect && (
          <div className="space-y-4">
            {isAdmin && (
              <div className="space-y-2">
                <div className="relative">
                  <UserPlus className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={addQuery}
                    onChange={(e) => searchMembersToAdd(e.target.value)}
                    placeholder="Add member by name or username..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                  />
                </div>
                {addCandidates.length > 0 && (
                  <div className="rounded-xl bg-[var(--bg-panel)] border border-[var(--border-strong)] p-1 space-y-1">
                    {addCandidates.map((u) => (
                      <button
                        key={u.id}
                        onClick={async () => {
                          await onAddMember(u.id);
                          setAddQuery('');
                          setAddCandidates([]);
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-xs text-[var(--text-primary)] cursor-pointer"
                      >
                        <span className="truncate">{u.full_name || u.email}</span>
                        <span className="text-[var(--accent-text)] font-semibold">+ Add</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              {conversation.members.map((m) => (
                <div
                  key={m.user_id}
                  className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-subtle)]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar
                      src={m.profile?.avatar_url}
                      name={m.profile?.full_name || m.profile?.email || 'Member'}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--text-primary)] truncate flex items-center gap-1">
                        {m.profile?.full_name || m.profile?.username}
                        {m.role !== 'member' && (
                          <span title={m.role} className="inline-flex shrink-0">
                            <Crown className="w-3 h-3 text-amber-400" />
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] truncate">
                        {m.role} · {m.profile?.email}
                      </p>
                    </div>
                  </div>

                  {isAdmin && m.user_id !== currentUserId && m.role !== 'owner' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          onChangeMemberRole(m.user_id, m.role === 'admin' ? 'member' : 'admin')
                        }
                        className="px-2 py-1 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[10px] text-[var(--text-secondary)] cursor-pointer"
                      >
                        {m.role === 'admin' ? 'Demote' : 'Admin'}
                      </button>
                      <button
                        onClick={() => onRemoveMember(m.user_id)}
                        className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-[10px] text-rose-400 cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 text-center text-[11px] text-[var(--text-muted)] flex items-center justify-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {conversation.members.length} total members
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
