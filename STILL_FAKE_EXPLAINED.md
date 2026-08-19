# Two spots that used to look real but weren't (explained simply)

**Update: both of these are now fixed** (commit `475ff66`). Keeping this
doc as a record of what was wrong and why, since it explains the "fake vs
real" idea in plain terms — just read the two sections below in the past
tense now.

While fixing the Dashboard page to show real numbers, I found two other
spots in the app that were still "fake" — meaning they showed something on
screen, but nothing behind them was actually real.

Think of the whole app like a school play. Most of the set is now real —
when you add a teacher, a real teacher gets added backstage. But these two
props on stage are still just painted cardboard.

---

## Fake spot #1: the little box in the left sidebar

Look at the bottom-left of the screen, under the menu. There's a small box
that says something like:

> Setup progress **82%**
> 6 of 7 steps completed

No matter what you actually do in the app — add ten teachers, delete
everything, whatever — this box **always** says 82% and "6 of 7." It never
changes. It's like a fitness watch that's frozen showing yesterday's step
count forever, even though you're still walking around today.

(Fun fact: right above the timetable grid, on the Dashboard page itself,
there's a similar-looking box — and *that one* I already fixed. It counts
your real teachers, real subjects, etc. So there are now two "setup
progress" boxes in the app: one real, one still fake. Confusing, I know.)

Also in that same top bar, there's a little circle with the letters **"GA"**
and the name **"Grace Admin"** next to it, like it's telling you who's
logged in. That's not you. It's a placeholder name that got typed in once
and never replaced with whoever is actually signed in right now.

## Fake spot #2: the "School settings" page

If you click **Settings** in the sidebar, you'll see a form: school name,
address, phone number, and so on. The boxes are already filled in with
things like "Excellence Bilingual Academy" and a Douala address — none of
which is your school's real information, it's just leftover sample text.

There's also a **"Save changes"** button. If you click it, you'll see a
little "Saved!" message pop up. But nothing was actually saved anywhere.
It's like a light switch that's not wired to any light: you can flip it,
it clicks, but no light turns on. Whatever you typed disappears the moment
you leave the page.

---

## What fixing them actually meant

- The sidebar box now shows the real percentage and real "X of 7 steps"
  count — the same math the Dashboard's own banner uses, shared from one
  place (`lib/setup-progress.ts`) so the two never disagree.
- The name badge now shows whoever is actually logged in (pulled from
  their real profile), with their real role underneath instead of "School
  Administrator."
- The Settings page now loads your school's real saved details when you
  open it, and "Save changes" actually writes to the database — refresh
  the page and your changes are still there.
- The logo upload button is honest about not being finished yet: it tells
  you so instead of silently doing nothing.
