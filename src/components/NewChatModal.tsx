import React, { useEffect, useState } from 'react';
import { X, Search, Users, Hash, Link2, Check, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/chat';
import { Avatar } from './Avatar';

interface NewChatModalProps {
  initialTab: 'direct' | 'group' | 'invite';
  currentUserId: string;
  onClose: () => void;
  onStartDirectChat: (targetUserId: string) => Promise<void>;
  onCreateGroup: (
    title: string,
    type: 'group' | 'channel',
    description: string,
    memberIds: string[]
  ) => Promise<void>;
  onJoinByInvite: (code: string) => Promise<void>;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  initialTab,
  currentUserId,
  onClose,
  onStartDirectChat,
  onCreateGroup,
  onJoinByInvite,
}) => {
  const [tab, setTab] = useState<'direct' | 'group' | 'invite'>(initialTab);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Group creation state
  const [groupTitle, setGroupTitle] = useState('');
  const [groupType, setGroupType] = useState<'group' | 'channel'>('group');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Invite code state
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    let active = true;
    const loadUsers = async () => {
      setLoading(true);
      let req = supabase
        .from('profiles')
        .select('*')
        .neq('id', currentUserId)
        .order('full_name', { ascending: true })
        .limit(40);

      if (query.trim()) {
        const q = query.trim();
        req = req.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,username.ilike.%${q}%`);
      }

      const { data, error: fetchError } = await req;
      if (!active) return;
      if (fetchError) {
        setError(fetchError.message);
      } else {
        setUsers((data as Profile[]) || []);
      }
      setLoading(false);
    };

    const timer = setTimeout(loadUsers, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, currentUserId]);

  const toggleMember = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupTitle.trim()) {
      setError('Please enter a group or channel name.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onCreateGroup(groupTitle.trim(), groupType, groupDescription.trim(), selectedIds);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setError('');
    setLoading(true);
    try {
      await onJoinByInvite(inviteCode.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid invite code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-strong)] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h3 className="font-bold text-base text-[var(--text-primary)]">Start Conversation</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 flex gap-2 border-b border-[var(--border-subtle)] pb-3">
          <button
            onClick={() => setTab('direct')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              tab === 'direct'
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Direct Message
          </button>
          <button
            onClick={() => setTab('group')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              tab === 'group'
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Group / Channel
          </button>
          <button
            onClick={() => setTab('invite')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              tab === 'invite'
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            Join via Code
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {tab === 'invite' ? (
          <form onSubmit={handleJoinInvite} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Group or Channel Invite Code
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Paste invite code (e.g. a1b2c3d4e5f6)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-strong)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !inviteCode.trim()}
              className="w-full py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold text-sm transition cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Joining...' : 'Join Conversation'}
            </button>
          </form>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {tab === 'group' && (
              <div className="space-y-3 pb-3 border-b border-[var(--border-subtle)]">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGroupType('group')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                      groupType === 'group'
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Group Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupType('channel')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                      groupType === 'channel'
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <Hash className="w-4 h-4" />
                    Broadcast Channel
                  </button>
                </div>

                <input
                  type="text"
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                  placeholder={groupType === 'group' ? 'Group Name' : 'Channel Name'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />

                <input
                  type="text"
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            )}

            <div className="relative">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search users by name or @username..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {loading && users.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-6">Searching users...</p>
              ) : users.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-6">
                  No other users found yet. Register another account to chat!
                </p>
              ) : (
                users.map((u) => {
                  const selected = selectedIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={async () => {
                        if (tab === 'direct') {
                          await onStartDirectChat(u.id);
                          onClose();
                        } else {
                          toggleMember(u.id);
                        }
                      }}
                      className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-2xl transition cursor-pointer ${
                        selected
                          ? 'bg-[var(--accent-soft)] border border-[var(--accent)]/40'
                          : 'hover:bg-[var(--bg-hover)] border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 text-left">
                        <Avatar src={u.avatar_url} name={u.full_name || u.email} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                            {u.full_name || u.username}
                          </p>
                          <p className="text-[11px] text-[var(--text-secondary)] truncate">
                            @{u.username} · {u.email}
                          </p>
                        </div>
                      </div>

                      {tab === 'group' && (
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                            selected
                              ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                              : 'border-[var(--border-strong)]'
                          }`}
                        >
                          {selected && <Check className="w-3 h-3" />}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {tab === 'group' && (
              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={loading || !groupTitle.trim()}
                className="w-full py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold text-sm transition cursor-pointer disabled:opacity-50"
              >
                Create {groupType === 'group' ? 'Group' : 'Channel'} ({selectedIds.length} members)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
