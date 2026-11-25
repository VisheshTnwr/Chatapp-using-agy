-- ============================================================================
-- PulseChat - Complete Supabase Database Setup Script
-- ============================================================================
-- Run this entire script in the Supabase SQL Editor (Dashboard -> SQL Editor).
-- Also enable Google OAuth in Authentication -> Providers -> Google, and add
-- your app URL (e.g. http://localhost:5173) to Redirect URLs.
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLES

-- User profiles (automatically populated on Google/Gmail OAuth signup)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT DEFAULT '',
  bio TEXT DEFAULT 'Hey there! I am using PulseChat.',
  phone TEXT DEFAULT '',
  status_emoji TEXT DEFAULT '💬',
  status_text TEXT DEFAULT '',
  presence_status TEXT NOT NULL DEFAULT 'online'
    CHECK (presence_status IN ('online', 'away', 'dnd', 'offline')),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settings JSONB NOT NULL DEFAULT '{
    "theme": "dark",
    "accentColor": "indigo",
    "wallpaper": "subtle-grid",
    "bubbleStyle": "modern",
    "fontSize": "medium",
    "density": "comfortable",
    "timeFormat": "12h",
    "showAvatars": true,
    "enterToSend": true,
    "convertEmojiShortcodes": true,
    "spellcheck": true,
    "linkPreviews": true,
    "saveDrafts": true,
    "autoDownloadMedia": true,
    "keepArchivedMuted": true,
    "desktopNotifications": true,
    "inAppSounds": true,
    "notificationSound": "chime",
    "notificationPreview": true,
    "mentionsOnly": false,
    "tabBadge": true,
    "readReceipts": true,
    "typingIndicators": true,
    "lastSeenVisibility": "everyone",
    "profilePhotoVisibility": "everyone",
    "bioVisibility": "everyone",
    "groupInvites": "everyone",
    "defaultDisappearingSeconds": 0,
    "highContrast": false,
    "reducedMotion": false,
    "appLockEnabled": false,
    "appLockPin": ""
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversations (direct messages, groups, broadcast channels)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group', 'channel')),
  title TEXT DEFAULT '',
  description TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  invite_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  disappearing_seconds INTEGER NOT NULL DEFAULT 0,
  slow_mode_seconds INTEGER NOT NULL DEFAULT 0,
  only_admins_can_send BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversation memberships & per-chat user preferences
CREATE TABLE IF NOT EXISTS public.conversation_members (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  nickname TEXT DEFAULT '',
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_muted BOOLEAN NOT NULL DEFAULT FALSE,
  mute_until TIMESTAMPTZ DEFAULT NULL,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cleared_at TIMESTAMPTZ DEFAULT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL DEFAULT '',
  message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'image', 'file', 'audio', 'video', 'system', 'poll')),
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  forwarded_from_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  attachment_url TEXT DEFAULT '',
  attachment_name TEXT DEFAULT '',
  attachment_size BIGINT DEFAULT 0,
  attachment_mime TEXT DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_edited BOOLEAN NOT NULL DEFAULT FALSE,
  edited_at TIMESTAMPTZ DEFAULT NULL,
  deleted_for_all BOOLEAN NOT NULL DEFAULT FALSE,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-user message deletion ("Delete for me")
CREATE TABLE IF NOT EXISTS public.deleted_messages_for_user (
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

-- Message reactions
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)
);

-- Read receipts per message
CREATE TABLE IF NOT EXISTS public.message_reads (
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

-- Starred / Bookmarked messages
CREATE TABLE IF NOT EXISTS public.starred_messages (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, message_id)
);

-- Poll votes
CREATE TABLE IF NOT EXISTS public.poll_votes (
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL CHECK (option_index >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, option_index)
);

-- Blocked users
CREATE TABLE IF NOT EXISTS public.blocked_users (
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

-- User & message reports
CREATE TABLE IF NOT EXISTS public.user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender
  ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user
  ON public.conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message
  ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username
  ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_email
  ON public.profiles(email);

-- 4. HELPER FUNCTIONS (SECURITY DEFINER to avoid RLS recursion)

CREATE OR REPLACE FUNCTION public.is_conversation_member(conv_id UUID, uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = conv_id AND user_id = uid
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_admin(conv_id UUID, uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = conv_id
      AND user_id = uid
      AND role IN ('owner', 'admin')
  );
$$;

-- Auto-create profile when a user signs up via Google (Gmail) OAuth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  user_email TEXT;
  user_name TEXT;
  user_avatar TEXT;
BEGIN
  user_email := COALESCE(NEW.email, '');
  user_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    split_part(user_email, '@', 1),
    'User'
  );
  user_avatar := COALESCE(
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.raw_user_meta_data ->> 'picture',
    ''
  );

  base_username := regexp_replace(
    lower(COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(user_email, '@', 1))),
    '[^a-z0-9_]',
    '',
    'g'
  );
  IF length(base_username) < 3 THEN
    base_username := 'user_' || substr(replace(NEW.id::text, '-', ''), 1, 6);
  END IF;

  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    final_username := base_username || '_' || substr(md5(random()::text), 1, 4);
  END LOOP;

  INSERT INTO public.profiles (id, email, username, full_name, avatar_url)
  VALUES (NEW.id, user_email, final_username, user_name, user_avatar)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    avatar_url = CASE
      WHEN public.profiles.avatar_url = '' THEN EXCLUDED.avatar_url
      ELSE public.profiles.avatar_url
    END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Keep conversations.updated_at fresh on new messages
CREATE OR REPLACE FUNCTION public.touch_conversation_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_inserted_touch_conv ON public.messages;
CREATE TRIGGER on_message_inserted_touch_conv
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_conversation_updated_at();

-- 5. RPC FUNCTIONS FOR CLEAN ATOMIC OPERATIONS

-- Find or create a 1-on-1 direct message conversation
CREATE OR REPLACE FUNCTION public.create_direct_conversation(target_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_uid UUID := auth.uid();
  existing_conv_id UUID;
  new_conv_id UUID;
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF current_uid = target_user_id THEN
    RAISE EXCEPTION 'Cannot start a direct chat with yourself';
  END IF;

  SELECT c.id INTO existing_conv_id
  FROM public.conversations c
  JOIN public.conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = current_uid
  JOIN public.conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = target_user_id
  WHERE c.type = 'direct'
  LIMIT 1;

  IF existing_conv_id IS NOT NULL THEN
    -- Ensure it is unarchived for the initiator
    UPDATE public.conversation_members
    SET is_archived = FALSE
    WHERE conversation_id = existing_conv_id AND user_id = current_uid;
    RETURN existing_conv_id;
  END IF;

  INSERT INTO public.conversations (type, created_by)
  VALUES ('direct', current_uid)
  RETURNING id INTO new_conv_id;

  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  VALUES
    (new_conv_id, current_uid, 'member'),
    (new_conv_id, target_user_id, 'member');

  RETURN new_conv_id;
END;
$$;

-- Create a group or broadcast channel with initial members
CREATE OR REPLACE FUNCTION public.create_group_conversation(
  group_title TEXT,
  group_type TEXT DEFAULT 'group',
  group_description TEXT DEFAULT '',
  member_ids UUID[] DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_uid UUID := auth.uid();
  new_conv_id UUID;
  uid UUID;
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF group_type NOT IN ('group', 'channel') THEN
    RAISE EXCEPTION 'Invalid group type';
  END IF;

  INSERT INTO public.conversations (type, title, description, created_by, only_admins_can_send)
  VALUES (group_type, trim(group_title), COALESCE(group_description, ''), current_uid, group_type = 'channel')
  RETURNING id INTO new_conv_id;

  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  VALUES (new_conv_id, current_uid, 'owner');

  IF member_ids IS NOT NULL THEN
    FOREACH uid IN ARRAY member_ids LOOP
      IF uid <> current_uid THEN
        INSERT INTO public.conversation_members (conversation_id, user_id, role)
        VALUES (new_conv_id, uid, 'member')
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, content, message_type)
  VALUES (new_conv_id, current_uid, 'created "' || trim(group_title) || '"', 'system');

  RETURN new_conv_id;
END;
$$;

-- Join a group/channel via invite code
CREATE OR REPLACE FUNCTION public.join_conversation_by_invite(invite TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_uid UUID := auth.uid();
  target_conv RECORD;
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO target_conv
  FROM public.conversations
  WHERE invite_code = trim(invite) AND type IN ('group', 'channel')
  LIMIT 1;

  IF target_conv.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite code';
  END IF;

  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  VALUES (target_conv.id, current_uid, 'member')
  ON CONFLICT (conversation_id, user_id) DO UPDATE SET is_archived = FALSE;

  RETURN target_conv.id;
END;
$$;

-- Mark conversation as read & record read receipts
CREATE OR REPLACE FUNCTION public.mark_conversation_read(conv_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_uid UUID := auth.uid();
BEGIN
  IF current_uid IS NULL OR NOT public.is_conversation_member(conv_id, current_uid) THEN
    RETURN;
  END IF;

  UPDATE public.conversation_members
  SET last_read_at = NOW()
  WHERE conversation_id = conv_id AND user_id = current_uid;

  INSERT INTO public.message_reads (message_id, user_id)
  SELECT m.id, current_uid
  FROM public.messages m
  WHERE m.conversation_id = conv_id
    AND m.sender_id <> current_uid
    AND NOT EXISTS (
      SELECT 1 FROM public.message_reads mr
      WHERE mr.message_id = m.id AND mr.user_id = current_uid
    )
  ON CONFLICT DO NOTHING;
END;
$$;

-- 6. ROW LEVEL SECURITY (RLS)

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_messages_for_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.starred_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Conversations
DROP POLICY IF EXISTS "Members can view conversations" ON public.conversations;
CREATE POLICY "Members can view conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (public.is_conversation_member(id));

DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
CREATE POLICY "Authenticated users can create conversations"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Admins or DM members can update conversations" ON public.conversations;
CREATE POLICY "Admins or DM members can update conversations"
  ON public.conversations FOR UPDATE TO authenticated
  USING (
    public.is_conversation_admin(id)
    OR (type = 'direct' AND public.is_conversation_member(id))
  );

-- Conversation Members
DROP POLICY IF EXISTS "Members can view conversation membership" ON public.conversation_members;
CREATE POLICY "Members can view conversation membership"
  ON public.conversation_members FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id));

DROP POLICY IF EXISTS "Admins can add members" ON public.conversation_members;
CREATE POLICY "Admins can add members"
  ON public.conversation_members FOR INSERT TO authenticated
  WITH CHECK (public.is_conversation_admin(conversation_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own membership or admins can update roles" ON public.conversation_members;
CREATE POLICY "Users can update own membership or admins can update roles"
  ON public.conversation_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_conversation_admin(conversation_id));

DROP POLICY IF EXISTS "Users can leave or admins can remove members" ON public.conversation_members;
CREATE POLICY "Users can leave or admins can remove members"
  ON public.conversation_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_conversation_admin(conversation_id));

-- Messages
DROP POLICY IF EXISTS "Members can view messages" ON public.messages;
CREATE POLICY "Members can view messages"
  ON public.messages FOR SELECT TO authenticated
  USING (
    public.is_conversation_member(conversation_id)
    AND (expires_at IS NULL OR expires_at > NOW())
  );

DROP POLICY IF EXISTS "Members can send messages" ON public.messages;
CREATE POLICY "Members can send messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    public.is_conversation_member(conversation_id)
    AND (sender_id = auth.uid() OR sender_id IS NULL)
  );

DROP POLICY IF EXISTS "Senders can edit or admins can pin messages" ON public.messages;
CREATE POLICY "Senders can edit or admins can pin messages"
  ON public.messages FOR UPDATE TO authenticated
  USING (
    sender_id = auth.uid()
    OR public.is_conversation_admin(conversation_id)
    OR public.is_conversation_member(conversation_id)
  );

-- Deleted messages for user
DROP POLICY IF EXISTS "Users manage own deleted messages" ON public.deleted_messages_for_user;
CREATE POLICY "Users manage own deleted messages"
  ON public.deleted_messages_for_user FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Message Reactions
DROP POLICY IF EXISTS "Members can view reactions" ON public.message_reactions;
CREATE POLICY "Members can view reactions"
  ON public.message_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id AND public.is_conversation_member(m.conversation_id)
    )
  );

DROP POLICY IF EXISTS "Members can add reactions" ON public.message_reactions;
CREATE POLICY "Members can add reactions"
  ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id AND public.is_conversation_member(m.conversation_id)
    )
  );

DROP POLICY IF EXISTS "Users can remove own reactions" ON public.message_reactions;
CREATE POLICY "Users can remove own reactions"
  ON public.message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Message Reads
DROP POLICY IF EXISTS "Members can view read receipts" ON public.message_reads;
CREATE POLICY "Members can view read receipts"
  ON public.message_reads FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id AND public.is_conversation_member(m.conversation_id)
    )
  );

DROP POLICY IF EXISTS "Users can insert own read receipts" ON public.message_reads;
CREATE POLICY "Users can insert own read receipts"
  ON public.message_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Starred Messages
DROP POLICY IF EXISTS "Users manage own starred messages" ON public.starred_messages;
CREATE POLICY "Users manage own starred messages"
  ON public.starred_messages FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Poll Votes
DROP POLICY IF EXISTS "Members can view poll votes" ON public.poll_votes;
CREATE POLICY "Members can view poll votes"
  ON public.poll_votes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id AND public.is_conversation_member(m.conversation_id)
    )
  );

DROP POLICY IF EXISTS "Members can vote in polls" ON public.poll_votes;
CREATE POLICY "Members can vote in polls"
  ON public.poll_votes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id AND public.is_conversation_member(m.conversation_id)
    )
  );

DROP POLICY IF EXISTS "Users can remove own poll votes" ON public.poll_votes;
CREATE POLICY "Users can remove own poll votes"
  ON public.poll_votes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Blocked Users
DROP POLICY IF EXISTS "Users manage own blocks" ON public.blocked_users;
CREATE POLICY "Users manage own blocks"
  ON public.blocked_users FOR ALL TO authenticated
  USING (blocker_id = auth.uid())
  WITH CHECK (blocker_id = auth.uid());

-- User Reports
DROP POLICY IF EXISTS "Users can submit reports" ON public.user_reports;
CREATE POLICY "Users can submit reports"
  ON public.user_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own reports" ON public.user_reports;
CREATE POLICY "Users can view own reports"
  ON public.user_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

-- 7. REALTIME PUBLICATION
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. STORAGE BUCKETS & POLICIES (Avatars + Chat Attachments)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated users upload own avatar" ON storage.objects;
CREATE POLICY "Authenticated users upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Authenticated users update own avatar" ON storage.objects;
CREATE POLICY "Authenticated users update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Authenticated read chat attachments" ON storage.objects;
CREATE POLICY "Authenticated read chat attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "Authenticated upload chat attachments" ON storage.objects;
CREATE POLICY "Authenticated upload chat attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');
