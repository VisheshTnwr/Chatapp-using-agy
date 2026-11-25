import React, { useRef, useState } from 'react';
import {
  X,
  User,
  Shield,
  Lock,
  Bell,
  Palette,
  MessageSquare,
  Accessibility,
  HardDrive,
  Camera,
  Check,
  Volume2,
  LogOut,
  Download,
  UserCheck,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type {
  AccentColor,
  BubbleStyle,
  Density,
  FontSize,
  NotificationSound,
  PresenceStatus,
  Profile,
  ThemeMode,
  TimeFormat,
  UserSettings,
  VisibilityScope,
  WallpaperStyle,
} from '../types/chat';
import { DEFAULT_SETTINGS } from '../types/chat';
import { Avatar } from './Avatar';
import { playNotificationSound } from '../lib/sounds';
import { uploadChatFile } from '../lib/supabase';

interface SettingsModalProps {
  currentUser: Profile;
  settings: UserSettings;
  blockedProfiles: Profile[];
  onClose: () => void;
  onSaveProfile: (patch: Partial<Profile>) => Promise<void>;
  onUpdateSettings: (patch: Partial<UserSettings>) => Promise<void>;
  onResetSettings: () => Promise<void>;
  onUnblockUser: (userId: string) => Promise<void>;
  onExportAllChats: () => void;
  onClearLocalCache: () => void;
  onLockNow: () => void;
  onSignOut: () => void;
}

type SettingsTab =
  | 'profile'
  | 'account'
  | 'privacy'
  | 'notifications'
  | 'appearance'
  | 'chat'
  | 'accessibility'
  | 'storage';

const TABS: { id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'profile', label: 'Profile & Status', icon: User },
  { id: 'account', label: 'Account & Security', icon: Lock },
  { id: 'privacy', label: 'Privacy', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'chat', label: 'Chat & Media', icon: MessageSquare },
  { id: 'accessibility', label: 'Accessibility', icon: Accessibility },
  { id: 'storage', label: 'Storage & Data', icon: HardDrive },
];

const ACCENT_SWATCHES: { id: AccentColor; label: string; hex: string }[] = [
  { id: 'indigo', label: 'Indigo', hex: '#6366f1' },
  { id: 'emerald', label: 'Emerald', hex: '#10b981' },
  { id: 'rose', label: 'Rose', hex: '#f43f5e' },
  { id: 'amber', label: 'Amber', hex: '#f59e0b' },
  { id: 'sky', label: 'Sky', hex: '#0ea5e9' },
  { id: 'violet', label: 'Violet', hex: '#8b5cf6' },
];

const ToggleRow: React.FC<{
  title: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}> = ({ title, description, checked, onChange }) => (
  <div className="flex items-center justify-between gap-4 py-2.5">
    <div className="min-w-0">
      <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
      {description && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</p>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full transition relative shrink-0 cursor-pointer ${
        checked ? 'bg-[var(--accent)]' : 'bg-[var(--bg-elevated)] border border-[var(--border-strong)]'
      }`}
    >
      <span
        className={`block w-4.5 h-4.5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5.5' : 'translate-x-0.5'
        }`}
      />
    </button>
  </div>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({
  currentUser,
  settings,
  blockedProfiles,
  onClose,
  onSaveProfile,
  onUpdateSettings,
  onResetSettings,
  onUnblockUser,
  onExportAllChats,
  onClearLocalCache,
  onLockNow,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [fullName, setFullName] = useState(currentUser.full_name);
  const [username, setUsername] = useState(currentUser.username);
  const [bio, setBio] = useState(currentUser.bio);
  const [phone, setPhone] = useState(currentUser.phone);
  const [statusEmoji, setStatusEmoji] = useState(currentUser.status_emoji || '💬');
  const [statusText, setStatusText] = useState(currentUser.status_text || '');
  const [presence, setPresence] = useState<PresenceStatus>(currentUser.presence_status);
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar_url);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');

  const [pinDraft, setPinDraft] = useState(settings.appLockPin || '');
  const [cacheNotice, setCacheNotice] = useState('');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const handleAvatarUpload = async (file: File) => {
    const ext = file.name.split('.').pop() || 'png';
    const path = `${currentUser.id}/avatar-${Date.now()}.${ext}`;
    const { publicUrl, error } = await uploadChatFile('avatars', path, file);
    if (error) {
      setProfileError(error.message);
      return;
    }
    setAvatarUrl(publicUrl);
    await onSaveProfile({ avatar_url: publicUrl });
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setSavingProfile(true);
    try {
      await onSaveProfile({
        full_name: fullName.trim(),
        username: username.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''),
        bio: bio.trim(),
        phone: phone.trim(),
        status_emoji: statusEmoji.trim(),
        status_text: statusText.trim(),
        presence_status: presence,
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const requestDesktopNotifications = async () => {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      new Notification('PulseChat Notifications Enabled', {
        body: 'You will receive desktop alerts for new messages.',
      });
      await onUpdateSettings({ desktopNotifications: true });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center sm:p-4">
      <div className="w-full max-w-4xl h-[100dvh] sm:h-[82vh] sm:rounded-3xl bg-[var(--bg-panel)] sm:border border-[var(--border-strong)] shadow-2xl overflow-hidden flex flex-col md:flex-row">
        {/* Left Navigation Sidebar */}
        <div className="md:w-60 shrink-0 bg-[var(--bg-sidebar)] border-b md:border-b-0 md:border-r border-[var(--border-subtle)] flex flex-col pt-safe">
          <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <h2 className="font-bold text-base text-[var(--text-primary)]">Settings</h2>
            <div className="flex items-center gap-1 md:hidden">
              <button
                onClick={onSignOut}
                className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 cursor-pointer"
              >
                Sign out
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <nav className="p-2 flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto flex-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                    active
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] font-semibold'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {t.label}
                </button>
              );
            })}
          </nav>

          <div className="hidden md:block p-3 border-t border-[var(--border-subtle)]">
            <button
              onClick={onSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="hidden md:flex px-6 py-4 border-b border-[var(--border-subtle)] items-center justify-between">
            <h3 className="font-bold text-base text-[var(--text-primary)]">
              {TABS.find((t) => t.id === activeTab)?.label}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* 1. PROFILE & STATUS */}
            {activeTab === 'profile' && (
              <form onSubmit={handleProfileSave} className="space-y-5">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar src={avatarUrl} name={fullName || currentUser.email} size="xl" />
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleAvatarUpload(f);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[var(--accent)] text-white shadow-lg hover:bg-[var(--accent-hover)] cursor-pointer"
                      title="Upload new avatar"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-[var(--text-primary)]">
                      {currentUser.full_name || currentUser.username}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      @{currentUser.username}
                    </p>
                  </div>
                </div>

                {profileError && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                    {profileError}
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Display Name
                    </label>
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Username (@handle)
                    </label>
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Bio / About
                  </label>
                  <textarea
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                  />
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Status Emoji
                    </label>
                    <input
                      value={statusEmoji}
                      onChange={(e) => setStatusEmoji(e.target.value)}
                      maxLength={4}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Custom Status Message
                    </label>
                    <input
                      value={statusText}
                      onChange={(e) => setStatusText(e.target.value)}
                      placeholder="Working on PulseChat..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Presence Status
                    </label>
                    <select
                      value={presence}
                      onChange={(e) => setPresence(e.target.value as PresenceStatus)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                    >
                      <option value="online">Online</option>
                      <option value="away">Away</option>
                      <option value="dnd">Do Not Disturb</option>
                      <option value="offline">Invisible (Offline)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Phone Number (optional)
                    </label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 555 0100"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                >
                  {profileSaved ? (
                    <>
                      <Check className="w-4 h-4" />
                      Saved!
                    </>
                  ) : savingProfile ? (
                    'Saving...'
                  ) : (
                    'Save Profile'
                  )}
                </button>
              </form>
            )}

            {/* 2. ACCOUNT & SECURITY */}
            {activeTab === 'account' && (
              <div className="space-y-6">
                <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Signed-in Account
                    </p>
                    <p className="text-sm font-semibold text-[var(--text-primary)] mt-1">
                      {currentUser.full_name || currentUser.username} (@{currentUser.username})
                    </p>
                    <p className="text-xs text-emerald-400 mt-0.5">Active Supabase Session</p>
                  </div>
                  <button
                    onClick={onSignOut}
                    className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>

                {/* App Lock PIN */}
                <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-3">
                  <ToggleRow
                    title="App Lock PIN"
                    description="Require a PIN code to unlock PulseChat in this browser"
                    checked={settings.appLockEnabled}
                    onChange={(checked) => {
                      if (checked && !pinDraft.trim()) {
                        return;
                      }
                      onUpdateSettings({ appLockEnabled: checked, appLockPin: pinDraft.trim() });
                    }}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={8}
                      value={pinDraft}
                      onChange={(e) => setPinDraft(e.target.value)}
                      placeholder="4-8 digit PIN"
                      className="px-3 py-2 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (pinDraft.trim().length < 4) return;
                        onUpdateSettings({ appLockEnabled: true, appLockPin: pinDraft.trim() });
                      }}
                      className="px-3.5 py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-semibold cursor-pointer"
                    >
                      Set & Enable PIN
                    </button>
                    {settings.appLockEnabled && settings.appLockPin && (
                      <button
                        type="button"
                        onClick={onLockNow}
                        className="px-3.5 py-2 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-strong)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
                      >
                        Lock Now
                      </button>
                    )}
                  </div>
                </div>

                {/* Blocked Users */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Blocked Users ({blockedProfiles.length})
                  </h4>
                  {blockedProfiles.length === 0 ? (
                    <p className="text-xs text-[var(--text-secondary)]">You have not blocked anyone.</p>
                  ) : (
                    <div className="space-y-2">
                      {blockedProfiles.map((bp) => (
                        <div
                          key={bp.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
                        >
                          <div className="flex items-center gap-2.5">
                            <Avatar src={bp.avatar_url} name={bp.full_name || bp.email} size="sm" />
                            <div>
                              <p className="text-xs font-semibold text-[var(--text-primary)]">
                                {bp.full_name || bp.username}
                              </p>
                              <p className="text-[11px] text-[var(--text-muted)]">{bp.email}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => onUnblockUser(bp.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-xs text-[var(--text-primary)] cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                            Unblock
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-[var(--border-subtle)]">
                  <button
                    onClick={onExportAllChats}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-sky-400" />
                    Export All Conversations (JSON)
                  </button>
                </div>
              </div>
            )}

            {/* 3. PRIVACY */}
            {activeTab === 'privacy' && (
              <div className="space-y-4 divide-y divide-[var(--border-subtle)]">
                <div className="pb-2 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        Last Seen & Online Status
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Control who sees when you were last active
                      </p>
                    </div>
                    <select
                      value={settings.lastSeenVisibility}
                      onChange={(e) =>
                        onUpdateSettings({ lastSeenVisibility: e.target.value as VisibilityScope })
                      }
                      className="px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                    >
                      <option value="everyone">Everyone</option>
                      <option value="contacts">Contacts</option>
                      <option value="nobody">Nobody</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        Profile Photo Visibility
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Who can view your profile avatar
                      </p>
                    </div>
                    <select
                      value={settings.profilePhotoVisibility}
                      onChange={(e) =>
                        onUpdateSettings({ profilePhotoVisibility: e.target.value as VisibilityScope })
                      }
                      className="px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                    >
                      <option value="everyone">Everyone</option>
                      <option value="contacts">Contacts</option>
                      <option value="nobody">Nobody</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">Bio Visibility</p>
                    </div>
                    <select
                      value={settings.bioVisibility}
                      onChange={(e) =>
                        onUpdateSettings({ bioVisibility: e.target.value as VisibilityScope })
                      }
                      className="px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                    >
                      <option value="everyone">Everyone</option>
                      <option value="contacts">Contacts</option>
                      <option value="nobody">Nobody</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        Who can add me to groups
                      </p>
                    </div>
                    <select
                      value={settings.groupInvites}
                      onChange={(e) =>
                        onUpdateSettings({ groupInvites: e.target.value as 'everyone' | 'contacts' })
                      }
                      className="px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                    >
                      <option value="everyone">Everyone</option>
                      <option value="contacts">Contacts only</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <ToggleRow
                    title="Read Receipts"
                    description="Show double blue checkmarks when you read messages"
                    checked={settings.readReceipts}
                    onChange={(v) => onUpdateSettings({ readReceipts: v })}
                  />
                  <ToggleRow
                    title="Typing Indicators"
                    description="Let others see when you are typing a message"
                    checked={settings.typingIndicators}
                    onChange={(v) => onUpdateSettings({ typingIndicators: v })}
                  />
                </div>

                <div className="pt-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      Default Disappearing Timer
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Applied automatically when you start new chats
                    </p>
                  </div>
                  <select
                    value={settings.defaultDisappearingSeconds}
                    onChange={(e) =>
                      onUpdateSettings({ defaultDisappearingSeconds: Number(e.target.value) })
                    }
                    className="px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                  >
                    <option value={0}>Off</option>
                    <option value={30}>30 seconds</option>
                    <option value={300}>5 minutes</option>
                    <option value={3600}>1 hour</option>
                    <option value={86400}>24 hours</option>
                    <option value={604800}>7 days</option>
                  </select>
                </div>
              </div>
            )}

            {/* 4. NOTIFICATIONS */}
            {activeTab === 'notifications' && (
              <div className="space-y-3 divide-y divide-[var(--border-subtle)]">
                <div>
                  <ToggleRow
                    title="Desktop Push Notifications"
                    description="Show native browser alerts when a new message arrives"
                    checked={settings.desktopNotifications}
                    onChange={(v) => {
                      if (v) requestDesktopNotifications();
                      else onUpdateSettings({ desktopNotifications: false });
                    }}
                  />
                  <button
                    type="button"
                    onClick={requestDesktopNotifications}
                    className="mb-2 text-xs text-[var(--accent-text)] hover:underline cursor-pointer"
                  >
                    Request browser permission & send test notification
                  </button>
                </div>

                <div className="pt-2">
                  <ToggleRow
                    title="In-App Sound Effects"
                    description="Play subtle audio cues on incoming and sent messages"
                    checked={settings.inAppSounds}
                    onChange={(v) => onUpdateSettings({ inAppSounds: v })}
                  />

                  <div className="flex items-center justify-between gap-4 py-2">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">Notification Tone</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={settings.notificationSound}
                        onChange={(e) =>
                          onUpdateSettings({
                            notificationSound: e.target.value as NotificationSound,
                          })
                        }
                        className="px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                      >
                        <option value="chime">Soft Chime</option>
                        <option value="pop">Bubble Pop</option>
                        <option value="crystal">Crystal</option>
                        <option value="muted">Muted</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => playNotificationSound(settings.notificationSound)}
                        className="p-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] cursor-pointer"
                        title="Preview sound"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <ToggleRow
                    title="Show Message Preview"
                    description="Display sender and message text inside desktop notifications"
                    checked={settings.notificationPreview}
                    onChange={(v) => onUpdateSettings({ notificationPreview: v })}
                  />
                  <ToggleRow
                    title="Mentions Only in Groups"
                    description="Alert only when you are @mentioned in group chats"
                    checked={settings.mentionsOnly}
                    onChange={(v) => onUpdateSettings({ mentionsOnly: v })}
                  />
                  <ToggleRow
                    title="Unread Count in Browser Tab"
                    description="Show unread message count in the page title"
                    checked={settings.tabBadge}
                    onChange={(v) => onUpdateSettings({ tabBadge: v })}
                  />
                </div>
              </div>
            )}

            {/* 5. APPEARANCE & THEME */}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2.5">
                    Theme Mode
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(
                      [
                        { id: 'dark', label: 'Dark' },
                        { id: 'light', label: 'Light' },
                        { id: 'midnight', label: 'Midnight OLED' },
                        { id: 'system', label: 'System' },
                      ] as { id: ThemeMode; label: string }[]
                    ).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onUpdateSettings({ theme: t.id })}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                          settings.theme === t.id
                            ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2.5">
                    Accent Color
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    {ACCENT_SWATCHES.map((sw) => (
                      <button
                        key={sw.id}
                        type="button"
                        onClick={() => onUpdateSettings({ accentColor: sw.id })}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium cursor-pointer ${
                          settings.accentColor === sw.id
                            ? 'border-[var(--text-primary)] bg-[var(--bg-elevated)]'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-panel)]'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full"
                          style={{ backgroundColor: sw.hex }}
                        />
                        {sw.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2.5">
                    Chat Wallpaper
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(
                      [
                        { id: 'solid', label: 'Solid Clean' },
                        { id: 'subtle-grid', label: 'Subtle Grid' },
                        { id: 'gradient', label: 'Ambient Glow' },
                        { id: 'doodle', label: 'Dot Matrix' },
                      ] as { id: WallpaperStyle; label: string }[]
                    ).map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => onUpdateSettings({ wallpaper: w.id })}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                          settings.wallpaper === w.id
                            ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Bubble Style
                    </label>
                    <select
                      value={settings.bubbleStyle}
                      onChange={(e) => onUpdateSettings({ bubbleStyle: e.target.value as BubbleStyle })}
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                    >
                      <option value="modern">Modern Rounded</option>
                      <option value="classic">Classic Chat</option>
                      <option value="minimal">Minimal Flat</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Font Size
                    </label>
                    <select
                      value={settings.fontSize}
                      onChange={(e) => onUpdateSettings({ fontSize: e.target.value as FontSize })}
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                    >
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Message Density
                    </label>
                    <select
                      value={settings.density}
                      onChange={(e) => onUpdateSettings({ density: e.target.value as Density })}
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                    >
                      <option value="comfortable">Comfortable</option>
                      <option value="compact">Compact</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Time Format
                    </label>
                    <select
                      value={settings.timeFormat}
                      onChange={(e) => onUpdateSettings({ timeFormat: e.target.value as TimeFormat })}
                      className="w-full px-3 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                    >
                      <option value="12h">12-hour (1:30 PM)</option>
                      <option value="24h">24-hour (13:30)</option>
                    </select>
                  </div>
                </div>

                <ToggleRow
                  title="Show User Avatars in Messages"
                  checked={settings.showAvatars}
                  onChange={(v) => onUpdateSettings({ showAvatars: v })}
                />
              </div>
            )}

            {/* 6. CHAT & MEDIA */}
            {activeTab === 'chat' && (
              <div className="divide-y divide-[var(--border-subtle)]">
                <ToggleRow
                  title="Enter Key Sends Message"
                  description="When off, press Ctrl+Enter (Cmd+Enter) to send and Enter for new lines"
                  checked={settings.enterToSend}
                  onChange={(v) => onUpdateSettings({ enterToSend: v })}
                />
                <ToggleRow
                  title="Convert Emoji Shortcodes"
                  description="Automatically convert :) <3 :fire: into emojis when sending"
                  checked={settings.convertEmojiShortcodes}
                  onChange={(v) => onUpdateSettings({ convertEmojiShortcodes: v })}
                />
                <ToggleRow
                  title="Spellcheck in Composer"
                  checked={settings.spellcheck}
                  onChange={(v) => onUpdateSettings({ spellcheck: v })}
                />
                <ToggleRow
                  title="Rich Link Previews"
                  description="Show domain cards under messages containing URLs"
                  checked={settings.linkPreviews}
                  onChange={(v) => onUpdateSettings({ linkPreviews: v })}
                />
                <ToggleRow
                  title="Auto-Save Drafts"
                  description="Keep unsent messages saved per conversation"
                  checked={settings.saveDrafts}
                  onChange={(v) => onUpdateSettings({ saveDrafts: v })}
                />
                <ToggleRow
                  title="Auto-Download Media"
                  description="Automatically load shared photos and previews"
                  checked={settings.autoDownloadMedia}
                  onChange={(v) => onUpdateSettings({ autoDownloadMedia: v })}
                />
                <ToggleRow
                  title="Keep Archived Chats Muted"
                  description="Prevent archived chats from popping up on new messages"
                  checked={settings.keepArchivedMuted}
                  onChange={(v) => onUpdateSettings({ keepArchivedMuted: v })}
                />
              </div>
            )}

            {/* 7. ACCESSIBILITY & SHORTCUTS */}
            {activeTab === 'accessibility' && (
              <div className="space-y-6">
                <div className="divide-y divide-[var(--border-subtle)]">
                  <ToggleRow
                    title="High Contrast Borders"
                    description="Increase contrast around panels, inputs, and buttons"
                    checked={settings.highContrast}
                    onChange={(v) => onUpdateSettings({ highContrast: v })}
                  />
                  <ToggleRow
                    title="Reduced Motion"
                    description="Minimize animations and transitions across the app"
                    checked={settings.reducedMotion}
                    onChange={(v) => onUpdateSettings({ reducedMotion: v })}
                  />
                </div>

                <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Keyboard Shortcuts
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-2 text-xs">
                    {[
                      ['Ctrl / Cmd + K', 'Focus chat search'],
                      ['Ctrl / Cmd + F', 'Search inside active chat'],
                      ['Enter / Ctrl+Enter', 'Send message'],
                      ['Shift + Enter', 'Insert new line'],
                      ['Arrow Up (empty box)', 'Edit last sent message'],
                      ['Esc', 'Cancel reply / edit / search'],
                    ].map(([keys, desc]) => (
                      <div key={keys} className="flex items-center justify-between gap-2 py-1">
                        <span className="text-[var(--text-secondary)]">{desc}</span>
                        <kbd className="px-2 py-0.5 rounded bg-[var(--bg-panel)] border border-[var(--border-strong)] font-mono text-[11px] text-[var(--text-primary)]">
                          {keys}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 8. STORAGE & DATA */}
            {activeTab === 'storage' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2">
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">Local Browser Storage</h4>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Drafts and cached preferences are stored locally for instant loading, while all
                    chats, profiles, and media live in your Supabase database & storage buckets.
                  </p>
                  {cacheNotice && <p className="text-xs text-emerald-400">{cacheNotice}</p>}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClearLocalCache();
                        setCacheNotice('Cleared local drafts & cached state.');
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      Clear Local Drafts
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await onResetSettings();
                        setCacheNotice(
                          `Reset all settings to defaults (${DEFAULT_SETTINGS.theme} theme).`
                        );
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                      Reset Settings to Defaults
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
