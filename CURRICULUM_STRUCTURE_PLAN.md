# Curriculum structure plan — subjects per level, parallel subjects, and period policies

This is a separate document from `NEXT_STEPS.md` on purpose: everything below is
schema-changing groundwork that came out of a conversation with an actual school
administrator before launch, not another item in the existing phase checklist.
Nothing here is built yet — this is still the understanding-and-design stage,
revised once already after the first draft got the core mechanism wrong.

---

## What the administrator told us

### The example that corrects my first draft

A teacher is only available Tuesday and Friday. He teaches Computer Science
(CSC) to Form 4 and Form 5, and Maths to Form 3, Form 4 and Form 5 — and each
of those is a *single* class per level (Form 5 is one class, not split into
several). Given only two available days, he ends up moving class to class
for most of both days. When generating the timetable, the last CSC period for
Form 5 wouldn't fit anywhere — every slot he was free in was already full for
Form 5. The fix the school actually used: they found a slot where Form 5
already had Commerce (COM) scheduled, and put his last CSC period **there,
at the same time** — because a Form 5 student doing Commerce isn't doing CSC,
and vice versa, so nothing actually clashes. In the timetable grid, that one
cell reads `COM/CSC` — two lessons, two teachers, one class, one slot, running
in parallel.

That's the piece my first draft got wrong. I had modeled "subjects that can
run in parallel" as *separate class sections* (e.g. a `Lower Sixth Science`
row and a `Lower Sixth Arts` row in `class_sections`, scheduled completely
independently) — which would have worked, but only for a school that actually
splits its roll into multiple named classes per level. This example is the
opposite: **one class section** (`Form 5`), and two subjects sharing one slot
inside its own single grid, because the school has decided those two subjects
are mutually exclusive electives. That's a genuinely different, harder thing
to build than what I first described — it means the timetable grid for a
single class needs to show more than one lesson in the same cell, and the
generator needs to know "these two subjects are allowed to overlap for this
class" instead of treating "one lesson per class per period" as an absolute
rule.

So: **the "Science / Arts / Commercial / Industrial" streams mentioned in
your first message and this Form 5 Commerce/Computer-Science pairing are the
same underlying mechanism**, not two different features. A stream is really
just a *label* an admin might put on a group of subjects for their own
organization ("these four are the Science combination"); the thing that
actually matters to the generator is which subjects at a given level are
allowed to be scheduled at the same time for the same class, regardless of
whether the admin bothers to name that group "Science" or leaves it unnamed.
I'm treating that as one concept now — **subjects marked as parallel-
compatible at a level** — instead of two.

### Subjects still belong to a level, not the whole school

Unchanged from the first draft: Form 1 does a fixed set of ~14 compulsory
subjects; Commerce exists at Form 1–5 but not at Lower/Upper Sixth. Today
every subject is available to every level with nothing stopping that, and
that still needs fixing.

### Periods-per-week is the level's number, not something typed per assignment

Re-reading this with the corrected model: when an admin assigns a teacher to
teach, say, Form 1 Maths, the "3 periods a week" isn't a number that teacher
or that assignment invents — it's already decided by the school as *the*
weekly frequency for Maths at Form 1. Every teacher who ever teaches Form 1
Maths would get the same 3 periods, because it's a property of "Maths at
Form 1," not of who's teaching it. So this isn't really a "minimum" that
assignments are validated against (what my first draft proposed) — it's a
number that should be **set once per (level, subject) and then just used**,
automatically, wherever that subject/class combination shows up in an
assignment. My first draft's "soft warning if you go under the minimum"
framing was solving the wrong problem — there's nothing to warn about if the
number was never meant to be typed in the first place.

### The Assignments screen already has roughly the right shape

You checked and confirmed: `teaching_assignments` already lets you pick a
teacher, a subject, and a class, with `periods_per_week` as a field on that
row. That structure doesn't need to change. What needs to change is:
- the subject dropdown should only offer subjects that class's level
  actually teaches (today it offers every subject in the school), and
- `periods_per_week` should be filled in automatically from the level's
  configured number for that subject, not typed by the admin — because, per
  above, it isn't actually a per-assignment decision.

The teacher-creation gap is still real and separate: creating a teacher only
lets you pick subjects, not classes. Once subjects are level-scoped, the
teacher form should let an admin pick subjects *and* classes together, and
have that create the matching rows in `teaching_assignments` directly —
using the same automatic periods-per-week — instead of making the admin
repeat the same picks over again in the Assignments screen afterward. Both
entry points end up creating identical rows in the same table; the teacher
form is just a faster way to create several of them at once for one teacher.

---

## Revised model

### `level_subjects` — subjects scoped to a level, with the level's own weekly count

```
level_subjects
  id                uuid primary key
  school_id         uuid  -> schools(id)
  level_id          uuid  -> levels(id)
  subject_id        uuid  -> subjects(id)
  periods_per_week  smallint, not null      -- THE weekly frequency for this subject at this level
  stream_label      text, nullable          -- optional, e.g. "Science" / "Arts" — organizational only, see below
  unique(level_id, subject_id)
```

`subjects` stays one flat catalog per school (so "Mathematics" is still a
single row/color, reused wherever it's taught) — `level_subjects` is what
says which levels teach it, at what weekly frequency.

`stream_label` is deliberately just a plain text tag, not a table of its
own, and not something `class_sections` references. It exists purely so an
admin setting up Lower Sixth's ten-odd subjects can group them visually
while deciding parallel groups (below) — it has no effect on scheduling by
itself.

### Parallel subject groups — the actual mechanism behind `COM/CSC`

```
parallel_subject_groups
  id          uuid primary key
  school_id   uuid  -> schools(id)
  level_id    uuid  -> levels(id)
  name        text, nullable       -- optional, e.g. "Electives block 1"; can just be blank and shown as "COM/CSC"
```

**Revised again after open question #2 was answered**: a subject can belong
to more than one parallel group (Physics can pair with Geography in one
group and with History in a different group, without Geography and History
being interchangeable with each other). A single nullable
`parallel_group_id` column on `level_subjects` can't express that, so it's a
many-to-many join table instead:

```
level_subject_parallel_groups
  level_subject_id   uuid -> level_subjects(id) on delete cascade
  parallel_group_id  uuid -> parallel_subject_groups(id) on delete cascade
  primary key (level_subject_id, parallel_group_id)
```

Two subjects at the same level are allowed to share a (day, period) slot for
any class section at that level if their `level_subjects` rows share *any*
common `parallel_group_id` via this join table. A subject with no rows in
the join table behaves exactly as today: it needs its own, exclusive slot.

This is genuinely more work than my first draft's version, in three places:

1. **The generator.** Right now `lib/generation/solver.ts` tracks class
   occupancy with a flat "is this class busy at this slot, yes or no" check
   (one `classBusy` set, keyed by class+day+period — I read enough of it to
   confirm this, without changing anything). That check needs to become
   "is this class busy with something *not in the same parallel group as
   what I'm trying to place*" instead of a flat yes/no.
2. **The database.** `timetable_entries` currently has a hard uniqueness
   rule that guarantees at most one lesson per class per slot. That rule
   needs to allow an exception specifically when the entries involved share
   a parallel group — which isn't expressible as a plain uniqueness
   constraint, so it becomes a proper check (most likely a trigger,
   following the same pattern this schema already uses for
   `swap_timetable_entries`), not just a column addition.
3. **The timetable screens.** The Class and Teacher views currently only
   render one lesson per grid cell. They need to render more than one when
   the generator legitimately placed a parallel pair there (the Master view
   already stacks multiple lessons per cell today, for a different reason —
   different classes overlapping — so the display pattern already exists,
   it just needs to also apply to the Class/Teacher views). The PDF export
   already joins multiple entries per cell with a line break, so that part
   needs no change.

I want that scope called out plainly rather than glossed over: this is the
single biggest piece of work in this whole document, bigger than the
level-scoping and auto-calculated-periods changes combined.

### Teaching assignments: filtered subjects, automatic periods

No schema change to `teaching_assignments` itself. Changes are in the UI:
- Subject dropdown (both in the Assignments screen and the new teacher-form
  picker) filters to what `level_subjects` says that class's level offers.
- `periods_per_week` is read from `level_subjects` for the chosen
  (level, subject) pair and set automatically — not typed by the admin. If a
  level hasn't had that subject's weekly count configured yet, the admin is
  routed to set it there (on the level) rather than being allowed to invent
  a number on the assignment.

### Teacher form gets a class + subject picker that creates real assignments

Add a "classes taught" multi-select next to the existing subjects checklist
on the teacher modal. On save, for every (subject × class) pair the class's
level actually offers, create the matching `teaching_assignments` row with
the automatic periods-per-week from above — skipping any pair the level
doesn't offer, so picking "Maths + CSC" for a teacher across several classes
doesn't create a row for a class whose level doesn't teach one of them.

---

## Step-by-step build plan (revised)

### Phase 1 — Schema ✅ done (2026-08-19, `supabase/migrations/20260819120000_level_subjects_parallel_groups.sql`, pushed to `timetableproject`)
- [x] `level_subjects` table (level-scoped subjects + their weekly count +
      optional stream label), with RLS following the existing pattern.
- [x] `parallel_subject_groups` table + the `parallel_group_id` column on
      `level_subjects`. Also added a trigger enforcing that a subject's
      parallel group belongs to the same level as the subject itself (not in
      the original plan, added as a cheap integrity guard).
- [x] Backfill migration: for every existing `(level, subject)` pair that
      already has real `teaching_assignments` rows today, create a matching
      `level_subjects` row using whatever `periods_per_week` those existing
      assignments already use (most common value if they disagree), so nothing
      existing breaks once subject pickers start filtering by this table.
- [x] Design and add the database-level check that allows two
      `timetable_entries` in the same class/slot only when their subjects
      share a `parallel_group_id` — replacing today's flat uniqueness rule.
      Implemented as a `before insert or update` trigger
      (`check_timetable_entry_class_slot`); the old flat unique constraint was
      dropped by column-set lookup since its auto-generated name wasn't known.
- [x] **Follow-up (2026-08-19, `supabase/migrations/20260819130000_level_subject_parallel_groups_many_to_many.sql`)**:
      open question #2 came back "a subject can belong to more than one
      parallel group", which the single `parallel_group_id` column couldn't
      express. Replaced it with the `level_subject_parallel_groups` join
      table described above, backfilling existing single-group memberships
      first. Rewrote `check_timetable_entry_class_slot()` to allow a shared
      slot when the two entries' `level_subjects` rows have *any* group in
      common (via a self-join on the join table) instead of comparing one
      column for equality. Pushed to `timetableproject` on 2026-08-19 —
      `supabase migration list` confirms local and remote now match on all
      five migrations.

### Phase 2 — Manage subjects per level (new UI) ✅ done
- [x] Levels screen gains a "Manage subjects" modal per level
      (`LevelSubjectsModal` in `components/levels.tsx`): checkbox to add/remove
      each of the school's catalog subjects from the level, an inline weekly
      periods count, and an optional stream label, plus a running count shown
      on the Levels page's "Subjects per level" table.
- [x] Parallel groups: "+ New group" creates an (initially unnamed) group,
      rename inline, delete with confirmation. Each subject row shows one
      toggle-chip per existing group (`.group-toggle-list`) so a subject can
      be switched on/off multiple groups independently, matching the
      many-to-many model above — not a single dropdown.

### Phase 3 — Subject pickers become level-aware, periods become automatic ✅ done
- [x] Teaching assignment modal (`components/assignments.tsx`): reordered to
      Teacher → Class section → Subject, since the subject list now depends
      on the class's level. Subject dropdown is filtered to what
      `level_subjects` configures for that level; `periods_per_week` is
      read-only and auto-filled from that same row, no longer typed by the
      admin. If a level has no subjects configured yet, the subject field is
      replaced with a hint pointing at Levels → Manage subjects instead of
      showing an empty, unusable dropdown.
- [ ] The teacher-form picker (bulk create assignments from the teacher
      modal) is Phase 4, not touched here.

### Phase 4 — Teacher form gets class-aware bulk assignment
- [ ] "Classes taught" multi-select on the teacher modal, creating the
      matching `teaching_assignments` rows as described above.

### Phase 5 — Generator learns about parallel groups
- [ ] `lib/generation/solver.ts`: class-occupancy check allows a slot that's
      occupied by a same-parallel-group subject instead of rejecting it
      outright.
- [ ] Placement logic actively tries to co-place parallel-group subjects into
      shared slots where possible, rather than only tolerating it if the
      search happens to land there.

### Phase 6 — Timetable display shows parallel lessons
- [ ] Class and Teacher views render more than one lesson per cell (reusing
      the Master view's existing stacking pattern).
- [ ] Selecting/locking a specific lesson in a shared cell still targets that
      one lesson, not both.

### Phase 7 — Setup guidance
- [ ] Dashboard / empty-state copy states the dependency order explicitly:
      levels → subjects → subjects-per-level (incl. weekly counts and any
      parallel groups) → class sections → teachers → assignments.

---

## Open questions — resolved

Answers came back inline below. #2 changed the schema (see the Phase 1
follow-up above); #4 is reflected in Phase 5's plan to actively co-place
parallel subjects, not just tolerate them.

1. Is my restated understanding of `COM/CSC` correct now — one class
   section, two subjects sharing a slot because they're mutually exclusive
   electives — or is there still a scenario you have in mind involving
   multiple class sections per level (actual named streams as separate
   classes) that this doesn't cover? ans: your understanding is correct
   
2. Can a subject belong to more than one parallel group across different
   contexts, or is "belongs to at most one parallel group per level" (what
   I've modeled) always true in practice? ans:  a subject can belong to more than one parallel group eg physics and geo can go , physics and history etc
3. Is `periods_per_week` on `level_subjects` always a single fixed number
   agreed on for the whole level, or does it ever vary by class section
   within the same level (e.g. Form 5A does Maths 3×/week but Form 5B does
   it 4×/week)? The model above assumes it doesn't vary. ans: single number for whole level
4. For the parallel-group generator work (Phase 5) — should the generator
   *actively try* to pair parallel subjects together to save slots (closer
   to what actually happened in your example — filling a gap efficiently),
   or is it enough that it merely *allows* it when the search happens to
   land there, and the rest is still down to manual dragging in the editor?
   The former is more useful but is meaningfully more solver work. ans: do what you recommend
