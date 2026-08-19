# Next steps

A prioritized, bit-by-bit roadmap from where this project stands right now to a working product. Ordered so each phase unlocks the next one — don't skip ahead to timetable generation before auth works, for example, because everything downstream needs to know which school it's looking at.

Check things off as you go. This file will get stale — update it as reality changes, don't treat it as gospel.

---

## Where things actually stand today

Worth being honest about, since it's easy to look at the polished UI and assume more is connected than actually is:

- **The database is real and live.** Schema, RLS, helper functions, the onboarding RPC — all pushed and working (see `supabase.md`).
- **Nothing in the UI calls it yet.** `grep`ing `app/` and `components/` for `createClient` turns up zero matches outside the two helper files themselves. Every screen — sign-in, dashboard, teachers, availability, timetable — runs on hardcoded arrays from `lib/demo-data.ts`.
- **"Add" buttons don't add anything.** The `EntryModal` used for "Add teacher" / "Add class" / "Add subject" / "Add assignment" shows a success toast and closes — it never touches the underlying arrays, real or fake. Refreshing the page (or just navigating away and back) loses nothing because nothing was gained.
- **There's no edit or delete anywhere.** The "•••" buttons in every table are inert.
- **There's no version control.** `git status` reports this isn't a repo yet. Everything done so far — landing page, onboarding flow, the whole Supabase setup — exists only on disk.

None of that is a criticism of the current state — it's an accurate MVP-demo starting point. It just means "next steps" means building real functionality, not polishing what's there.

---

## Phase 0 — Foundation (do this first, it's cheap insurance)

- [x] `git init`, first commit, pushed to [github.com/Fabrice-Mokfembam/classgrid](https://github.com/Fabrice-Mokfembam/classgrid).
- [x] Removed the unused `NEXT_PUBLIC_DEMO_MODE` flag and the "Demo mode" badge it drove — neither was ever read/wired to anything. The UI still runs on `lib/demo-data.ts`; that's a Phase 2 problem, not an env-flag one.

---

## Phase 1 — Real authentication

Everything else depends on knowing *which school* is asking for data, which depends on this being real. Start here.

- [x] `components/auth-screen.tsx` calls `supabase.auth.signUp()` for real. Email confirmation is **on** (deliberate choice — see `supabase.md`), so there's no session at sign-up time to call `create_school_workspace` with yet. The whole collected school profile rides along as sign-up metadata (`buildPendingSchool()`) instead of being lost.
- [x] `app/auth/callback/route.ts` reads that metadata back out after the confirmation link is clicked (once a real session exists) and calls `create_school_workspace` there. Migration `20260815194423_workspace_slug_levels_days.sql` extended that RPC to also generate the slug and insert `levels` and a 5-/6-day week — both were silently dropped before.
- [x] A "check your email" screen shows instead of jumping straight into the app after sign-up.
- [x] Sign-in wired to `supabase.auth.signInWithPassword()`, sign-out wired to `supabase.auth.signOut()`.
- [x] `app/page.tsx` checks for an existing session on load, so a returning/just-confirmed admin lands in the app instead of the marketing page.
- [x] Added a minimal "current school" context (`lib/school-context.tsx`): after login, fetches the user's `school_memberships` row (+ joined `schools` and current `academic_years`, filtered on `is_current`), and passes school name / academic year down into `app-shell.tsx`'s sidebar instead of the hardcoded "Excellence Bilingual Academy" / "2026/2027". Phase 1 is now fully done.
- [x] **Found post-launch and fixed: the whole authenticated app had no real URLs.** Every screen (dashboard, teachers, timetable, …) was one client component switching on local `useState`, so the address bar always stayed on `/` — refreshing on any page, or bookmarking/sharing a link to it, silently dumped you back to the dashboard. Replaced with real routes at `/<school-slug>/teachers`, `/<school-slug>/timetable`, etc. (`schools.slug`, already generated at onboarding, is the URL segment). The sidebar nav is now real `<Link>`s (`components/app-shell.tsx`'s `AppShellChrome`), and the active item / page heading are derived from `usePathname()` instead of tracked state. Sign-in, the post-confirmation callback (`app/auth/callback/route.ts`), and the landing page's "already signed in" check all now resolve the admin's school slug and land them on `/<slug>` directly instead of `/`.
- [x] **Found immediately after, and fixed: that first routing pass made every sidebar click feel frozen.** The initial `app/[school]/layout.tsx` did two sequential Supabase round trips (an auth check, then a `school_memberships` query to re-verify the slug) directly in the layout with no Suspense boundary above it, so Next.js couldn't even swap the URL until both finished — a slow Supabase response meant a slow click, every time. Restructured: `layout.tsx` is now synchronous and wraps a new `app/[school]/school-gate.tsx` (the actual async auth check) in `<Suspense>`, so navigation commits immediately and the real content streams in. Also dropped the second round trip entirely — screens already scope every data query by the `schoolId` `lib/school-context.tsx` fetches client-side, never by the URL's slug, so re-verifying the slug server-side on every navigation was pure overhead for a property that isn't actually a security boundary. `AppShellChrome` now corrects a stale/wrong slug with `router.replace` once that client fetch resolves instead.

---

## Phase 2 — Replace demo data with real CRUD, one screen at a time

Do these in this order — each one is a dependency for the next (assignments need teachers *and* subjects *and* classes to already exist as real rows).

- [x] **Levels & class sections** (`levels` / `class_sections` tables) — list, create, edit, delete. The old demo UI never modeled "level" as its own entity (just a free-text `level` string on each class), so this screen now shows real `levels` as editable/deletable chips above the real `class_sections` table, with the class-section form's "Level" field populated from those rows. Deleting a level that still has class sections fails at the DB layer (`level_id` is `ON DELETE RESTRICT`) — surfaced as a toast, not silently dropped. The old fake "Assignments" column is gone since `teaching_assignments` isn't wired up yet (Phase 2's last item) — showing a count there would've been fabricated.
- [x] **Subjects** (`subjects` table) — list, create, edit, delete, colour picker (6 presets + a native colour input for anything custom). Scoped to `school_id` only (subjects aren't per-academic-year like levels/class sections). Deleting a subject that's referenced by real `teaching_assignments`/`timetable_entries` rows will fail (`ON DELETE RESTRICT`) — surfaced as a toast; harmless today since neither table has real rows yet.
- [x] **Teachers** (`teachers` + `teacher_subjects`) — list, create, edit, delete, subject assignment (checkbox list on the modal, saved by clearing and re-inserting that teacher's `teacher_subjects` rows). Each card's "required periods" / "available slots" are real aggregates from `teaching_assignments` / `teacher_availability`, not fabricated — they're 0 until those tables have rows, which is honest for a fresh school. Deleting a teacher with real assignments fails (`ON DELETE RESTRICT`) — surfaced as a toast.
- [x] **Teacher availability** (`teacher_availability`) — grid wired to real rows, keyed by real `working_days` × `period_slots` instead of the old local `Set`. Each cell click **upserts immediately** (no more separate "Save changes" button — the old one was removed since saves are now per-click); "Reset" deletes all override rows for that teacher, reverting to fully-available. **Important gap found and worked around**: `period_slots` is never seeded anywhere (not by onboarding, not by the still-fake "School schedule" screen) — so a fresh school has zero lesson periods and the grid would otherwise always be empty. Added a one-time "Use default schedule (8 periods)" button on the empty state that seeds a sensible default (matching the periods the old demo UI showed). This does **not** replace building the real School schedule screen — that's still fake and out of Phase 2's scope — it just unblocks this screen from being permanently non-functional.
- [x] **Teaching assignments** (`teaching_assignments`) — list, create, edit, delete, joined to real teacher/subject/class-section names. Duplicate (teacher, subject, class) combos for the same academic year are caught (`unique` constraint) and shown as a friendly toast instead of a raw Postgres error.
- [x] **School schedule** (`working_days` / `period_slots`) — not originally a Phase 2 checklist item, but the gap flagged above meant Teacher availability's "seed defaults" button was a workaround, not a fix. Made real: "Teaching days" toggles a real Saturday `working_days` row's `is_active` flag (adding it if it doesn't exist yet); the period/break list is full CRUD against `period_slots` (`kind` = lesson or break, explicit start/end times, `day_block` derived automatically from start time). The old fake "Default lesson duration" / "Morning ends after" dropdowns are gone — neither maps to any real column, so they'd have been decorative next to everything else now being real. "Weekly capacity" is now a genuine `lessonPeriods × activeDays` computation instead of a hardcoded "40 lesson slots". Drag-to-reorder periods is still just a decorative handle (was already non-functional before this pass) — reordering isn't implemented.

With all five done, the shared fake `EntryModal`/`modal` state in `app-shell.tsx` had nothing left calling it and was deleted — every screen above now has its own real, dedicated modal.

For each one: replace the import from `lib/demo-data` with a real fetch, add a loading state (there currently isn't a single loading spinner anywhere in the app), an empty state ("no teachers yet — add your first one"), and make `EntryModal` actually insert a row and refresh the list instead of just toasting.

---

## Phase 3 — The generation engine

This is the one piece with genuine algorithmic risk — budget it as its own multi-day effort, not a quick task.

- [x] Built a TypeScript constraint/backtracking solver (`lib/generation/solver.ts`) run from a real server route (`app/api/generate/route.ts`), taking `teaching_assignments` + `teacher_availability` + `period_slots` as input. MRV-ordered unit placement with bounded backtracking (~100k node / ~8s budget) — if the budget runs out or a subset genuinely can't be placed, the run still completes with a partial schedule rather than failing outright; whatever's left over is reported honestly (see below), not silently dropped.
- [x] Enforces the four promised rules: no teacher clashes, no class clashes, availability respected (defaults to available when no override row exists, matching the Availability screen), and balanced distribution (via least-loaded-day value ordering, not a hard constraint). Also enforces `max_per_day`, `max_periods_per_day`, `max_consecutive_periods`, and treats `prefer_morning` as a soft preference. Double periods are stored as two separate `timetable_entries` rows at consecutive `period_slot_id`s (not one row with `duration_slots=2`) — this is what keeps the DB's own uniqueness constraints protecting both halves.
- [x] Writes real `generation_runs`, `timetable_entries`, and `constraint_issues` rows. Unscheduled periods become hard `constraint_issues` explaining which assignment and how many periods; `prefer_morning` violations become soft ones. `timetables.quality_score` is a real `scheduled/required` computation, not fabricated.
- [x] `Generate()` (`app-shell.tsx`) now shows real pre-flight counts and calls the real route instead of a `setTimeout` + canned toast.

---

## Phase 4 — Make the timetable editor persist

- [x] `Timetable()` loads real `timetable_entries` for Class, Teacher, and Master views (Master aggregates every class into the same grid, stacking multiple lesson chips in a cell when classes overlap).
- [x] Drag-and-drop writes to the database. A plain move to an empty cell is a normal `.update()`, letting Postgres's own unique constraints reject cross-class teacher conflicts (surfaced as a toast, not assumed to succeed). A drop onto an occupied cell calls a new `swap_timetable_entries` RPC (`supabase/migrations/20260818005042_swap_timetable_entries.sql`) that deletes-and-reinserts both rows in one atomic statement — a plain two-step update would transiently violate the table's own uniqueness mid-swap. Locked lessons aren't draggable, and the RPC rejects locked entries server-side too as a second line of defense. Editing (drag + lock) is intentionally Class-view-only; Teacher/Master stay read-only lenses.
- [x] Lock/unlock toggle persists `is_locked` for real (`.lock-toggle` in the inspector), verified to survive a page reload.
- [x] "Regenerate unlocked" re-runs the Phase 3 solver in place on the existing timetable: locked entries are left untouched and fed to the solver as already-placed (`SolverInput.preplaced`), only unlocked entries are deleted and replaced, and the timetable's `quality_score` is recomputed from `(locked + newly placed) / total required`.

Still fake/untouched, deliberately out of this phase's scope: the "Validate" button, "Publish timetable", and Dashboard's stats/progress ring.

---

## Phase 5 — Production readiness

Lower priority than the above — these matter once the core loop (setup → generate → publish) actually works end to end.

- [x] Loading and error states throughout — every data screen (Schedule, Levels, Subjects, Teachers, Availability, Assignments, Generate, Timetable) now shows a shape-matched skeleton (`Skel`/`RowsSkeleton`/`GridSkeleton` in `app-shell.tsx`) instead of plain "Loading…" text, and a dedicated `ErrorState` with a "Try again" button on fetch failure instead of silently rendering empty. `lib/school-context.tsx` surfaces its own fetch errors (`error`/`retry`) instead of swallowing them, and `AppShell` shows a full-page error if the school/membership lookup fails. A page-level `ErrorBoundary` (keyed by page, so navigating away resets it) now catches render-time crashes instead of blanking the whole app.
- [x] PDF export — "Download" button on the Timetable toolbar (`downloadPdf()` in `app-shell.tsx`) renders the current view (Class/Teacher/Master) via `jspdf` + `jspdf-autotable` into a landscape PDF with school name/year header. Also added `window.confirm()` guards on the destructive/one-way actions nearby (sign out, generate, regenerate unlocked, publish) while touching this code.
- [ ] Tests — there are currently none
- [ ] Deployment: production env vars on the host (Vercel or similar), set the real `Site URL` and redirect URL in Supabase Auth settings to the deployed domain instead of `localhost:3000`

**Post-MVP (after the above ships and the app is live):**

- [ ] Subscription/billing (README mentions it as a later stage) — deliberately last: no point metering or charging for a product that isn't deployed yet

---

## A note on sequencing

It's tempting to jump straight to Phase 3 (generation) since it's the most interesting engineering problem, but it's useless without Phase 1 and Phase 2 feeding it real teachers, real availability and real assignments. Resist the urge to build the solver against demo data "for now" — it'll just mean rewiring it later.
