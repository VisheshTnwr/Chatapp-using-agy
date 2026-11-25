export type ThemeMode = 'dark' | 'light' | 'midnight' | 'system';
export type AccentColor = 'indigo' | 'emerald' | 'rose' | 'amber' | 'sky' | 'violet';
export type WallpaperStyle = 'solid' | 'subtle-grid' | 'gradient' | 'doodle';
export type BubbleStyle = 'modern' | 'classic' | 'minimal';
export type FontSize = 'small' | 'medium' | 'large';
export type Density = 'comfortable' | 'compact';
export type TimeFormat = '12h' | '24h';
export type PresenceStatus = 'online' | 'away' | 'dnd' | 'offline';
export type VisibilityScope = 'everyone' | 'contacts' | 'nobody';
export type NotificationSound = 'chime' | 'pop' | 'crystal' | 'muted';

export interface UserSettings {
  theme: ThemeMode;
  accentColor: AccentColor;
  wallpaper: WallpaperStyle;
  bubbleStyle: BubbleStyle;
  fontSize: FontSize;
  density: Density;
  timeFormat: TimeFormat;
  showAvatars: boolean;
  enterToSend: boolean;
  convertEmojiShortcodes: boolean;
  spellcheck: boolean;
  linkPreviews: boolean;
  saveDrafts: boolean;
  autoDownloadMedia: boolean;
  keepArchivedMuted: boolean;
  desktopNotifications: boolean;
  inAppSounds: boolean;
  notificationSound: NotificationSound;
  notificationPreview: boolean;
  mentionsOnly: boolean;
  tabBadge: boolean;
  readReceipts: boolean;
  typingIndicators: boolean;
  lastSeenVisibility: VisibilityScope;
  profilePhotoVisibility: VisibilityScope;
  bioVisibility: VisibilityScope;
  groupInvites: 'everyone' | 'contacts';
  defaultDisappearingSeconds: number;
  highContrast: boolean;
  reducedMotion: boolean;
  appLockEnabled: boolean;
  appLockPin: string;
}

export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'dark',
  accentColor: 'indigo',
  wallpaper: 'subtle-grid',
  bubbleStyle: 'modern',
  fontSize: 'medium',
  density: 'comfortable',
  timeFormat: '12h',
  showAvatars: true,
  enterToSend: true,
  convertEmojiShortcodes: true,
  spellcheck: true,
  linkPreviews: true,
  saveDrafts: true,
  autoDownloadMedia: true,
  keepArchivedMuted: true,
  desktopNotifications: true,
  inAppSounds: true,
  notificationSound: 'chime',
  notificationPreview: true,
  mentionsOnly: false,
  tabBadge: true,
  readReceipts: true,
  typingIndicators: true,
  lastSeenVisibility: 'everyone',
  profilePhotoVisibility: 'everyone',
  bioVisibility: 'everyone',
  groupInvites: 'everyone',
  defaultDisappearingSeconds: 0,
  highContrast: false,
  reducedMotion: false,
  appLockEnabled: false,
  appLockPin: '',
};

export interface Profile {
  id: string;
  email: string;
  username: string;
  full_name: string;
  avatar_url: string;
  bio: string;
  phone: string;
  status_emoji: string;
  status_text: string;
  presence_status: PresenceStatus;
  last_seen: string;
  settings: UserSettings;
  created_at: string;
  updated_at: string;
}

export type ConversationType = 'direct' | 'group' | 'channel';
export type MemberRole = 'owner' | 'admin' | 'member';

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string;
  description: string;
  avatar_url: string;
  created_by: string | null;
  invite_code: string;
  disappearing_seconds: number;
  slow_mode_seconds: number;
  only_admins_can_send: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConversationMember {
  conversation_id: string;
  user_id: string;
  role: MemberRole;
  nickname: string;
  is_pinned: boolean;
  is_muted: boolean;
  mute_until: string | null;
  is_archived: boolean;
  last_read_at: string;
  cleared_at: string | null;
  joined_at: string;
  profile?: Profile;
}

export type MessageType = 'text' | 'image' | 'file' | 'audio' | 'video' | 'system' | 'poll';

export interface PollMetadata {
  question: string;
  options: string[];
  allowMultiple?: boolean;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface MessageRead {
  message_id: string;
  user_id: string;
  read_at: string;
}

export interface PollVote {
  message_id: string;
  user_id: string;
  option_index: number;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  content: string;
  message_type: MessageType;
  reply_to_id: string | null;
  forwarded_from_id: string | null;
  attachment_url: string;
  attachment_name: string;
  attachment_size: number;
  attachment_mime: string;
  metadata: Record<string, unknown>;
  is_edited: boolean;
  edited_at: string | null;
  deleted_for_all: boolean;
  is_pinned: boolean;
  expires_at: string | null;
  created_at: string;
  sender?: Profile;
  reactions?: MessageReaction[];
  reads?: MessageRead[];
  poll_votes?: PollVote[];
  reply_to?: Message | null;
}

export interface ConversationWithDetails extends Conversation {
  members: ConversationMember[];
  my_membership: ConversationMember;
  other_user?: Profile | null;
  last_message?: Message | null;
  unread_count: number;
}
