import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { MessageSquare, Sparkles } from 'lucide-react';
import {
  DEFAULT_SETTINGS,
  type ConversationWithDetails,
  type MemberRole,
  type Message,
  type MessageReaction,
  type PollVote,
  type PresenceStatus,
  type Profile,
  type UserSettings,
} from './types/chat';
import { isSupabaseConfigured, supabase, uploadChatFile } from './lib/supabase';
import { playNotificationSound, playSendSound } from './lib/sounds';
import { AuthScreen } from './components/AuthScreen';
import { AppLockOverlay } from './components/AppLockOverlay';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { ChatInfoDrawer } from './components/ChatInfoDrawer';
import { NewChatModal } from './components/NewChatModal';
import { StarredMessagesModal } from './components/StarredMessagesModal';
import { SettingsModal } from './components/SettingsModal';

const DRAFTS_STORAGE_KEY = 'pulsechat_drafts_v1';

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [appLocked, setAppLocked] = useState(false);

  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messagesByConv, setMessagesByConv] = useState<Record<string, Message[]>>({});
  const [deletedForMeIds, setDeletedForMeIds] = useState<Set<string>>(new Set());
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [starredMessages, setStarredMessages] = useState<Message[]>([]);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [blockedProfiles, setBlockedProfiles] = useState<Profile[]>([]);

  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [typingByConv, setTypingByConv] = useState<Record<string, string[]>>({});
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(DRAFTS_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  });

  // UI Modals & Drawers
  const [newChatModal, setNewChatModal] = useState<'direct' | 'group' | 'invite' | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showStarred, setShowStarred] = useState(false);
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const sidebarSearchRef = useRef<HTMLInputElement | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingBroadcastRef = useRef<number>(0);

  const settings: UserSettings = useMemo(
    () => ({ ...DEFAULT_SETTINGS, ...(currentUser?.settings || {}) }),
    [currentUser?.settings]
  );

  const conversationsRef = useRef<ConversationWithDetails[]>([]);
  conversationsRef.current = conversations;
  const activeConvIdRef = useRef<string | null>(null);
  activeConvIdRef.current = activeConvId;
  const currentUserRef = useRef<Profile | null>(null);
  currentUserRef.current = currentUser;
  const settingsRef = useRef<UserSettings>(settings);
  settingsRef.current = settings;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Apply Theme, Accent, Font Size, High Contrast, Reduced Motion to <html>
  useEffect(() => {
    const root = document.documentElement;
    let resolvedTheme = settings.theme;
    if (resolvedTheme === 'system') {
      resolvedTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    root.setAttribute('data-theme', resolvedTheme);
    root.setAttribute('data-accent', settings.accentColor);
    root.setAttribute('data-font-size', settings.fontSize);
    root.setAttribute('data-contrast', settings.highContrast ? 'high' : 'normal');
    root.setAttribute('data-motion', settings.reducedMotion ? 'reduced' : 'normal');
  }, [
    settings.theme,
    settings.accentColor,
    settings.fontSize,
    settings.highContrast,
    settings.reducedMotion,
  ]);

  // Persist drafts
  useEffect(() => {
    if (settings.saveDrafts) {
      localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
    }
  }, [drafts, settings.saveDrafts]);

  // Global Ctrl+K shortcut for search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        sidebarSearchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Tab unread badge
  useEffect(() => {
    const totalUnread = conversations
      .filter((c) => !c.my_membership.is_archived)
      .reduce((acc, c) => acc + c.unread_count, 0);
    document.title =
      settings.tabBadge && totalUnread > 0 ? `(${totalUnread}) PulseChat` : 'PulseChat — Real-Time Messaging';
  }, [conversations, settings.tabBadge]);

  // Auth listener
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthReady(true);
      return;
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setAuthError(error.message);
      setSession(data.session);
      setAuthReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setCurrentUser(null);
        setConversations([]);
        setActiveConvId(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Load or initialize profile for authenticated user
  const loadProfile = useCallback(async (uid: string, currentSession: Session) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (error) {
      setAuthError(error.message);
      return null;
    }
    if (data) {
      const prof = data as Profile;
      setCurrentUser(prof);
      if (prof.settings?.appLockEnabled && prof.settings?.appLockPin) {
        setAppLocked(true);
      }
      return prof;
    }

    // Fallback creation if trigger didn't run
    const email = currentSession.user.email || '';
    const meta = currentSession.user.user_metadata || {};
    const fallbackUsername =
      (email.split('@')[0] || 'user').toLowerCase().replace(/[^a-z0-9_]/g, '') +
      '_' +
      uid.slice(0, 4);
    const { data: inserted } = await supabase
      .from('profiles')
      .insert({
        id: uid,
        email,
        username: fallbackUsername,
        full_name: (meta.full_name as string) || (meta.name as string) || email.split('@')[0] || 'User',
        avatar_url: (meta.avatar_url as string) || (meta.picture as string) || '',
      })
      .select('*')
      .single();

    if (inserted) {
      setCurrentUser(inserted as Profile);
      return inserted as Profile;
    }
    return null;
  }, []);

  // Load user's conversations + last messages + unread counts
  const loadConversations = useCallback(
    async (uid: string) => {
      const { data: memberships, error: memErr } = await supabase
        .from('conversation_members')
        .select('*, conversation:conversations(*)')
        .eq('user_id', uid);

      if (memErr || !memberships) return;

      const convIds = memberships.map((m) => m.conversation_id as string);
      if (convIds.length === 0) {
        setConversations([]);
        return;
      }

      const [{ data: allMembers }, { data: recentMsgs }] = await Promise.all([
        supabase
          .from('conversation_members')
          .select('*, profile:profiles(*)')
          .in('conversation_id', convIds),
        supabase
          .from('messages')
          .select('*')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false })
          .limit(400),
      ]);

      const membersByConv = new Map<string, ConversationWithDetails['members']>();
      for (const m of allMembers || []) {
        const list = membersByConv.get(m.conversation_id) || [];
        list.push(m as ConversationWithDetails['members'][number]);
        membersByConv.set(m.conversation_id, list);
      }

      const lastMsgByConv = new Map<string, Message>();
      const msgsList = (recentMsgs as Message[]) || [];
      for (const msg of msgsList) {
        if (!lastMsgByConv.has(msg.conversation_id)) {
          lastMsgByConv.set(msg.conversation_id, msg);
        }
      }

      const built: ConversationWithDetails[] = memberships
        .filter((m) => Boolean(m.conversation))
        .map((m) => {
          const conv = m.conversation as ConversationWithDetails;
          const members = membersByConv.get(conv.id) || [];
          const otherMember =
            conv.type === 'direct' ? members.find((mem) => mem.user_id !== uid) : undefined;
          const lastReadMs = new Date(m.last_read_at).getTime();
          const unreadCount = msgsList.filter(
            (msg) =>
              msg.conversation_id === conv.id &&
              msg.sender_id !== uid &&
              new Date(msg.created_at).getTime() > lastReadMs
          ).length;

          return {
            ...conv,
            members,
            my_membership: m,
            other_user: otherMember?.profile || null,
            last_message: lastMsgByConv.get(conv.id) || null,
            unread_count: unreadCount,
          };
        });

      setConversations(built);
    },
    []
  );

  // Load user metadata: blocked users, starred messages, deleted-for-me
  const loadUserMeta = useCallback(async (uid: string) => {
    const [{ data: blocks }, { data: stars }, { data: deleted }] = await Promise.all([
      supabase.from('blocked_users').select('blocked_id, blocked:profiles!blocked_users_blocked_id_fkey(*)').eq('blocker_id', uid),
      supabase
        .from('starred_messages')
        .select('message_id, message:messages(*, sender:profiles!messages_sender_id_fkey(*))')
        .eq('user_id', uid),
      supabase.from('deleted_messages_for_user').select('message_id').eq('user_id', uid),
    ]);

    const bIds = new Set<string>();
    const bProfs: Profile[] = [];
    for (const b of blocks || []) {
      bIds.add(b.blocked_id as string);
      if (b.blocked) bProfs.push(b.blocked as unknown as Profile);
    }
    setBlockedIds(bIds);
    setBlockedProfiles(bProfs);

    const sIds = new Set<string>();
    const sMsgs: Message[] = [];
    for (const s of stars || []) {
      sIds.add(s.message_id as string);
      if (s.message) sMsgs.push(s.message as unknown as Message);
    }
    setStarredIds(sIds);
    setStarredMessages(sMsgs);

    setDeletedForMeIds(new Set((deleted || []).map((d) => d.message_id as string)));
  }, []);

  // Load messages for a specific conversation
  const loadMessages = useCallback(
    async (convId: string, clearedAt?: string | null) => {
      let query = supabase
        .from('messages')
        .select(
          '*, sender:profiles!messages_sender_id_fkey(*), reactions:message_reactions(*), reads:message_reads(*), poll_votes(*)'
        )
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })
        .limit(200);

      if (clearedAt) {
        query = query.gt('created_at', clearedAt);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Failed to load messages:', error);
        showToast(`Failed to load messages: ${error.message}`);
        return;
      }
      const raw = (data as Message[]) || [];
      const byId = new Map(raw.map((m) => [m.id, m]));
      const hydrated = raw.map((m) => ({
        ...m,
        reply_to: m.reply_to_id ? byId.get(m.reply_to_id) || null : null,
      }));

      setMessagesByConv((prev) => ({ ...prev, [convId]: hydrated }));
    },
    [showToast]
  );

  // Initial data bootstrap once authenticated
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || !session) return;

    loadProfile(uid, session).then((prof) => {
      if (prof) {
        loadConversations(uid);
        loadUserMeta(uid);
      }
    });
  }, [session, loadProfile, loadConversations, loadUserMeta]);

  // Presence & global realtime listeners
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;

    const presenceChannel = supabase.channel('pulsechat-presence', {
      config: { presence: { key: uid } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        setOnlineUserIds(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ online_at: new Date().toISOString() });
        }
      });

    // Update last_seen periodically
    const heartbeat = window.setInterval(() => {
      supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', uid).then();
    }, 45000);

    const dbChannel = supabase
      .channel(`pulsechat-db-sync-${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          const row = (payload.new || payload.old) as Message | undefined;
          if (!row?.conversation_id) return;

          const latestConvs = conversationsRef.current;
          const latestActiveId = activeConvIdRef.current;
          const latestUser = currentUserRef.current;
          const latestSettings = settingsRef.current;

          if (payload.eventType === 'INSERT') {
            if (row.sender_id !== uid) {
              const targetConv = latestConvs.find((c) => c.id === row.conversation_id);
              const isMuted =
                targetConv?.my_membership.is_muted ||
                (targetConv?.my_membership.is_archived && latestSettings.keepArchivedMuted);

              if (!isMuted && latestUser?.presence_status !== 'dnd') {
                if (latestSettings.inAppSounds) {
                  playNotificationSound(latestSettings.notificationSound);
                }
                if (
                  latestSettings.desktopNotifications &&
                  document.hidden &&
                  'Notification' in window &&
                  Notification.permission === 'granted'
                ) {
                  const shouldAlert =
                    !latestSettings.mentionsOnly ||
                    targetConv?.type === 'direct' ||
                    row.content.includes(`@${latestUser?.username}`);
                  if (shouldAlert) {
                    new Notification(targetConv?.title || 'New Message', {
                      body: latestSettings.notificationPreview
                        ? row.content || `[${row.message_type}]`
                        : 'You have a new message',
                    });
                  }
                }
              }
            }

            loadConversations(uid);
            if (row.conversation_id === latestActiveId) {
              const conv = latestConvs.find((c) => c.id === latestActiveId);
              loadMessages(latestActiveId, conv?.my_membership.cleared_at);
              if (row.sender_id !== uid && latestSettings.readReceipts) {
                supabase.rpc('mark_conversation_read', { conv_id: latestActiveId }).then();
              }
            }
          } else {
            loadConversations(uid);
            if (row.conversation_id === latestActiveId) {
              const conv = latestConvs.find((c) => c.id === latestActiveId);
              loadMessages(latestActiveId, conv?.my_membership.cleared_at);
            }
          }
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => {
        const latestActiveId = activeConvIdRef.current;
        if (latestActiveId) {
          const conv = conversationsRef.current.find((c) => c.id === latestActiveId);
          loadMessages(latestActiveId, conv?.my_membership.cleared_at);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reads' }, () => {
        const latestActiveId = activeConvIdRef.current;
        if (latestActiveId) {
          const conv = conversationsRef.current.find((c) => c.id === latestActiveId);
          loadMessages(latestActiveId, conv?.my_membership.cleared_at);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, () => {
        const latestActiveId = activeConvIdRef.current;
        if (latestActiveId) {
          const conv = conversationsRef.current.find((c) => c.id === latestActiveId);
          loadMessages(latestActiveId, conv?.my_membership.cleared_at);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, () => {
        loadConversations(uid);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        loadConversations(uid);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
        loadConversations(uid);
      })
      .subscribe();

    return () => {
      clearInterval(heartbeat);
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(dbChannel);
    };
  }, [session?.user?.id, loadConversations, loadMessages]);

  // Typing indicator broadcast channel per active conversation
  useEffect(() => {
    if (!activeConvId || !currentUser) return;

    const channel = supabase.channel(`typing:${activeConvId}`);
    const clearTimers = new Map<string, number>();

    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const senderId = payload?.userId as string | undefined;
        const senderName = payload?.name as string | undefined;
        if (!senderId || senderId === currentUser.id || !senderName) return;

        setTypingByConv((prev) => {
          const existing = prev[activeConvId] || [];
          if (existing.includes(senderName)) return prev;
          return { ...prev, [activeConvId]: [...existing, senderName] };
        });

        const existingTimer = clearTimers.get(senderId);
        if (existingTimer) clearTimeout(existingTimer);
        const timerId = window.setTimeout(() => {
          setTypingByConv((prev) => ({
            ...prev,
            [activeConvId]: (prev[activeConvId] || []).filter((n) => n !== senderName),
          }));
        }, 2800);
        clearTimers.set(senderId, timerId);
      })
      .subscribe();

    typingChannelRef.current = channel;
    return () => {
      clearTimers.forEach((t) => clearTimeout(t));
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
    };
  }, [activeConvId, currentUser]);

  // Active conversation selection
  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConvId) || null,
    [conversations, activeConvId]
  );

  const handleSelectConversation = useCallback(
    async (convId: string) => {
      setActiveConvId(convId);
      if (window.innerWidth < 768) {
        setShowInfoDrawer(false);
      }
      const conv = conversations.find((c) => c.id === convId);
      await loadMessages(convId, conv?.my_membership.cleared_at);
      if (settings.readReceipts) {
        await supabase.rpc('mark_conversation_read', { conv_id: convId });
      } else if (currentUser) {
        await supabase
          .from('conversation_members')
          .update({ last_read_at: new Date().toISOString() })
          .eq('conversation_id', convId)
          .eq('user_id', currentUser.id);
      }
      if (currentUser) {
        await loadConversations(currentUser.id);
      }
    },
    [conversations, currentUser, loadConversations, loadMessages, settings.readReceipts]
  );

  const activeMessages = useMemo(() => {
    if (!activeConvId) return [];
    return (messagesByConv[activeConvId] || []).filter((m) => !deletedForMeIds.has(m.id));
  }, [activeConvId, deletedForMeIds, messagesByConv]);

  const handleBroadcastTyping = () => {
    if (!settings.typingIndicators || !typingChannelRef.current || !currentUser) return;
    const now = Date.now();
    if (now - lastTypingBroadcastRef.current < 1600) return;
    lastTypingBroadcastRef.current = now;
    typingChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId: currentUser.id,
        name: currentUser.full_name || currentUser.username,
      },
    });
  };

  const handleSendMessage = async (payload: {
    content: string;
    messageType?: Message['message_type'];
    replyToId?: string | null;
    attachmentUrl?: string;
    attachmentName?: string;
    attachmentSize?: number;
    attachmentMime?: string;
    metadata?: Record<string, unknown>;
  }) => {
    if (!activeConversation || !currentUser) return;
    const disappearingSeconds =
      activeConversation.disappearing_seconds || settings.defaultDisappearingSeconds || 0;
    const expiresAt =
      disappearingSeconds > 0
        ? new Date(Date.now() + disappearingSeconds * 1000).toISOString()
        : null;

    const { data: insertedMsg, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: activeConversation.id,
        sender_id: currentUser.id,
        content: payload.content,
        message_type: payload.messageType || 'text',
        reply_to_id: payload.replyToId || null,
        attachment_url: payload.attachmentUrl || '',
        attachment_name: payload.attachmentName || '',
        attachment_size: payload.attachmentSize || 0,
        attachment_mime: payload.attachmentMime || '',
        metadata: payload.metadata || {},
        expires_at: expiresAt,
      })
      .select('*')
      .single();

    if (error) {
      showToast(`Failed to send: ${error.message}`);
      return;
    }

    if (insertedMsg) {
      const msgWithSender: Message = {
        ...(insertedMsg as Message),
        sender: currentUser,
        reactions: [],
        reads: [],
        poll_votes: [],
      };
      setMessagesByConv((prev) => {
        const list = prev[activeConversation.id] || [];
        if (list.some((m) => m.id === msgWithSender.id)) return prev;
        return { ...prev, [activeConversation.id]: [...list, msgWithSender] };
      });
    }

    playSendSound(settings.inAppSounds);
    await loadMessages(activeConversation.id, activeConversation.my_membership.cleared_at);
    await loadConversations(currentUser.id);
  };

  const handleUploadAttachment = async (file: File | Blob, fileName: string) => {
    if (!activeConversation || !currentUser) {
      throw new Error('No active conversation');
    }
    const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${activeConversation.id}/${currentUser.id}-${Date.now()}-${cleanName}`;
    const { publicUrl, error } = await uploadChatFile('chat-attachments', path, file);
    if (error) {
      showToast(`Upload failed: ${error.message}`);
      throw error;
    }
    return {
      url: publicUrl,
      name: fileName,
      size: file.size,
      mime: file.type || 'application/octet-stream',
    };
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!activeConversation) return;
    await supabase
      .from('messages')
      .update({
        content: newContent,
        is_edited: true,
        edited_at: new Date().toISOString(),
      })
      .eq('id', messageId);
    await loadMessages(activeConversation.id, activeConversation.my_membership.cleared_at);
  };

  const handleReact = async (messageId: string, emoji: string) => {
    if (!currentUser || !activeConversation) return;
    const msg = activeMessages.find((m) => m.id === messageId);
    const existing = msg?.reactions?.find(
      (r: MessageReaction) => r.user_id === currentUser.id && r.emoji === emoji
    );
    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id);
    } else {
      await supabase
        .from('message_reactions')
        .insert({ message_id: messageId, user_id: currentUser.id, emoji });
    }
    await loadMessages(activeConversation.id, activeConversation.my_membership.cleared_at);
  };

  const handleDeleteForMe = async (messageId: string) => {
    if (!currentUser) return;
    setDeletedForMeIds((prev) => new Set(prev).add(messageId));
    await supabase
      .from('deleted_messages_for_user')
      .insert({ message_id: messageId, user_id: currentUser.id });
  };

  const handleDeleteForAll = async (messageId: string) => {
    if (!activeConversation) return;
    await supabase
      .from('messages')
      .update({ deleted_for_all: true, content: '', attachment_url: '' })
      .eq('id', messageId);
    await loadMessages(activeConversation.id, activeConversation.my_membership.cleared_at);
  };

  const handleToggleStar = async (messageId: string) => {
    if (!currentUser) return;
    if (starredIds.has(messageId)) {
      await supabase
        .from('starred_messages')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('message_id', messageId);
    } else {
      await supabase
        .from('starred_messages')
        .insert({ user_id: currentUser.id, message_id: messageId });
    }
    await loadUserMeta(currentUser.id);
  };

  const handleTogglePin = async (messageId: string, currentlyPinned: boolean) => {
    if (!activeConversation) return;
    await supabase.from('messages').update({ is_pinned: !currentlyPinned }).eq('id', messageId);
    await loadMessages(activeConversation.id, activeConversation.my_membership.cleared_at);
  };

  const handleForwardMessage = async (msg: Message, targetConvId: string) => {
    if (!currentUser) return;
    await supabase.from('messages').insert({
      conversation_id: targetConvId,
      sender_id: currentUser.id,
      content: msg.content,
      message_type: msg.message_type,
      forwarded_from_id: msg.id,
      attachment_url: msg.attachment_url,
      attachment_name: msg.attachment_name,
      attachment_size: msg.attachment_size,
      attachment_mime: msg.attachment_mime,
      metadata: msg.metadata,
    });
    showToast('Message forwarded');
    await loadConversations(currentUser.id);
  };

  const handleVotePoll = async (messageId: string, optionIndex: number) => {
    if (!currentUser || !activeConversation) return;
    const msg = activeMessages.find((m) => m.id === messageId);
    const existingVotes = (msg?.poll_votes || []).filter((v: PollVote) => v.user_id === currentUser.id);
    const alreadySame = existingVotes.some((v) => v.option_index === optionIndex);

    await supabase
      .from('poll_votes')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', currentUser.id);

    if (!alreadySame) {
      await supabase
        .from('poll_votes')
        .insert({ message_id: messageId, user_id: currentUser.id, option_index: optionIndex });
    }
    await loadMessages(activeConversation.id, activeConversation.my_membership.cleared_at);
  };

  const handleReportMessage = async (msg: Message) => {
    if (!currentUser) return;
    await supabase.from('user_reports').insert({
      reporter_id: currentUser.id,
      target_user_id: msg.sender_id,
      message_id: msg.id,
      reason: 'Reported from chat menu',
    });
    showToast('Message reported to moderation.');
  };

  const jumpToMessage = (messageId: string) => {
    setHighlightedMessageId(messageId);
    setTimeout(() => {
      const el = document.getElementById(`msg-${messageId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
    setTimeout(() => setHighlightedMessageId(null), 2600);
  };

  // Profile & settings updates
  const handleSaveProfile = async (patch: Partial<Profile>) => {
    if (!currentUser) return;
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', currentUser.id)
      .select('*')
      .single();

    if (error) throw error;
    if (data) setCurrentUser(data as Profile);
  };

  const handleUpdateSettings = async (patch: Partial<UserSettings>) => {
    if (!currentUser) return;
    const nextSettings: UserSettings = { ...settings, ...patch };
    setCurrentUser({ ...currentUser, settings: nextSettings });
    await supabase
      .from('profiles')
      .update({ settings: nextSettings, updated_at: new Date().toISOString() })
      .eq('id', currentUser.id);
  };

  const handleStartDirectChat = async (targetUserId: string) => {
    const { data, error } = await supabase.rpc('create_direct_conversation', {
      target_user_id: targetUserId,
    });
    if (error) {
      showToast(error.message);
      return;
    }
    if (currentUser) await loadConversations(currentUser.id);
    if (data) await handleSelectConversation(data as string);
  };

  const handleCreateGroup = async (
    title: string,
    type: 'group' | 'channel',
    description: string,
    memberIds: string[]
  ) => {
    const { data, error } = await supabase.rpc('create_group_conversation', {
      group_title: title,
      group_type: type,
      group_description: description,
      member_ids: memberIds,
    });
    if (error) throw error;
    if (currentUser) await loadConversations(currentUser.id);
    if (data) await handleSelectConversation(data as string);
  };

  const handleJoinByInvite = async (code: string) => {
    const { data, error } = await supabase.rpc('join_conversation_by_invite', { invite: code });
    if (error) throw error;
    if (currentUser) await loadConversations(currentUser.id);
    if (data) await handleSelectConversation(data as string);
  };

  const handleExportJson = (filename: string, payload: unknown) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAppLocked(false);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)] text-[var(--text-secondary)] text-sm">
        Loading PulseChat...
      </div>
    );
  }

  if (!session || !currentUser) {
    return <AuthScreen authError={authError} />;
  }

  const isOtherBlocked =
    activeConversation?.type === 'direct' && activeConversation.other_user
      ? blockedIds.has(activeConversation.other_user.id)
      : false;

  return (
    <div className="h-[100dvh] w-screen overflow-hidden flex bg-[var(--bg-app)] text-[var(--text-primary)]">
      {appLocked && settings.appLockEnabled && settings.appLockPin && (
        <AppLockOverlay
          expectedPin={settings.appLockPin}
          userEmail={currentUser.email}
          onUnlock={() => setAppLocked(false)}
          onSignOut={handleSignOut}
        />
      )}

      {/* Left Sidebar (hidden on mobile when a conversation is active) */}
      <div className={`${activeConvId ? 'hidden md:flex' : 'flex'} w-full md:w-auto h-full`}>
        <Sidebar
          currentUser={currentUser}
          settings={settings}
          conversations={conversations}
          activeConversationId={activeConvId}
          onlineUserIds={onlineUserIds}
          typingByConv={typingByConv}
          drafts={drafts}
          onSelectConversation={handleSelectConversation}
          onOpenNewChat={(tab) => setNewChatModal(tab)}
          onOpenSettings={() => setShowSettings(true)}
          onOpenStarred={() => setShowStarred(true)}
          onChangePresence={(status: PresenceStatus) => handleSaveProfile({ presence_status: status })}
          searchInputRef={sidebarSearchRef}
        />
      </div>

      {/* Main Chat Pane */}
      <main className={`${activeConvId ? 'flex' : 'hidden md:flex'} flex-1 h-full min-w-0`}>
        {activeConversation ? (
          <>
            <ChatWindow
              conversation={activeConversation}
              allConversations={conversations}
              messages={activeMessages}
              currentUser={currentUser}
              settings={settings}
              onlineUserIds={onlineUserIds}
              typingNames={typingByConv[activeConversation.id] || []}
              starredIds={starredIds}
              isBlocked={isOtherBlocked}
              draft={drafts[activeConversation.id] || ''}
              highlightedMessageId={highlightedMessageId}
              showInfoDrawer={showInfoDrawer}
              onBackMobile={() => setActiveConvId(null)}
              onToggleInfoDrawer={() => setShowInfoDrawer((v) => !v)}
              onChangeDraft={(text) =>
                setDrafts((prev) => ({ ...prev, [activeConversation.id]: text }))
              }
              onTyping={handleBroadcastTyping}
              onSendMessage={handleSendMessage}
              onUploadAttachment={handleUploadAttachment}
              onEditMessage={handleEditMessage}
              onReact={handleReact}
              onDeleteForMe={handleDeleteForMe}
              onDeleteForAll={handleDeleteForAll}
              onToggleStar={handleToggleStar}
              onTogglePin={handleTogglePin}
              onForwardMessage={handleForwardMessage}
              onVotePoll={handleVotePoll}
              onReportMessage={handleReportMessage}
              onJumpToMessage={jumpToMessage}
            />

            {showInfoDrawer && (
              <div className="fixed inset-0 z-40 md:static md:z-auto flex justify-end bg-black/50 md:bg-transparent">
                <ChatInfoDrawer
                  conversation={activeConversation}
                  messages={activeMessages}
                  currentUserId={currentUser.id}
                  settings={settings}
                  isBlocked={isOtherBlocked}
                  isOnline={
                    Boolean(
                      activeConversation.other_user &&
                        onlineUserIds.has(activeConversation.other_user.id) &&
                        activeConversation.other_user.presence_status !== 'offline'
                    )
                  }
                  onClose={() => setShowInfoDrawer(false)}
                  onTogglePinChat={async () => {
                    await supabase
                      .from('conversation_members')
                      .update({ is_pinned: !activeConversation.my_membership.is_pinned })
                      .eq('conversation_id', activeConversation.id)
                      .eq('user_id', currentUser.id);
                    await loadConversations(currentUser.id);
                  }}
                  onSetMute={async (muted, untilIso) => {
                    await supabase
                      .from('conversation_members')
                      .update({ is_muted: muted, mute_until: untilIso })
                      .eq('conversation_id', activeConversation.id)
                      .eq('user_id', currentUser.id);
                    await loadConversations(currentUser.id);
                  }}
                  onToggleArchiveChat={async () => {
                    await supabase
                      .from('conversation_members')
                      .update({ is_archived: !activeConversation.my_membership.is_archived })
                      .eq('conversation_id', activeConversation.id)
                      .eq('user_id', currentUser.id);
                    await loadConversations(currentUser.id);
                  }}
                  onSetDisappearing={async (seconds) => {
                    await supabase
                      .from('conversations')
                      .update({ disappearing_seconds: seconds })
                      .eq('id', activeConversation.id);
                    await loadConversations(currentUser.id);
                  }}
                  onSetSlowMode={async (seconds) => {
                    await supabase
                      .from('conversations')
                      .update({ slow_mode_seconds: seconds })
                      .eq('id', activeConversation.id);
                    await loadConversations(currentUser.id);
                  }}
                  onToggleOnlyAdmins={async () => {
                    await supabase
                      .from('conversations')
                      .update({ only_admins_can_send: !activeConversation.only_admins_can_send })
                      .eq('id', activeConversation.id);
                    await loadConversations(currentUser.id);
                  }}
                  onClearChat={async () => {
                    const nowIso = new Date().toISOString();
                    await supabase
                      .from('conversation_members')
                      .update({ cleared_at: nowIso })
                      .eq('conversation_id', activeConversation.id)
                      .eq('user_id', currentUser.id);
                    await loadMessages(activeConversation.id, nowIso);
                    await loadConversations(currentUser.id);
                  }}
                  onExportChat={() =>
                    handleExportJson(`pulsechat-${activeConversation.id}.json`, {
                      conversation: activeConversation,
                      messages: activeMessages,
                    })
                  }
                  onToggleBlockUser={async (targetId) => {
                    if (blockedIds.has(targetId)) {
                      await supabase
                        .from('blocked_users')
                        .delete()
                        .eq('blocker_id', currentUser.id)
                        .eq('blocked_id', targetId);
                    } else {
                      await supabase
                        .from('blocked_users')
                        .insert({ blocker_id: currentUser.id, blocked_id: targetId });
                    }
                    await loadUserMeta(currentUser.id);
                  }}
                  onLeaveGroup={async () => {
                    await supabase
                      .from('conversation_members')
                      .delete()
                      .eq('conversation_id', activeConversation.id)
                      .eq('user_id', currentUser.id);
                    setShowInfoDrawer(false);
                    setActiveConvId(null);
                    await loadConversations(currentUser.id);
                  }}
                  onRegenerateInvite={async () => {
                    const nextCode = Math.random().toString(36).slice(2, 10);
                    await supabase
                      .from('conversations')
                      .update({ invite_code: nextCode })
                      .eq('id', activeConversation.id);
                    await loadConversations(currentUser.id);
                  }}
                  onAddMember={async (uid) => {
                    await supabase
                      .from('conversation_members')
                      .insert({ conversation_id: activeConversation.id, user_id: uid, role: 'member' });
                    await loadConversations(currentUser.id);
                  }}
                  onChangeMemberRole={async (uid, role: MemberRole) => {
                    await supabase
                      .from('conversation_members')
                      .update({ role })
                      .eq('conversation_id', activeConversation.id)
                      .eq('user_id', uid);
                    await loadConversations(currentUser.id);
                  }}
                  onRemoveMember={async (uid) => {
                    await supabase
                      .from('conversation_members')
                      .delete()
                      .eq('conversation_id', activeConversation.id)
                      .eq('user_id', uid);
                    await loadConversations(currentUser.id);
                  }}
                  onUpdateGroupDetails={async (title, description) => {
                    await supabase
                      .from('conversations')
                      .update({ title, description })
                      .eq('id', activeConversation.id);
                    await loadConversations(currentUser.id);
                  }}
                  onUpdateNickname={async (nickname) => {
                    await supabase
                      .from('conversation_members')
                      .update({ nickname })
                      .eq('conversation_id', activeConversation.id)
                      .eq('user_id', currentUser.id);
                    await loadConversations(currentUser.id);
                    showToast('Nickname updated');
                  }}
                  onJumpToMessage={jumpToMessage}
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center chat-wallpaper-gradient">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-2xl mb-5">
              <MessageSquare className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">PulseChat</h2>
            <p className="text-sm text-[var(--text-secondary)] max-w-md mt-2">
              Signed in as <strong>{currentUser.full_name || currentUser.username}</strong> (@{currentUser.username}). Pick a conversation on the left or start a new DM, Group, or Broadcast Channel.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => setNewChatModal('direct')}
                className="px-4 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold transition cursor-pointer"
              >
                Start a Direct Chat
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="px-4 py-2.5 rounded-xl bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] border border-[var(--border-strong)] text-sm font-semibold text-[var(--text-primary)] transition cursor-pointer inline-flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-[var(--accent-text)]" />
                Customize Settings
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {newChatModal && (
        <NewChatModal
          initialTab={newChatModal}
          currentUserId={currentUser.id}
          onClose={() => setNewChatModal(null)}
          onStartDirectChat={handleStartDirectChat}
          onCreateGroup={handleCreateGroup}
          onJoinByInvite={handleJoinByInvite}
        />
      )}

      {showStarred && (
        <StarredMessagesModal
          messages={starredMessages}
          timeFormat={settings.timeFormat}
          onClose={() => setShowStarred(false)}
          onJumpToMessage={async (convId, msgId) => {
            await handleSelectConversation(convId);
            jumpToMessage(msgId);
          }}
          onUnstar={handleToggleStar}
        />
      )}

      {showSettings && (
        <SettingsModal
          currentUser={currentUser}
          settings={settings}
          blockedProfiles={blockedProfiles}
          onClose={() => setShowSettings(false)}
          onSaveProfile={handleSaveProfile}
          onUpdateSettings={handleUpdateSettings}
          onResetSettings={() => handleUpdateSettings(DEFAULT_SETTINGS)}
          onUnblockUser={async (uid) => {
            await supabase
              .from('blocked_users')
              .delete()
              .eq('blocker_id', currentUser.id)
              .eq('blocked_id', uid);
            await loadUserMeta(currentUser.id);
          }}
          onExportAllChats={() =>
            handleExportJson('pulsechat-export.json', {
              profile: currentUser,
              conversations,
              messagesByConv,
            })
          }
          onClearLocalCache={() => {
            localStorage.removeItem(DRAFTS_STORAGE_KEY);
            setDrafts({});
          }}
          onLockNow={() => {
            setShowSettings(false);
            setAppLocked(true);
          }}
          onSignOut={handleSignOut}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-strong)] shadow-2xl text-xs font-medium text-[var(--text-primary)]">
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
