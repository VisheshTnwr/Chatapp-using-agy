# Chatapp-using-agy (PulseChat)

PulseChat is a full-featured, mobile-first real-time chat web application built with **React, TypeScript, Vite, Tailwind CSS**, and **Supabase** (Postgres, Auth, Realtime Channels, and Storage).

## Features Included
- **Simple Name & Password Auth**: Register and sign in using just a display name (`@username`) and password.
- **Mobile-First Experience**: Dynamic viewport sizing (`100dvh`), soft-keyboard resizing, safe-area padding, iOS no-zoom inputs, full-screen info/settings sheets, and tap-to-open mobile message action sheets.
- **Direct Messages, Groups & Broadcast Channels**: Search users by name or `@username`, create multi-member groups or admin-only channels, and join via invite codes.
- **Full Real-Time Messaging**:
  - Live messages, reactions, read receipts (`✓` / `✓✓` + "Read by" details), and live typing indicators.
  - Online / Away / Do Not Disturb / Invisible presence tracking.
  - Reply/quote, edit, delete for me / delete for everyone, forward, star/bookmark, pin messages, and in-chat search (`Ctrl+F`).
  - Photos/videos (with lightbox), file attachments, voice notes, interactive live polls, markdown/code formatting, link previews, emoji picker, and disappearing message timers.
- **Complete Settings Suite**: Profile & Status, App Lock PIN, Blocked Users, Privacy controls, Desktop & Sound notifications, 4 Themes (`Dark`, `Light`, `Midnight`, `System`), 6 Accent Colors, 4 Wallpapers, Bubble Styles, Accessibility & Keyboard Shortcuts.

---

## Supabase Setup
1. Open your [Supabase Dashboard](https://supabase.com/dashboard) -> **SQL Editor** -> **New Query**.
2. Run the entire [`supabase/schema.sql`](./supabase/schema.sql) script.
3. In **Authentication -> Providers -> Email**, turn **Confirm email** **OFF** so users can register with just a name and password and enter immediately.

---

## Local Development
1. Copy `.env.example` to `.env` and fill in your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
2. Install & run:
   ```bash
   npm install
   npm run dev
   ```

---

## Push to GitHub & Deploy on Netlify

### 1. Push to GitHub
`.gitignore` already excludes `.env`, `node_modules`, and `dist`.
```bash
git init
git add .
git commit -m "Initial PulseChat app"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

### 2. Deploy on Netlify
1. Log in to [Netlify](https://app.netlify.com/) -> **Add new site -> Import an existing project -> GitHub** and select your repository.
2. Netlify will automatically read [`netlify.toml`](./netlify.toml):
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
3. Under **Site configuration -> Environment variables**, add:
   - `VITE_SUPABASE_URL` = `https://hjugrgptgpzkjbtznevy.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `your-supabase-anon-key`
4. Click **Deploy site**.
5. Once deployed, copy your `https://<your-site>.netlify.app` URL and add it to **Supabase -> Authentication -> URL Configuration -> Redirect URLs**.
