import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Search,
  Info,
  Pin,
  Send,
  Paperclip,
  Smile,
  Mic,
  Square,
  BarChart3,
  X,
  ChevronUp,
  ChevronDown,
  ArrowDown,
  Timer,
  ShieldAlert,
  Image as ImageIcon,
  FileUp,
  Forward,
  CheckCheck,
} from 'lucide-react';
import type {
  ConversationWithDetails,
  Message,
  PollMetadata,
  Profile,
  UserSettings,
} from '../types/chat';
import { Avatar } from './Avatar';
import { MessageBubble } from './MessageBubble';
import {
  EMOJI_CATEGORIES,
  convertShortcodes,
  formatDateDivider,
  formatDisappearingDuration,
  formatLastSeen,
  formatMessageTime,
} from '../lib/formatters';

interface ChatWindowProps {
  conversation: ConversationWithDetails;
  allConversations: ConversationWithDetails[];
  messages: Message[];
  currentUser: Profile;
  settings: UserSettings;
  onlineUserIds: Set<string>;
  typingNames: string[];
  starredIds: Set<string>;
  isBlocked: boolean;
  draft: string;
  highlightedMessageId: string | null;
  showInfoDrawer: boolean;
  onBackMobile: () => void;
  onToggleInfoDrawer: () => void;
  onChangeDraft: (text: string) => void;
  onTyping: () => void;
  onSendMessage: (payload: {
    content: string;
    messageType?: Message['message_type'];
    replyToId?: string | null;
    attachmentUrl?: string;
    attachmentName?: string;
    attachmentSize?: number;
    attachmentMime?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
  onUploadAttachment: (file: File | Blob, fileName: string) => Promise<{
    url: string;
    name: string;
    size: number;
    mime: string;
  }>;
  onEditMessage: (messageId: string, newContent: string) => Promise<void>;
  onReact: (messageId: string, emoji: string) => Promise<void>;
  onDeleteForMe: (messageId: string) => Promise<void>;
  onDeleteForAll: (messageId: string) => Promise<void>;
  onToggleStar: (messageId: string) => Promise<void>;
  onTogglePin: (messageId: string, currentlyPinned: boolean) => Promise<void>;
  onForwardMessage: (message: Message, targetConversationId: string) => Promise<void>;
  onVotePoll: (messageId: string, optionIndex: number) => Promise<void>;
  onReportMessage: (message: Message) => Promise<void>;
  onJumpToMessage: (messageId: string) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  allConversations,
  messages,
  currentUser,
  settings,
  onlineUserIds,
  typingNames,
  starredIds,
  isBlocked,
  draft,
  highlightedMessageId,
  showInfoDrawer,
  onBackMobile,
  onToggleInfoDrawer,
  onChangeDraft,
  onTyping,
  onSendMessage,
  onUploadAttachment,
  onEditMessage,
  onReact,
  onDeleteForMe,
  onDeleteForAll,
  onToggleStar,
  onTogglePin,
  onForwardMessage,
  onVotePoll,
  onReportMessage,
  onJumpToMessage,
}) => {
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatchIdx, setSearchMatchIdx] = useState(0);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [pinnedCycleIdx, setPinnedCycleIdx] = useState(0);

  // Modals inside chat
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  const [readReceiptMsg, setReadReceiptMsg] = useState<Message | null>(null);
  const [forwardingMsg, setForwardingMsg] = useState<Message | null>(null);
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [voiceError, setVoiceError] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);

  // Slow mode tracking
  const [slowModeRemaining, setSlowModeRemaining] = useState(0);
  const lastSentAtRef = useRef<number>(0);

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const isDirect = conversation.type === 'direct';
  const isNetlifyApp =
    typeof window !== 'undefined' && window.location.hostname.endsWith('.netlify.app');
  const myRole = conversation.my_membership.role;
  const isAdmin = myRole === 'owner' || myRole === 'admin';
  const cantSendReason = isBlocked
    ? 'You blocked this user. Unblock them in Contact Info to send messages.'
    : conversation.only_admins_can_send && !isAdmin
      ? 'Only admins can send messages in this channel.'
      : null;

  const displayName = isDirect
    ? conversation.my_membership.nickname ||
      conversation.other_user?.full_name ||
      conversation.other_user?.email ||
      'Direct Chat'
    : conversation.title;

  const otherOnline =
    isDirect &&
    conversation.other_user &&
    conversation.other_user.presence_status !== 'offline' &&
    onlineUserIds.has(conversation.other_user.id);

  const pinnedMessages = useMemo(
    () => messages.filter((m) => !m.deleted_for_all && m.is_pinned),
    [messages]
  );

  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    return messages.filter(
      (m) => !m.deleted_for_all && m.content.toLowerCase().includes(q)
    );
  }, [messages, searchQuery]);

  // Keyboard shortcuts: Ctrl+F search in chat, Esc close popovers
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowSearchBar(true);
        setTimeout(() => searchInputRef.current?.focus(), 20);
      } else if (e.key === 'Escape') {
        setShowEmojiPicker(false);
        setShowAttachMenu(false);
        setReplyingTo(null);
        setEditingMsg(null);
        if (showSearchBar) {
          setShowSearchBar(false);
          setSearchQuery('');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showSearchBar]);

  // Reset per-chat UI state on conversation switch
  useEffect(() => {
    setReplyingTo(null);
    setEditingMsg(null);
    setShowSearchBar(false);
    setSearchQuery('');
    setPinnedCycleIdx(0);
    setVoiceError('');
    setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }, 30);
  }, [conversation.id]);

  // Auto-scroll when new messages arrive if near bottom
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 220) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  // Slow mode countdown timer
  useEffect(() => {
    if (slowModeRemaining <= 0) return;
    const id = window.setInterval(() => {
      setSlowModeRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [slowModeRemaining]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottom(dist > 260);
  };

  const scrollToBottom = () => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  };

  const handleSubmitText = async () => {
    if (cantSendReason || sending || slowModeRemaining > 0) return;
    const raw = draft.trim();
    if (!raw) return;

    const finalContent = settings.convertEmojiShortcodes ? convertShortcodes(raw) : raw;

    setSending(true);
    try {
      if (editingMsg) {
        await onEditMessage(editingMsg.id, finalContent);
        setEditingMsg(null);
        onChangeDraft('');
      } else {
        await onSendMessage({
          content: finalContent,
          messageType: 'text',
          replyToId: replyingTo?.id || null,
        });
        setReplyingTo(null);
        onChangeDraft('');
        lastSentAtRef.current = Date.now();
        if (conversation.slow_mode_seconds > 0 && !isAdmin) {
          setSlowModeRemaining(conversation.slow_mode_seconds);
        }
      }
      setTimeout(scrollToBottom, 50);
    } finally {
      setSending(false);
    }
  };

  const handleFileChosen = async (file: File) => {
    setShowAttachMenu(false);
    setUploading(true);
    try {
      const uploaded = await onUploadAttachment(file, file.name);
      let msgType: Message['message_type'] = 'file';
      if (uploaded.mime.startsWith('image/')) msgType = 'image';
      else if (uploaded.mime.startsWith('video/')) msgType = 'video';
      else if (uploaded.mime.startsWith('audio/')) msgType = 'audio';

      await onSendMessage({
        content: draft.trim(),
        messageType: msgType,
        replyToId: replyingTo?.id || null,
        attachmentUrl: uploaded.url,
        attachmentName: uploaded.name,
        attachmentSize: uploaded.size,
        attachmentMime: uploaded.mime,
      });
      onChangeDraft('');
      setReplyingTo(null);
    } finally {
      setUploading(false);
    }
  };

  const startVoiceRecording = async () => {
    setVoiceError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError('Voice recording is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size > 0) {
          setUploading(true);
          try {
            const uploaded = await onUploadAttachment(blob, `voice-${Date.now()}.webm`);
            await onSendMessage({
              content: '',
              messageType: 'audio',
              replyToId: replyingTo?.id || null,
              attachmentUrl: uploaded.url,
              attachmentName: uploaded.name,
              attachmentSize: uploaded.size,
              attachmentMime: 'audio/webm',
            });
            setReplyingTo(null);
          } finally {
            setUploading(false);
          }
        }
        setRecordSeconds(0);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setVoiceError('Microphone permission denied or no microphone detected.');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!pollQuestion.trim() || cleanedOptions.length < 2) return;
    const pollMeta: PollMetadata = {
      question: pollQuestion.trim(),
      options: cleanedOptions,
    };
    await onSendMessage({
      content: pollQuestion.trim(),
      messageType: 'poll',
      metadata: pollMeta as unknown as Record<string, unknown>,
    });
    setPollQuestion('');
    setPollOptions(['', '']);
    setShowPollModal(false);
  };

  const navigateSearchMatch = (dir: -1 | 1) => {
    if (searchMatches.length === 0) return;
    const nextIdx = (searchMatchIdx + dir + searchMatches.length) % searchMatches.length;
    setSearchMatchIdx(nextIdx);
    onJumpToMessage(searchMatches[nextIdx].id);
  };

  const wallpaperClass = `chat-wallpaper-${settings.wallpaper}`;

  return (
    <section className="flex-1 h-full flex flex-col min-w-0 bg-[var(--bg-app)] relative">
      {/* Top Chat Header */}
      <header className="px-3 sm:px-4 py-2.5 sm:py-3 pt-safe bg-[var(--bg-sidebar)]/90 backdrop-blur-md border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 sm:gap-3 z-10">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onBackMobile}
            className="md:hidden p-2 -ml-1 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] cursor-pointer"
            aria-label="Back to chats"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <button
            onClick={onToggleInfoDrawer}
            className="flex items-center gap-3 min-w-0 text-left hover:opacity-90 transition cursor-pointer"
          >
            <Avatar
              src={isDirect ? conversation.other_user?.avatar_url : conversation.avatar_url}
              name={displayName}
              size="md"
              isGroup={!isDirect}
              showPresence={isDirect}
              presence={
                otherOnline ? conversation.other_user?.presence_status || 'online' : 'offline'
              }
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm sm:text-base text-[var(--text-primary)] truncate">
                  {displayName}
                </h2>
                {conversation.disappearing_seconds > 0 && (
                  <span
                    title={`Disappearing messages: ${formatDisappearingDuration(
                      conversation.disappearing_seconds
                    )}`}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400 text-[10px] font-semibold"
                  >
                    <Timer className="w-3 h-3" />
                    {formatDisappearingDuration(conversation.disappearing_seconds)}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                {typingNames.length > 0 ? (
                  <span className="text-[var(--accent-text)] font-medium">
                    {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing...
                  </span>
                ) : isDirect ? (
                  otherOnline ? (
                    <span className="text-emerald-400">Online</span>
                  ) : conversation.other_user ? (
                    `Last seen ${formatLastSeen(conversation.other_user.last_seen, settings.timeFormat)}`
                  ) : (
                    'Offline'
                  )
                ) : (
                  `${conversation.members.length} members`
                )}
              </p>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setShowSearchBar((v) => !v);
              setTimeout(() => searchInputRef.current?.focus(), 20);
            }}
            className={`p-2 rounded-xl transition cursor-pointer ${
              showSearchBar
                ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
            title="Search in conversation (Ctrl+F)"
          >
            <Search className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={onToggleInfoDrawer}
            className={`p-2 rounded-xl transition cursor-pointer ${
              showInfoDrawer
                ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
            title="Chat details & settings"
          >
            <Info className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* In-Chat Search Bar */}
      {showSearchBar && (
        <div className="px-4 py-2 bg-[var(--bg-panel)] border-b border-[var(--border-subtle)] flex items-center gap-2">
          <Search className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchMatchIdx(0);
            }}
            placeholder="Search messages in this chat..."
            className="flex-1 bg-transparent text-xs text-[var(--text-primary)] focus:outline-none"
          />
          {searchQuery && (
            <span className="text-[11px] text-[var(--text-muted)]">
              {searchMatches.length > 0
                ? `${searchMatchIdx + 1} / ${searchMatches.length}`
                : '0 matches'}
            </span>
          )}
          <button
            onClick={() => navigateSearchMatch(-1)}
            disabled={searchMatches.length === 0}
            className="p-1 rounded-lg hover:bg-[var(--bg-hover)] disabled:opacity-40 cursor-pointer"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigateSearchMatch(1)}
            disabled={searchMatches.length === 0}
            className="p-1 rounded-lg hover:bg-[var(--bg-hover)] disabled:opacity-40 cursor-pointer"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setShowSearchBar(false);
              setSearchQuery('');
            }}
            className="p-1 rounded-lg hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pinned Messages Banner */}
      {pinnedMessages.length > 0 && (
        <button
          onClick={() => {
            const target = pinnedMessages[pinnedCycleIdx % pinnedMessages.length];
            onJumpToMessage(target.id);
            setPinnedCycleIdx((i) => (i + 1) % pinnedMessages.length);
          }}
          className="px-4 py-2 bg-[var(--bg-panel)]/95 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 text-left hover:bg-[var(--bg-hover)] transition cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Pin className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-text)]">
                Pinned Message {pinnedMessages.length > 1 ? `(${(pinnedCycleIdx % pinnedMessages.length) + 1}/${pinnedMessages.length})` : ''}
              </p>
              <p className="text-xs text-[var(--text-primary)] truncate">
                {pinnedMessages[pinnedCycleIdx % pinnedMessages.length].content ||
                  `[${pinnedMessages[pinnedCycleIdx % pinnedMessages.length].message_type}]`}
              </p>
            </div>
          </div>
          <span className="text-[11px] text-[var(--text-muted)] shrink-0">Jump</span>
        </button>
      )}

      {/* Messages Timeline */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-0.5 ${wallpaperClass}`}
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-strong)] flex items-center justify-center mb-3 shadow-lg">
              <Smile className="w-8 h-8 text-[var(--accent-text)]" />
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Say hello to {displayName}!
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-xs">
              Messages sync in real time. Share files, voice notes, polls, reactions, and more.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const prev = idx > 0 ? messages[idx - 1] : null;
            const showDateDivider =
              !prev || new Date(prev.created_at).toDateString() !== new Date(msg.created_at).toDateString();

            const showSenderInfo =
              !prev ||
              prev.sender_id !== msg.sender_id ||
              prev.message_type === 'system' ||
              showDateDivider ||
              new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60 * 1000;

            return (
              <React.Fragment key={msg.id}>
                {showDateDivider && (
                  <div className="flex justify-center my-3">
                    <span className="px-3 py-1 rounded-full bg-[var(--bg-panel)]/90 border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-secondary)] shadow-sm">
                      {formatDateDivider(msg.created_at)}
                    </span>
                  </div>
                )}

                <MessageBubble
                  message={msg}
                  isOwn={msg.sender_id === currentUser.id}
                  showSenderInfo={showSenderInfo}
                  isGroup={!isDirect}
                  currentUserId={currentUser.id}
                  settings={settings}
                  isStarred={starredIds.has(msg.id)}
                  isHighlighted={highlightedMessageId === msg.id}
                  searchQuery={searchQuery}
                  onReply={(m) => {
                    setEditingMsg(null);
                    setReplyingTo(m);
                    inputRef.current?.focus();
                  }}
                  onReact={onReact}
                  onEdit={(m) => {
                    setReplyingTo(null);
                    setEditingMsg(m);
                    onChangeDraft(m.content);
                    inputRef.current?.focus();
                  }}
                  onDeleteForMe={onDeleteForMe}
                  onDeleteForAll={onDeleteForAll}
                  onToggleStar={onToggleStar}
                  onTogglePin={onTogglePin}
                  onForward={(m) => setForwardingMsg(m)}
                  onVotePoll={onVotePoll}
                  onJumpToMessage={onJumpToMessage}
                  onOpenImage={(url, name) => setLightbox({ url, name })}
                  onShowReadReceipts={(m) => setReadReceiptMsg(m)}
                  onReportMessage={onReportMessage}
                />
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className={`absolute ${
            isNetlifyApp ? 'bottom-36' : 'bottom-24'
          } right-6 p-2.5 rounded-full bg-[var(--bg-panel)] border border-[var(--border-strong)] text-[var(--text-primary)] shadow-xl hover:bg-[var(--bg-elevated)] transition cursor-pointer z-20`}
          title="Scroll to latest messages"
        >
          <ArrowDown className="w-4.5 h-4.5" />
        </button>
      )}

      {/* Composer Area */}
      <div
        className={`px-2.5 pt-2.5 ${
          isNetlifyApp ? 'pb-14' : 'pb-safe'
        } sm:px-5 bg-[var(--bg-sidebar)] border-t border-[var(--border-subtle)]`}
      >
        {/* Reply or Edit Preview */}
        {(replyingTo || editingMsg) && (
          <div className="mb-2 px-3 py-2 rounded-xl bg-[var(--bg-panel)] border-l-2 border-[var(--accent)] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-[var(--accent-text)]">
                {editingMsg
                  ? 'Editing message'
                  : `Replying to ${replyingTo?.sender?.full_name || 'Message'}`}
              </p>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                {editingMsg ? editingMsg.content : replyingTo?.content || `[${replyingTo?.message_type}]`}
              </p>
            </div>
            <button
              onClick={() => {
                setReplyingTo(null);
                setEditingMsg(null);
                if (editingMsg) onChangeDraft('');
              }}
              className="p-1 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {voiceError && (
          <div className="mb-2 px-3 py-1.5 rounded-xl bg-rose-500/15 text-rose-300 text-xs flex items-center justify-between">
            <span>{voiceError}</span>
            <button onClick={() => setVoiceError('')} className="cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {cantSendReason ? (
          <div className="py-2.5 px-4 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] flex items-center justify-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            {cantSendReason}
          </div>
        ) : (
          <div className="relative flex items-end gap-2">
            {/* Hidden file inputs */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileChosen(file);
                e.target.value = '';
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileChosen(file);
                e.target.value = '';
              }}
            />

            {/* Attach Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowAttachMenu((v) => !v);
                  setShowEmojiPicker(false);
                }}
                disabled={uploading}
                className="p-2.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
                title="Attach media, file, or poll"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              {showAttachMenu && (
                <div className="absolute bottom-13 left-0 z-30 w-48 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-strong)] shadow-2xl p-1.5 text-xs space-y-0.5">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-primary)] cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4 text-sky-400" />
                    Photo or Video
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-primary)] cursor-pointer"
                  >
                    <FileUp className="w-4 h-4 text-emerald-400" />
                    Document / File
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false);
                      setShowPollModal(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-primary)] cursor-pointer"
                  >
                    <BarChart3 className="w-4 h-4 text-amber-400" />
                    Create Poll
                  </button>
                </div>
              )}
            </div>

            {/* Emoji Picker Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowEmojiPicker((v) => !v);
                  setShowAttachMenu(false);
                }}
                className="p-2.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
                title="Emoji picker"
              >
                <Smile className="w-5 h-5" />
              </button>

              {showEmojiPicker && (
                <div className="absolute bottom-13 left-0 z-30 w-[min(288px,calc(100vw-4rem))] rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-strong)] shadow-2xl p-3 space-y-2.5 max-h-64 overflow-y-auto">
                  {EMOJI_CATEGORIES.map((cat) => (
                    <div key={cat.label}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                        {cat.label}
                      </p>
                      <div className="grid grid-cols-8 gap-1">
                        {cat.emojis.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              onChangeDraft(draft + emoji);
                              inputRef.current?.focus();
                            }}
                            className="text-lg p-1 rounded-lg hover:bg-[var(--bg-hover)] cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] focus-within:border-[var(--accent)] rounded-2xl px-3.5 py-2 flex items-center">
              <textarea
                ref={inputRef}
                rows={1}
                spellCheck={settings.spellcheck}
                value={draft}
                onChange={(e) => {
                  onChangeDraft(e.target.value);
                  onTyping();
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (settings.enterToSend && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitText();
                    } else if (!settings.enterToSend && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleSubmitText();
                    }
                  } else if (e.key === 'ArrowUp' && !draft.trim()) {
                    const lastOwn = [...messages]
                      .reverse()
                      .find(
                        (m) =>
                          m.sender_id === currentUser.id &&
                          m.message_type === 'text' &&
                          !m.deleted_for_all
                      );
                    if (lastOwn) {
                      e.preventDefault();
                      setEditingMsg(lastOwn);
                      onChangeDraft(lastOwn.content);
                    }
                  }
                }}
                placeholder={
                  uploading
                    ? 'Uploading attachment...'
                    : slowModeRemaining > 0
                      ? `Slow mode: wait ${slowModeRemaining}s...`
                      : settings.enterToSend
                        ? 'Write a message...'
                        : 'Write a message... (Ctrl+Enter to send)'
                }
                className="w-full max-h-32 resize-none bg-transparent text-base sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none leading-snug"
              />
            </div>

            {/* Voice or Send CTA */}
            {draft.trim() ? (
              <button
                type="button"
                onClick={handleSubmitText}
                disabled={sending || slowModeRemaining > 0}
                className="p-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition cursor-pointer disabled:opacity-50"
                title="Send message"
              >
                <Send className="w-5 h-5" />
              </button>
            ) : recording ? (
              <button
                type="button"
                onClick={stopVoiceRecording}
                className="px-3 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold flex items-center gap-1.5 animate-pulse cursor-pointer"
                title="Stop & send voice note"
              >
                <Square className="w-4 h-4 fill-white" />
                {recordSeconds}s
              </button>
            ) : (
              <button
                type="button"
                onClick={startVoiceRecording}
                disabled={uploading}
                className="p-2.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
                title="Record voice message"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Image Lightbox Modal */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-4"
        >
          <div className="w-full max-w-4xl flex justify-between items-center text-white mb-3">
            <span className="text-sm font-medium truncate">{lightbox.name}</span>
            <button onClick={() => setLightbox(null)} className="p-2 rounded-xl bg-white/10 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
          <img
            src={lightbox.url}
            alt={lightbox.name}
            className="max-h-[82vh] max-w-full rounded-2xl object-contain"
          />
        </div>
      )}

      {/* Read Receipts Modal */}
      {readReceiptMsg && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-strong)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                <CheckCheck className="w-4 h-4 text-sky-400" />
                Message Info
              </h4>
              <button onClick={() => setReadReceiptMsg(null)} className="cursor-pointer">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {(readReceiptMsg.reads || []).filter((r) => r.user_id !== currentUser.id).length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-4">
                  Delivered, not read yet.
                </p>
              ) : (
                (readReceiptMsg.reads || [])
                  .filter((r) => r.user_id !== currentUser.id)
                  .map((r) => {
                    const member = conversation.members.find((m) => m.user_id === r.user_id);
                    return (
                      <div key={r.user_id} className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-primary)] font-medium">
                          {member?.profile?.full_name || member?.profile?.email || 'Member'}
                        </span>
                        <span className="text-[var(--text-muted)]">
                          {formatMessageTime(r.read_at, settings.timeFormat)}
                        </span>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Forward Message Modal */}
      {forwardingMsg && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-strong)] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                <Forward className="w-4 h-4 text-[var(--accent-text)]" />
                Forward to...
              </h4>
              <button onClick={() => setForwardingMsg(null)} className="cursor-pointer">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {allConversations.map((c) => {
                const name =
                  c.type === 'direct'
                    ? c.other_user?.full_name || c.other_user?.email || 'Direct Chat'
                    : c.title;
                return (
                  <button
                    key={c.id}
                    onClick={async () => {
                      await onForwardMessage(forwardingMsg, c.id);
                      setForwardingMsg(null);
                    }}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--bg-hover)] text-left cursor-pointer"
                  >
                    <Avatar
                      src={c.type === 'direct' ? c.other_user?.avatar_url : c.avatar_url}
                      name={name}
                      size="sm"
                      isGroup={c.type !== 'direct'}
                    />
                    <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Create Poll Modal */}
      {showPollModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreatePoll}
            className="w-full max-w-md rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-strong)] p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-400" />
                Create Poll
              </h4>
              <button type="button" onClick={() => setShowPollModal(false)} className="cursor-pointer">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <input
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="Ask a question..."
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
            />

            <div className="space-y-2">
              {pollOptions.map((opt, i) => (
                <input
                  key={i}
                  value={opt}
                  onChange={(e) => {
                    const next = [...pollOptions];
                    next[i] = e.target.value;
                    setPollOptions(next);
                  }}
                  placeholder={`Option ${i + 1}`}
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                />
              ))}
              {pollOptions.length < 6 && (
                <button
                  type="button"
                  onClick={() => setPollOptions([...pollOptions, ''])}
                  className="text-xs text-[var(--accent-text)] hover:underline cursor-pointer"
                >
                  + Add option
                </button>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold cursor-pointer"
            >
              Send Poll
            </button>
          </form>
        </div>
      )}
    </section>
  );
};
