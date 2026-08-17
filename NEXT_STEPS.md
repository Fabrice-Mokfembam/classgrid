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

- [ ] Build a constraint/backtracking solver as a server route (per the README's "Timetable engine direction"), taking `teaching_assignments` + `teacher_availability` + `period_slots` as input
- [ ] Enforce the four rules already promised on the landing page and in the in-app "Generate" screen: no teacher clashes, no class clashes, availability respected, balanced distribution
- [ ] Write results to `generation_runs`, `timetable_entries`, and `constraint_issues` (all three tables exist and are shaped for exactly this)
- [ ] Replace the fake `setTimeout` + canned "186 lessons, 0 conflicts" toast in `Generate()` (`app-shell.tsx`) with a real call and real numbers

---

## Phase 4 — Make the timetable editor persist

- [ ] Load real `timetable_entries` for the selected class / teacher / master view instead of the generated `lessons` demo array
- [ ] Drag-and-drop swap writes to the database, respecting the two `unique()` constraints already in the schema (`timetable_id,class_section_id,working_day_id,period_slot_id` and `timetable_id,teacher_id,working_day_id,period_slot_id`) — let the database be the final word on conflicts, don't just trust client-side state
- [ ] Lock/unlock toggle persists `is_locked`
- [ ] "Regenerate unlocked" re-runs the Phase 3 engine but holds locked entries fixed

---

## Phase 5 — Production readiness

Lower priority than the above — these matter once the core loop (setup → generate → publish) actually works end to end.

- [ ] Loading and error states throughout — genuinely absent right now, not just minimal
- [ ] PDF export (mentioned on the landing page and in the UI, not built)
- [ ] Subscription/billing (README mentions it as a later stage)
- [ ] Tests — there are currently none
- [ ] Deployment: production env vars on the host (Vercel or similar), set the real `Site URL` and redirect URL in Supabase Auth settings to the deployed domain instead of `localhost:3000`

---

## A note on sequencing

It's tempting to jump straight to Phase 3 (generation) since it's the most interesting engineering problem, but it's useless without Phase 1 and Phase 2 feeding it real teachers, real availability and real assignments. Resist the urge to build the solver against demo data "for now" — it'll just mean rewiring it later.
