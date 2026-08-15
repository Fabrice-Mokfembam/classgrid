# TimetableFlow MVP

A commercial multi-school timetable platform built with Next.js, TypeScript and Supabase. The UI currently runs on sample data (see `NEXT_STEPS.md`) so the full interface can be reviewed before it's wired up to the live database.

## Included

- Public product landing page
- School administrator sign-in and detailed four-step school registration
- Multi-school database schema with Row Level Security
- School dashboard and setup progress
- Academic schedule, periods and breaks
- Levels and actual class sections (for example, Form 1 and Form 1A)
- Subject and teacher management
- Administrator-managed teacher availability grid
- Teaching assignments and weekly lesson patterns
- Pre-generation validation
- Timetable generation workflow foundation
- Class timetable editor with drag-and-drop swapping, lesson locks and live warnings
- School profile settings
- Responsive desktop/mobile layouts
- Supabase client/server helpers and TypeScript domain types

## 1. Run locally now

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The UI runs on sample data, so no database connection is required to browse it.

## 2. Create the Supabase database later

Option A — Supabase CLI (recommended; keeps schema changes versioned):

```bash
npx supabase login                                  # one-time, opens a browser
npx supabase link --project-ref YOUR_PROJECT_REF     # find the ref in your project URL
npx supabase db push                                 # applies everything in supabase/migrations
```

Future schema changes go in a new timestamped file under `supabase/migrations/` and get applied the same way with `db push`.

Option B — SQL Editor, no CLI required:

1. Create a new project at Supabase.
2. Open **SQL Editor**.
3. Copy all of `supabase/schema.sql` and run it once.
4. Confirm that the tables appear in **Table Editor**.

Either way, finish setup:

5. In **Authentication > URL Configuration**, add:
   - Site URL: your deployed application URL
   - Redirect URL for local development: `http://localhost:3000/auth/callback`
6. Keep email/password authentication enabled.

The SQL creates all tables, relationships, indexes, data isolation policies, helper functions, onboarding transaction and Auth profile trigger.

## 3. Add environment credentials

Copy `.env.example` to `.env.local` and replace the placeholders:

```bash
cp .env.example .env.local
```

Set:

- `NEXT_PUBLIC_SUPABASE_URL`: Project Settings > API > Project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Project Settings > API Keys > publishable key (older projects call this the anon/public key — `NEXT_PUBLIC_SUPABASE_ANON_KEY` also works)
- `SUPABASE_SERVICE_ROLE_KEY`: Project Settings > API Keys > secret/service role key (server only)
- `NEXT_PUBLIC_APP_URL`: your local or deployed URL

Never commit `.env.local` or expose the service-role key in browser code.

## 4. What remains when Supabase is ready

The supplied UI currently uses realistic sample records from `lib/demo-data.ts`. After you add credentials, connect each form and table to Supabase in this order:

1. Auth sign-up/sign-in and `create_school_workspace` RPC
2. Current school and academic-year context
3. Levels, classes, subjects and teachers CRUD
4. Availability and teaching assignments
5. Timetables, generation runs and timetable entries
6. PDF exports and production subscription billing

The SQL and TypeScript models already use these exact concepts, so connecting persistence will not require redesigning the system.

## Important product rule

Every school-owned table contains `school_id`. Row Level Security checks membership before reading and requires a manager role before writing. Never disable RLS in production.

## Useful commands

```bash
npm run dev
npm run typecheck
npm run build
npm start
```

## Timetable engine direction

The MVP UI and schema support server-side generation jobs. Begin with a TypeScript constraint/backtracking engine in a server route or background worker. When scheduling complexity or school volume grows, the engine alone can be moved to a Python OR-Tools service without changing the Next.js application or Supabase schema.


