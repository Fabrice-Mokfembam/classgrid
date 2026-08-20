import { createClient } from "@/lib/supabase/server";
import { solve } from "@/lib/generation/solver";
import type { PlacedLesson, SolverAssignment, SolverInput } from "@/lib/generation/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Body = { schoolId?: string; academicYearId?: string; timetableId?: string };

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Body;
  const { schoolId, academicYearId, timetableId } = body;
  if (!schoolId || !academicYearId) return NextResponse.json({ error: "schoolId and academicYearId are required" }, { status: 400 });

  // Regenerate-in-place: verify the given timetable belongs to this school/year before touching it.
  if (timetableId) {
    const { data: existing } = await supabase.from("timetables").select("id").eq("id", timetableId).eq("school_id", schoolId).eq("academic_year_id", academicYearId).maybeSingle();
    if (!existing) return NextResponse.json({ error: "Timetable not found" }, { status: 404 });
  }

  const [assignmentsRes, availabilityRes, daysRes, periodsRes, teachersRes, classSectionsRes, levelSubjectsRes] = await Promise.all([
    supabase.from("teaching_assignments").select("id, teacher_id, subject_id, class_section_id, periods_per_week, pattern, double_period_count, max_per_day, prefer_morning")
      .eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("status", "active"),
    supabase.from("teacher_availability").select("teacher_id, working_day_id, period_slot_id, is_available")
      .eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("is_available", false),
    supabase.from("working_days").select("id, sort_order").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("is_active", true),
    supabase.from("period_slots").select("id, sort_order, day_block").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("kind", "lesson"),
    supabase.from("teachers").select("id, max_periods_per_day, max_consecutive_periods").eq("school_id", schoolId).eq("status", "active"),
    supabase.from("class_sections").select("id, level_id").eq("school_id", schoolId).eq("academic_year_id", academicYearId),
    supabase.from("level_subjects").select("id, level_id, subject_id").eq("school_id", schoolId),
  ]);

  for (const res of [assignmentsRes, availabilityRes, daysRes, periodsRes, teachersRes, classSectionsRes, levelSubjectsRes]) {
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  const assignments = assignmentsRes.data ?? [];
  const days = daysRes.data ?? [];
  const periods = periodsRes.data ?? [];
  const levelSubjects = levelSubjectsRes.data ?? [];

  // Parallel-compatible subject pairs (CURRICULUM_STRUCTURE_PLAN.md): two subjects at the same
  // level may share one class's slot if their level_subjects rows share any parallel group.
  const levelSubjectIds = levelSubjects.map(ls => ls.id);
  const membershipsRes = levelSubjectIds.length
    ? await supabase.from("level_subject_parallel_groups").select("level_subject_id, parallel_group_id").in("level_subject_id", levelSubjectIds)
    : { data: [] as { level_subject_id: string; parallel_group_id: string }[], error: null };
  if (membershipsRes.error) return NextResponse.json({ error: membershipsRes.error.message }, { status: 500 });

  const groupsByLevelSubjectId = new Map<string, Set<string>>();
  (membershipsRes.data ?? []).forEach(m => {
    const set = groupsByLevelSubjectId.get(m.level_subject_id) ?? new Set<string>();
    set.add(m.parallel_group_id);
    groupsByLevelSubjectId.set(m.level_subject_id, set);
  });
  const groupsByLevelAndSubject = new Map<string, Set<string>>(); // `${levelId}|${subjectId}` -> group ids
  levelSubjects.forEach(ls => {
    const groups = groupsByLevelSubjectId.get(ls.id);
    if (groups?.size) groupsByLevelAndSubject.set(`${ls.level_id}|${ls.subject_id}`, groups);
  });
  const classSectionLevelId = new Map((classSectionsRes.data ?? []).map(cs => [cs.id, cs.level_id] as const));

  const parallelSubjectPairs = new Set<string>();
  const assignmentsByClass = new Map<string, typeof assignments>();
  assignments.forEach(a => {
    const list = assignmentsByClass.get(a.class_section_id) ?? [];
    list.push(a);
    assignmentsByClass.set(a.class_section_id, list);
  });
  assignmentsByClass.forEach((list, classSectionId) => {
    const levelId = classSectionLevelId.get(classSectionId);
    if (!levelId) return;
    const subjects = [...new Set(list.map(a => a.subject_id))];
    for (let i = 0; i < subjects.length; i++) {
      for (let j = i + 1; j < subjects.length; j++) {
        const groupsA = groupsByLevelAndSubject.get(`${levelId}|${subjects[i]}`);
        const groupsB = groupsByLevelAndSubject.get(`${levelId}|${subjects[j]}`);
        const shareGroup = groupsA && groupsB && [...groupsA].some(g => groupsB.has(g));
        if (shareGroup) {
          const [x, y] = [subjects[i], subjects[j]].sort();
          parallelSubjectPairs.add(`${classSectionId}|${x}|${y}`);
        }
      }
    }
  });

  if (days.length === 0) return NextResponse.json({ error: "No active teaching days configured. Set up your school schedule first." }, { status: 400 });
  if (periods.length === 0) return NextResponse.json({ error: "No lesson periods configured. Set up your school schedule first." }, { status: 400 });
  if (assignments.length === 0) return NextResponse.json({ error: "No teaching assignments to schedule. Add teaching assignments first." }, { status: 400 });

  const solverAssignments: SolverAssignment[] = assignments.map(a => ({
    id: a.id, teacherId: a.teacher_id, subjectId: a.subject_id, classSectionId: a.class_section_id,
    periodsPerWeek: a.periods_per_week, pattern: a.pattern, doublePeriodCount: a.double_period_count,
    maxPerDay: a.max_per_day, preferMorning: a.prefer_morning,
  }));

  const teacherMaxPeriodsPerDay = new Map((teachersRes.data ?? []).map(t => [t.id, t.max_periods_per_day] as const));
  const teacherMaxConsecutive = new Map((teachersRes.data ?? []).map(t => [t.id, t.max_consecutive_periods ?? 4] as const));
  const unavailable = new Set((availabilityRes.data ?? []).map(row => `${row.teacher_id}|${row.working_day_id}|${row.period_slot_id}`));
  const totalRequired = assignments.reduce((sum, a) => sum + a.periods_per_week, 0);

  let targetTimetableId: string;
  let lockedCount = 0;
  let preplaced: PlacedLesson[] = [];

  if (timetableId) {
    // Regenerate-in-place: keep locked entries, work around them, replace the rest.
    const { data: existingEntries, error: entriesError } = await supabase.from("timetable_entries")
      .select("id, assignment_id, teacher_id, subject_id, class_section_id, working_day_id, period_slot_id, is_locked")
      .eq("timetable_id", timetableId);
    if (entriesError) return NextResponse.json({ error: entriesError.message }, { status: 500 });

    const locked = (existingEntries ?? []).filter(e => e.is_locked && e.assignment_id);
    lockedCount = locked.length;
    preplaced = locked.map(e => ({ assignmentId: e.assignment_id as string, teacherId: e.teacher_id, subjectId: e.subject_id, classSectionId: e.class_section_id, dayId: e.working_day_id, periodId: e.period_slot_id }));

    const { error: deleteError } = await supabase.from("timetable_entries").delete().eq("timetable_id", timetableId).eq("is_locked", false);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

    targetTimetableId = timetableId;
  } else {
    const { data: existingTimetables } = await supabase.from("timetables").select("version").eq("school_id", schoolId).eq("academic_year_id", academicYearId).order("version", { ascending: false }).limit(1);
    const nextVersion = (existingTimetables?.[0]?.version ?? 0) + 1;

    const { data: timetable, error: timetableError } = await supabase.from("timetables")
      .insert({ school_id: schoolId, academic_year_id: academicYearId, name: `Version ${nextVersion}`, version: nextVersion, status: "draft", created_by: user.id })
      .select("id").single();
    if (timetableError || !timetable) return NextResponse.json({ error: timetableError?.message ?? "Failed to create timetable" }, { status: 500 });
    targetTimetableId = timetable.id;
  }

  const solverInput: SolverInput = {
    days: days.map(d => ({ id: d.id, sortOrder: d.sort_order })),
    periods: periods.map(p => ({ id: p.id, sortOrder: p.sort_order, dayBlock: p.day_block as "morning" | "afternoon" | null })),
    assignments: solverAssignments,
    teacherMaxPeriodsPerDay, teacherMaxConsecutive, unavailable, preplaced, parallelSubjectPairs,
  };

  const { data: run, error: runError } = await supabase.from("generation_runs")
    .insert({ school_id: schoolId, academic_year_id: academicYearId, timetable_id: targetTimetableId, status: "running", started_at: new Date().toISOString(), created_by: user.id })
    .select("id").single();
  if (runError || !run) return NextResponse.json({ error: runError?.message ?? "Failed to create generation run" }, { status: 500 });

  let result;
  try {
    result = solve(solverInput);
  } catch (error) {
    await supabase.from("generation_runs").update({ status: "failed", error_message: error instanceof Error ? error.message : "Unknown error", completed_at: new Date().toISOString() }).eq("id", run.id);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }

  const entryRows = result.placed.map(p => ({
    school_id: schoolId, timetable_id: targetTimetableId, assignment_id: p.assignmentId, teacher_id: p.teacherId,
    subject_id: p.subjectId, class_section_id: p.classSectionId, working_day_id: p.dayId, period_slot_id: p.periodId, duration_slots: 1,
  }));
  for (const batch of chunk(entryRows, 500)) {
    const { error } = await supabase.from("timetable_entries").insert(batch);
    if (error) {
      await supabase.from("generation_runs").update({ status: "failed", error_message: error.message, completed_at: new Date().toISOString() }).eq("id", run.id);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const issueRows = [
    ...result.unscheduled.map(u => ({
      school_id: schoolId, generation_run_id: run.id, severity: "hard" as const, code: "unscheduled_lesson",
      title: "Could not schedule all periods", explanation: `${u.missingPeriods} period(s) for this assignment could not be placed without a conflict. Check the teacher's availability or reduce periods per week.`,
      context: { assignmentId: u.assignmentId, teacherId: u.teacherId, subjectId: u.subjectId, classSectionId: u.classSectionId, missingPeriods: u.missingPeriods },
    })),
    ...result.softWarnings.map(w => ({
      school_id: schoolId, generation_run_id: run.id, severity: "soft" as const, code: w.code,
      title: "Morning preference not fully honored", explanation: `${w.count} period(s) for this assignment could not be placed in the morning as preferred.`,
      context: { assignmentId: w.assignmentId, count: w.count },
    })),
  ];
  if (issueRows.length > 0) {
    const { error } = await supabase.from("constraint_issues").insert(issueRows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const scheduled = lockedCount + result.placed.length;
  const qualityScore = totalRequired === 0 ? 100 : Math.max(0, Math.round((scheduled / totalRequired) * 100) - result.softWarnings.length);

  await supabase.from("generation_runs").update({ status: "completed", progress: 100, completed_at: new Date().toISOString() }).eq("id", run.id);
  await supabase.from("timetables").update({ quality_score: qualityScore, status: "draft", published_at: null, published_by: null }).eq("id", targetTimetableId);

  return NextResponse.json({
    timetableId: targetTimetableId, generationRunId: run.id, scheduled, totalRequired,
    hardConflicts: result.unscheduled.length, softWarnings: result.softWarnings.length, qualityScore, timedOut: result.timedOut,
  });
}
