# ClassGrid MVP

ClassGrid is a school timetable management application built with Next.js, TypeScript, and Supabase. School administrators can configure their academic structure, generate a timetable, adjust it, validate it, publish it, and export it as a PDF.

The application uses live Supabase data. The files in `lib/demo-data.ts` are legacy reference data and are not used by the current UI.

## Current features

- Email and password authentication with email confirmation
- Four-step school registration and automatic workspace creation
- School and academic-year context
- Setup guide with progress tracking
- Teaching days, lesson periods, and breaks
- Levels and class sections
- Subjects per level, weekly period requirements, and parallel subject groups
- Subject, teacher, and teaching-assignment management
- Teacher availability grid
- Server-side timetable generation
- Teacher, class, and master timetable views
- Drag-and-drop lesson movement and swapping
- Lesson locking and regeneration of unlocked lessons
- Validation of required periods against scheduled periods
- Timetable publishing with published date and user tracking
- PDF export with the school name and logo
- School profile and Supabase Storage logo upload
- Search on subjects, teachers, classes, and teaching assignments
- Row Level Security for school-owned data

## Main workflow

For the best generation result, configure a school in this order:

1. Complete the school profile and academic year.
2. Set the teaching days, lesson periods, and breaks.
3. Create levels and their class sections.
4. Create subjects.
5. Use **Manage subjects** on each level to set which subjects are taught and how many periods they require each week.
6. Add teachers and the subjects they teach.
7. Mark teacher availability.
8. Create teaching assignments connecting a teacher, subject, and class.
9. Generate the timetable.
10. Review, move, lock, regenerate, and validate lessons.
11. Publish the approved timetable and export it as a PDF.

The public guide is available at `/guide`. Signed-in users can also open **Setup guide** from the sidebar.

## Technology

- Next.js 15 and React 19
- TypeScript
- Supabase Auth, Postgres, Row Level Security, and Storage
- `@dnd-kit` for timetable drag and drop
- jsPDF and jsPDF-AutoTable for PDF export
- Vitest for solver tests
- Sonner and Lucide React for interface feedback and icons

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local`.

PowerShell:

```powershell
Copy-Item .env.example .env.local
```

macOS or Linux:

```bash
cp .env.example .env.local
```

Set these required values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Older Supabase projects can use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead of `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

`SUPABASE_SERVICE_ROLE_KEY` is included in `.env.example` for future privileged server jobs, but the current application does not require it. Never expose or commit that key.

### 3. Apply the Supabase database

The recommended method is the Supabase CLI because it applies every migration in order and keeps future changes versioned.

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

The migrations create the application tables, helper functions, onboarding transaction, indexes, RLS policies, timetable-entry swap function, parallel subject groups, and the `school-logos` Storage bucket.

For a brand-new project where the CLI cannot be used, `supabase/schema.sql` is the current full-schema snapshot and can be run once in the Supabase SQL Editor. Use either the migrations or the full snapshot for initial setup, not both.

### 4. Configure Supabase Auth

In **Authentication > URL Configuration**, set:

- Site URL: `http://localhost:3000` for local development, or the deployed application URL
- Redirect URL: `http://localhost:3000/auth/callback`

Keep email and password authentication enabled. When email confirmation is enabled, a school workspace is created after the administrator follows the confirmation link.

### 5. Start the application

```bash
npm run dev
```

Open `http://localhost:3000`.

## Useful commands

```bash
npm run dev        # Start the development server
npm run typecheck  # Check TypeScript
npm test           # Run the timetable solver tests
npm run test:watch # Run tests in watch mode
npm run build      # Create a production build
npm start          # Run the production build
```

## Timetable generation

Generation runs through `POST /api/generate` and uses the TypeScript solver in `lib/generation/solver.ts`. It reads active assignments, working days, lesson periods, teacher availability, class levels, and parallel-subject configuration from Supabase.

The solver currently enforces:

- No teacher can teach two classes in the same slot.
- A class cannot receive incompatible lessons in the same slot.
- Teacher unavailability is respected.
- Assignment and teacher daily limits are respected.
- Teacher consecutive-period limits are respected.
- Double lessons use consecutive lesson slots.
- Locked timetable entries remain fixed during regeneration.
- Subjects in the same configured parallel group can share a class slot.

If every required lesson cannot be placed, generation still saves the valid placements and reports the missing periods as hard conflicts. The timetable validation action also compares every assignment's required weekly periods with its actual scheduled count.

## Publishing behavior

Publishing marks the selected timetable as `published`, records `published_at` and `published_by`, and archives any previously published timetable for the same school and academic year. Regenerating a timetable returns it to `draft` status because its contents have changed.

## School logos

School logos are stored in the public `school-logos` Supabase Storage bucket. Uploads accept PNG, JPG, or WebP files up to 2 MB. Storage policies restrict uploads, updates, and deletion to users who can manage the matching school.

The saved school logo is used in the workspace header, sidebar school selector, timetable heading, and exported timetable PDF. ClassGrid's product logo remains the fallback and is also used for the favicon and loading screen.

## Security model

Every school-owned record includes a `school_id`. Row Level Security checks school membership for reads and the appropriate management role for writes. Server routes use the signed-in user's Supabase session, so RLS remains active during generation.

Do not disable RLS in production and never place the Supabase service-role key in browser code.

## Known MVP limitations

- Password recovery and the **Remember me** control are not implemented yet.
- Generation runs in a Next.js server request rather than a background job queue.
- Subscription billing is not implemented.
- Teacher self-service access and notifications are not implemented.

