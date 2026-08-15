# Supabase setup

This document explains how this project is wired to Supabase: where the credentials live, what got installed, how the database schema got onto the remote project, and how to change that schema safely going forward. It's written for whoever picks this codebase up next — including future-you.

For what Supabase actually stores (tables, RLS policies, functions), read `supabase/migrations/*.sql` directly — this file explains the *process* around it, not the schema itself.

---

## 1. What Supabase is used for in this project

Three things, per the standard Supabase-on-Next.js split:

- **Postgres database** — every table the app needs (schools, teachers, classes, timetables, etc.), with Row Level Security enforcing that one school can never see another school's data.
- **Auth** — email/password accounts for school administrators. Supabase issues the session; this app just reads/refreshes it.
- **Nothing else yet** — Storage (for school logos) and Edge Functions aren't set up. Not needed until those features are actually built.

**Important context for whoever reads this next:** as of this writing, the database is live and reachable, but the app's screens (`components/app-shell.tsx`, `components/auth-screen.tsx`) still run entirely on hardcoded arrays from `lib/demo-data.ts`. Nothing in `app/` or `components/` calls `createClient()` yet. The plumbing below is real and working — the UI just isn't wired to it. That's the next piece of work, not something already done.

---

## 2. The Supabase project

- **Project name:** timetableproject
- **Project ref:** `umcgtihssveztszgaepe`
- **Region:** eu-west-1
- **Postgres version:** 17

The project ref is the short ID in the project's URL (`https://umcgtihssveztszgaepe.supabase.co`) and in the Supabase dashboard URL. You'll need it any time you link a machine to this project with the CLI (see §6).

Where to find credentials for a fresh machine: Supabase dashboard → the project → **Project Settings**:

| Value | Where | Used by |
|---|---|---|
| Project URL | Project Settings → API | `NEXT_PUBLIC_SUPABASE_URL` |
| Publishable key (or legacy "anon" key) | Project Settings → API Keys | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Secret / service role key | Project Settings → API Keys | `SUPABASE_SERVICE_ROLE_KEY` (server-only, not used yet) |
| Database password | Only shown once, at project creation. Reset it under Project Settings → Database if lost. | Linking the CLI (`supabase link`) |

None of these values are, or should ever be, committed to this repo. See §7 for the one time we got this wrong.

---

## 3. Environment variables

Copy `.env.example` to `.env.local` and fill it in:

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://umcgtihssveztszgaepe.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEMO_MODE=true
```

Two gotchas we actually hit setting this up, worth knowing about so you don't repeat them:

1. **The file must be named exactly `.env.local`** (leading dot). Next.js silently ignores anything else — a file literally named `env.local` (no dot) gets read by nothing and just sits there looking like it should work.
2. **Key naming has two generations.** Newer Supabase projects issue a `sb_publishable_...` key and call it the "publishable key." Older projects (and most existing docs/tutorials) call the equivalent thing the "anon key" (`NEXT_PUBLIC_SUPABASE_ANON_KEY`). Both work — `lib/supabase/client.ts` and `lib/supabase/server.ts` check `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` first and fall back to `NEXT_PUBLIC_SUPABASE_ANON_KEY` — but if you paste a key under the wrong variable name entirely, `createClient()` just returns `null` with no error, and things fail silently downstream. If Supabase calls aren't working, check this first.

`NEXT_PUBLIC_DEMO_MODE` and `NEXT_PUBLIC_APP_URL` are read from `.env.example` by convention but nothing in the code currently checks `NEXT_PUBLIC_DEMO_MODE` — see the note in §1.

---

## 4. Packages installed

Already in `package.json` from the start of the project:

- `@supabase/supabase-js` — the core client library
- `@supabase/ssr` — cookie-aware client creation for Next.js App Router (separate browser vs. server client helpers)

Added while setting up migrations:

- `supabase` (devDependency) — the Supabase CLI, installed locally via `npm install supabase --save-dev`. Supabase does **not** support installing this globally with `npm install -g`, so it's invoked as `npx supabase ...` (npx finds the local copy in `node_modules/.bin`).

---

## 5. Files this project has for Supabase

```
lib/supabase/client.ts       Browser-side Supabase client (for client components)
lib/supabase/server.ts       Server-side Supabase client (for server components / route handlers)
middleware.ts                 Refreshes the auth session cookie on every request
app/auth/callback/route.ts   Exchanges the code from an email-confirmation link for a session
supabase/config.toml          CLI project config (generated by `supabase init`)
supabase/migrations/          Versioned schema changes — the source of truth for the database
supabase/schema.sql           The same schema as one flat file, kept as a manual SQL Editor fallback
```

**`lib/supabase/client.ts` / `server.ts`** both return `null` instead of throwing if credentials are missing or still placeholders (`url.includes("YOUR_PROJECT")`). This is what makes demo mode possible without a database — any code that calls `createClient()` needs to handle the `null` case rather than assume a client always exists.

**`middleware.ts`** runs on every request (except static assets — see its `matcher` config), calls `supabase.auth.getUser()`, and writes the refreshed session cookie back onto the response. Without this, a logged-in admin's session would silently expire mid-visit instead of auto-refreshing. It no-ops (returns the request untouched) if env vars aren't set, same as the client helpers.

**`app/auth/callback/route.ts`** exists for the auth flows that redirect back to the app with a `?code=...` (email confirmation, magic links). It exchanges that code for a real session, then redirects to `next` (or `/`). This route isn't reachable yet in practice because nothing calls `supabase.auth.signUp()` from the UI — it's there so that when sign-up *is* wired up, the redirect target already works, and so the Auth URL Configuration in the dashboard (`http://localhost:3000/auth/callback`) points at something real.

---

## 6. How the schema got onto the database (what we actually ran)

The full history, in order, for anyone wondering why things look the way they do:

1. `supabase/schema.sql` already existed in the repo as a single hand-written file — one big script covering every table, RLS policy, function and trigger.
2. Installed the CLI: `npm install supabase --save-dev`
3. Scaffolded CLI config: `npx supabase init --yes` → created `supabase/config.toml`
4. Turned the flat schema into a proper migration by copying it into `supabase/migrations/20260815172601_init_schema.sql` (the Supabase CLI expects migrations as timestamped files in this folder — it does not read `schema.sql` directly). `schema.sql` was left in place afterwards, unchanged, as a fallback for anyone who wants to paste it straight into the SQL Editor instead of using the CLI.
5. Authenticated the CLI: `npx supabase login` — this is interactive (opens a browser for OAuth) and has to be run by a human once per machine. It stores a token locally; it is **not** something to script or share.
6. Linked this local project to the remote one: `npx supabase link --project-ref umcgtihssveztszgaepe` (prompts for the database password to verify the connection).
7. Pushed the migration: `npx supabase db push` — applied `20260815172601_init_schema.sql` to the live database.
8. Verified it stuck: `npx supabase migration list` — confirms the local migration's checksum matches what the remote database has recorded as applied.

That db push is why the tables, RLS policies, `create_school_workspace` RPC, and the `handle_new_user` trigger all exist on the live project right now.

---

## 7. Changing the schema and re-applying it

**Never edit a migration file that's already been pushed.** Once `db push` has applied it, that file is a permanent historical record — the CLI tracks what's applied by filename + checksum, so editing an old one just makes your local history disagree with the remote database's. Always add a *new* file for a *new* change, the same way you'd never rewrite a past git commit that's already been pushed.

The workflow for any schema change:

```bash
# 1. Create a new, empty, correctly-timestamped migration file
npx supabase migration new add_teacher_notes_column

# 2. This creates something like:
#    supabase/migrations/20260901120000_add_teacher_notes_column.sql
#    Open it and write plain SQL, e.g.:
#      alter table public.teachers add column notes text;

# 3. Apply it to the remote database
npx supabase db push

# 4. Confirm it applied
npx supabase migration list
```

That's the whole loop. A few things worth knowing:

- **Order matters.** Migrations apply in filename (timestamp) order. If two people create migrations independently and their timestamps land in a strange order relative to dependencies (e.g. a migration that alters a table created in a later-timestamped migration), `db push` will fail with a clear Postgres error — just reorder/rename if that happens before anyone's applied it.
- **This project has no local Docker-based dev database running.** `supabase db push` talked straight to the real remote database every time — there's no `supabase start` local Postgres in the loop to test against first. That's fine for a single-developer project at this stage, but means every migration push is a direct change to the shared database. If this project grows a team, consider adopting `supabase start` (needs Docker Desktop) so schema changes can be tested locally before `db push`.
- **The Docker warning during `db push` is harmless.** You'll see `failed to inspect docker image: ... dockerDesktopLinuxEngine ...` — that's the CLI trying (and failing, since Docker isn't installed/running here) to cache a migration catalog for the *optional* `supabase db diff` command. It does not affect whether the migration actually applies; `db push` still succeeds.
- **`supabase db diff` is the alternative to hand-writing SQL** — with Docker Desktop running, it can compare your local shadow database (after you make changes some other way) against your migrations and generate the SQL for you. Not currently used in this project; mentioned here in case it's useful later.
- **Rolling back is manual.** The Supabase CLI doesn't have a one-command "undo the last migration." If a pushed migration turns out to be wrong, write a new migration that reverses it (e.g. `alter table ... drop column ...`), rather than trying to delete or rewrite the bad one.
- **`supabase/schema.sql` will drift out of date** once new migrations are added, since it isn't regenerated automatically. Treat `supabase/migrations/` as the real source of truth; update or remove `schema.sql` if it starts causing confusion.

### Setting up a new machine against this same project

Anyone else working on this codebase needs to repeat steps 5–6 from §6 (not 1–4 — those already happened and are in the repo):

```bash
npm install                                          # installs the CLI as part of devDependencies
npx supabase login                                    # one-time per machine, opens a browser
npx supabase link --project-ref umcgtihssveztszgaepe   # will ask for the database password
npx supabase db push                                   # applies any migrations not yet on the remote
```

---

## 8. Security notes

- `.env.local` is git-ignored. Never commit it, never paste its contents into a doc like this one.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security entirely — it must only ever be read in server-side code (route handlers, server components), never sent to the browser. Nothing in this codebase uses it yet.
- The database password is only needed for CLI linking (§6/§7) and for direct `psql` access. It is not an application secret and doesn't belong in `.env.local`, code, or any committed file — treat it like any other database root credential (a password manager, not a text file). Earlier in this project's history it briefly ended up pasted into `README.md`; that line has since been removed. If that password was ever shared anywhere outside this machine, reset it from Project Settings → Database.
- `supabase/.temp/` and `supabase/.branches/` (local CLI state created by `link`/`db push`) are git-ignored. They hold cached project metadata, not credentials, but there's no reason to version them.
- Row Level Security is enabled on every school-owned table, gated on `school_id` via the `is_school_member` / `can_manage_school` helper functions defined in the migration. Never disable RLS on any table in production, even temporarily for debugging — query as an authenticated user through the normal client instead.
