import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const supabaseUrl = rawSupabaseUrl?.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project-ref') &&
    !supabaseAnonKey.includes('your-supabase-anon-key')
);

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 15,
      },
    },
  }
);

export function normalizeUsername(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export function resolveAuthEmail(nameOrEmail: string): { email: string; username: string } {
  const trimmed = nameOrEmail.trim();
  if (trimmed.includes('@')) {
    const uname = normalizeUsername(trimmed.split('@')[0]) || 'user';
    return { email: trimmed.toLowerCase(), username: uname };
  }
  const username = normalizeUsername(trimmed);
  return {
    email: `${username}@pulsechat.app`,
    username,
  };
}

export async function registerWithNameAndPassword(name: string, password: string) {
  const displayName = name.trim();
  const { email, username } = resolveAuthEmail(displayName);
  if (username.length < 3) {
    return {
      data: { user: null, session: null },
      error: new Error('Name must have at least 3 letters or numbers.'),
    };
  }

  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: displayName,
        username,
      },
    },
  });
}

export async function signInWithNameAndPassword(name: string, password: string) {
  const { email, username } = resolveAuthEmail(name);
  if (username.length < 3) {
    return {
      data: { user: null, session: null },
      error: new Error('Please enter your registered name (at least 3 characters).'),
    };
  }

  return supabase.auth.signInWithPassword({
    email,
    password,
  });
}

export async function uploadChatFile(
  bucket: 'avatars' | 'chat-attachments',
  path: string,
  file: Blob | File
): Promise<{ publicUrl: string; error: Error | null }> {
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type || 'application/octet-stream',
  });

  if (uploadError) {
    return { publicUrl: '', error: uploadError };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { publicUrl: data.publicUrl, error: null };
}
