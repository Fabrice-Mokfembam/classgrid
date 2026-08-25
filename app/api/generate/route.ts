import { createClient } from "@/lib/supabase/server";
import { solve } from "@/lib/generation/solver";
import type { PlacedLesson, SolverAssignment, SolverInput } from "@/lib/generation/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Body = { schoolId?: string; academicYearId?: string; timetableId?: string; classSectionId?: string };

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Body;
  const { schoolId, academicYearId, timetableId, classSectionId } = body;
  if (!schoolId || !academicYearId) return NextResponse.json({ error: "schoolId and academicYearId are required" }, { status: 400 });
  if (classSectionId && !timetableId) return NextResponse.json({ error: "A timetable is required to repair one class" }, { status: 400 });

  // Regenerate-in-place: verify the given timetable belongs to this school/year before touching it.
  if (timetableId) {
    const { data: existing } = await supabase.from("timetables").select("id").eq("id", timetableId).eq("school_id", schoolId).eq("academic_year_id", academicYearId).maybeSingle();
    if (!existing) return NextResponse.json({ error: "Timetable not found" }, { status: 404 });
  }

  const [assignmentsRes, availabilityRes, daysRes, periodsRes, teachersRes, subjectsRes, classSectionsRes, levelSubjectsRes] = await Promise.all([
    supabase.from("teaching_assignments").select("id, teacher_id, subject_id, class_section_id, periods_per_week, pattern, double_period_count, max_per_day, prefer_morning, status")
      .eq("school_id", schoolId).eq("academic_year_id", academicYearId),
    supabase.from("teacher_availability").select("teacher_id, working_day_id, period_slot_id, is_available")
      .eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("is_available", false),
    supabase.from("working_days").select("id, sort_order").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("is_active", true),
    supabase.from("period_slots").select("id, sort_order, day_block").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("kind", "lesson"),
    supabase.from("teachers").select("id, max_periods_per_day, max_consecutive_periods").eq("school_id", schoolId).eq("status", "active"),
    supabase.from("subjects").select("id").eq("school_id", schoolId).eq("status", "active"),
    supabase.from("class_sections").select("id, level_id").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("status", "active"),
    supabase.from("level_subjects").select("id, level_id, subject_id, periods_per_week").eq("school_id", schoolId),
  ]);

  for (const res of [assignmentsRes, availabilityRes, daysRes, periodsRes, teachersRes, subjectsRes, classSectionsRes, levelSubjectsRes]) {
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  const allAssignments = assignmentsRes.data ?? [];
  const days = daysRes.data ?? [];
  const periods = periodsRes.data ?? [];
  const levelSubjects = levelSubjectsRes.data ?? [];
  const activeTeacherIds = new Set((teachersRes.data ?? []).map(teacher => teacher.id));
  const activeSubjectIds = new Set((subjectsRes.data ?? []).map(subject => subject.id));
  const classSectionLevelId = new Map((classSectionsRes.data ?? []).map(classSection => [classSection.id, classSection.level_id] as const));
  const periodsByLevelAndSubject = new Map(levelSubjects.map(levelSubject => [
    `${levelSubject.level_id}|${levelSubject.subject_id}`,
    levelSubject.periods_per_week,
  ] as const));
  const assignments = allAssignments.flatMap(assignment => {
    const levelId = classSectionLevelId.get(assignment.class_section_id);
    const configuredPeriods = levelId ? periodsByLevelAndSubject.get(`${levelId}|${assignment.subject_id}`) : undefined;
    if (assignment.status !== "active" || !activeTeacherIds.has(assignment.teacher_id) || !activeSubjectIds.has(assignment.subject_id) || configuredPeriods == null) return [];
    return [{ ...assignment, periods_per_week: configuredPeriods }];
  });
  if (classSectionId && !assignments.some(assignment => assignment.class_section_id === classSectionId)) {
    const selectedClassExists = classSectionLevelId.has(classSectionId);
    return NextResponse.json({ error: selectedClassExists ? "This class has no active teaching assignments to repair" : "Class not found" }, { status: 400 });
  }

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
  if (assignments.length === 0 && !timetableId) return NextResponse.json({ error: "No teaching assignments to schedule. Add teaching assignments first." }, { status: 400 });

  const teacherMaxPeriodsPerDay = new Map((teachersRes.data ?? []).map(t => [t.id, t.max_periods_per_day] as const));
  const teacherMaxConsecutive = new Map((teachersRes.data ?? []).map(t => [t.id, t.max_consecutive_periods ?? 4] as const));
  const unavailable = new Set((availabilityRes.data ?? []).map(row => `${row.teacher_id}|${row.working_day_id}|${row.period_slot_id}`));
  const totalRequired = assignments.reduce((sum, a) => sum + a.periods_per_week, 0);

  let fixedCount = 0;
  let preplaced: PlacedLesson[] = [];

  if (timetableId) {
    // Regenerate-in-place: keep locked entries, work around them, replace the rest.
    const { data: existingEntries, error: entriesError } = await supabase.from("timetable_entries")
      .select("id, assignment_id, teacher_id, subject_id, class_section_id, working_day_id, period_slot_id, is_locked")
      .eq("timetable_id", timetableId);
    if (entriesError) return NextResponse.json({ error: entriesError.message }, { status: 500 });

    const fixedEntries = (existingEntries ?? []).filter(e => e.assignment_id && (
      classSectionId ? e.class_section_id !== classSectionId || e.is_locked : e.is_locked
    ));
    fixedCount = fixedEntries.length;
    preplaced = fixedEntries.map(e => ({ assignmentId: e.assignment_id as string, teacherId: e.teacher_id, subjectId: e.subject_id, classSectionId: e.class_section_id, dayId: e.working_day_id, periodId: e.period_slot_id }));

  }

  // Locked lessons remain fixed even when their teacher, subject, class, or assignment
  // has since been deactivated. Include those assignments only as zero-remaining-work
  // blockers so newly generated lessons still avoid their occupied slots.
  const assignmentsToSchedule = classSectionId
    ? assignments.filter(assignment => assignment.class_section_id === classSectionId)
    : assignments;
  const activeAssignmentIds = new Set(assignmentsToSchedule.map(assignment => assignment.id));
  const fixedByAssignment = new Map<string, number>();
  preplaced.forEach(lesson => fixedByAssignment.set(lesson.assignmentId, (fixedByAssignment.get(lesson.assignmentId) ?? 0) + 1));
  const blockerAssignments = allAssignments.filter(assignment => !activeAssignmentIds.has(assignment.id) && fixedByAssignment.has(assignment.id));
  const solverAssignments: SolverAssignment[] = [...assignmentsToSchedule, ...blockerAssignments].map(assignment => ({
    id: assignment.id,
    teacherId: assignment.teacher_id,
    subjectId: assignment.subject_id,
    classSectionId: assignment.class_section_id,
    periodsPerWeek: activeAssignmentIds.has(assignment.id) ? assignment.periods_per_week : fixedByAssignment.get(assignment.id) ?? 0,
    pattern: assignment.pattern,
    doublePeriodCount: assignment.double_period_count,
    maxPerDay: assignment.max_per_day,
    preferMorning: assignment.prefer_morning,
  }));

  const solverInput: SolverInput = {
    days: days.map(d => ({ id: d.id, sortOrder: d.sort_order })),
    periods: periods.map(p => ({ id: p.id, sortOrder: p.sort_order, dayBlock: p.day_block as "morning" | "afternoon" | null })),
    assignments: solverAssignments,
    teacherMaxPeriodsPerDay, teacherMaxConsecutive, unavailable, preplaced, parallelSubjectPairs,
    coverageFirst: Boolean(classSectionId),
  };

  let result;
  try {
    result = solve(solverInput);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Generation failed" }, { status: 500 });
  }

  const entryRows = result.placed.map(p => ({
    assignment_id: p.assignmentId, teacher_id: p.teacherId, subject_id: p.subjectId,
    class_section_id: p.classSectionId, working_day_id: p.dayId, period_slot_id: p.periodId,
  }));
  const generatedIssues = [
    ...result.unscheduled.map(u => ({
      severity: "hard" as const, code: "unscheduled_lesson",
      title: "Could not schedule all periods", explanation: `${u.missingPeriods} period(s) for this assignment could not be placed without a conflict. Check the teacher's availability or reduce periods per week.`,
      context: { assignmentId: u.assignmentId, teacherId: u.teacherId, subjectId: u.subjectId, classSectionId: u.classSectionId, missingPeriods: u.missingPeriods },
    })),
    ...result.softWarnings.map(w => ({
      severity: "soft" as const, code: w.code,
      title: "Morning preference not fully honored", explanation: `${w.count} period(s) for this assignment could not be placed in the morning as preferred.`,
      context: { assignmentId: w.assignmentId, count: w.count },
    })),
  ];

  const scheduled = fixedCount + result.placed.length;
  const qualityScore = totalRequired === 0 ? 100 : Math.min(100, Math.max(0, Math.round((scheduled / totalRequired) * 100) - result.softWarnings.length));

  if (!timetableId) {
    const { data, error } = await supabase.rpc("create_generated_timetable", {
      p_school_id: schoolId,
      p_academic_year_id: academicYearId,
      p_entries: entryRows,
      p_issues: generatedIssues,
      p_quality_score: qualityScore,
    }).single();
    const created = data as { timetable_id: string; generation_run_id: string } | null;
    if (error || !created) return NextResponse.json({ error: error?.message ?? "Failed to save generated timetable" }, { status: 500 });

    return NextResponse.json({
      timetableId: created.timetable_id, generationRunId: created.generation_run_id, scheduled, totalRequired,
      hardConflicts: result.unscheduled.length, softWarnings: result.softWarnings.length, qualityScore, timedOut: result.timedOut,
    });
  }

  if (classSectionId) {
    const { data, error } = await supabase.rpc("complete_class_timetable_repair", {
      p_timetable_id: timetableId,
      p_class_section_id: classSectionId,
      p_entries: entryRows,
      p_issues: generatedIssues,
      p_quality_score: qualityScore,
    });
    const generationRunId = data as string | null;
    if (error || !generationRunId) return NextResponse.json({ error: error?.message ?? "Failed to save class repair" }, { status: 500 });

    const classRequired = assignmentsToSchedule.reduce((sum, assignment) => sum + assignment.periods_per_week, 0);
    const classLocked = preplaced.filter(lesson => lesson.classSectionId === classSectionId).length;
    const classScheduled = classLocked + result.placed.length;
    const subjectsCovered = new Set([
      ...preplaced.filter(lesson => lesson.classSectionId === classSectionId).map(lesson => lesson.subjectId),
      ...result.placed.map(lesson => lesson.subjectId),
    ]).size;
    const subjectsRequired = new Set(assignmentsToSchedule.map(assignment => assignment.subject_id)).size;

    return NextResponse.json({
      timetableId, generationRunId, scheduled, totalRequired, classScheduled, classRequired,
      subjectsCovered, subjectsRequired, hardConflicts: result.unscheduled.length,
      softWarnings: result.softWarnings.length, qualityScore, timedOut: result.timedOut,
    });
  }

  const { data, error } = await supabase.rpc("complete_timetable_regeneration", {
    p_timetable_id: timetableId,
    p_entries: entryRows,
    p_issues: generatedIssues,
    p_quality_score: qualityScore,
  });
  const generationRunId = data as string | null;
  if (error || !generationRunId) return NextResponse.json({ error: error?.message ?? "Failed to save regenerated timetable" }, { status: 500 });

  return NextResponse.json({
    timetableId, generationRunId, scheduled, totalRequired,
    hardConflicts: result.unscheduled.length, softWarnings: result.softWarnings.length, qualityScore, timedOut: result.timedOut,
  });
}
