# TaskFlow — Personal Task Manager

A multi-file web app with Supabase backend and Claude AI assistant.

## Project Structure

```
taskflow/
├── index.html              # Main HTML shell
├── css/
│   └── style.css           # All styles
├── js/
│   ├── config.js           # Supabase credentials (edit this first)
│   ├── auth.js             # Sign in / sign up / sign out
│   ├── tasks.js            # Task CRUD (Supabase)
│   ├── ai.js               # Claude AI chat
│   ├── ui.js               # Rendering & interactions
│   └── app.js              # Entry point / auth routing
├── supabase_schema.sql     # Run this in Supabase SQL Editor
└── README.md
```

## Setup Steps

### 1. Create a Supabase project
- Go to https://supabase.com → New project
- Copy your **Project URL** and **anon public key** from:
  Settings → API

### 2. Run the schema
- Open Supabase → SQL Editor
- Paste the contents of `supabase_schema.sql` and run it

### 3. Configure credentials
- Open `js/config.js`
- Replace the two placeholder values:
  ```js
  const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
  const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';
  ```

### 4. Enable Email Auth
- Supabase → Authentication → Providers → Email → Enable

### 5. Run the app
Open `index.html` in your browser, or serve it with any static host:
- **Local**: just open index.html directly (or use Live Server in VS Code)
- **Vercel**: drag the taskflow folder into vercel.com
- **Huawei Cloud OBS**: upload all files, enable static website hosting

## Features
- Sign up / sign in (Supabase Auth)
- Add, edit, delete tasks
- Priority levels: High / Medium / Low
- Due dates with overdue detection
- Filter views: All, Pending, Today, Overdue, High Priority, Done
- Sort by due date, priority, or created date
- Progress bar + stats
- AI chat assistant (Claude) — knows all your tasks
- Quick prompt chips
- Per-user data (Row Level Security — users only see their own tasks)
