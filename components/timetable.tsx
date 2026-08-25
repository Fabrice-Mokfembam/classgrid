"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeftRight, CalendarDays, ChartNoAxesColumn, CheckCircle2, Download, GitMerge, LockKeyhole, RefreshCw, ShieldCheck, Sparkles, UnlockKeyhole, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useSchool } from "@/lib/school-context";
import { DEFAULT_LOGO_URL } from "@/lib/branding";
import type { PeriodSlot, TimetableEntry, WorkingDay } from "@/lib/types";
import { ErrorState, GridSkeleton, Skel } from "@/components/shared";

type ValidationIssue = {
  id: string;
  title: string;
  text: string;
};

type ClassCoverageRow = {
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  teacherNames: string[];
  scheduled: number;
  required: number;
};

type PendingDrop = {
  dragged: TimetableEntry;
  target: TimetableEntry;
  dayId: string;
  periodId: string;
};

export function Timetable() {
  const { schoolId, academicYearId, schoolName, schoolLogoUrl, academicYearName, loading: schoolLoading } = useSchool();
  const [loading, setLoading] = useState(true);
  const [workingDays, setWorkingDays] = useState<WorkingDay[]>([]);
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>([]);
  const [classOptions, setClassOptions] = useState<{ id: string; name: string }[]>([]);
  const [teacherOptions, setTeacherOptions] = useState<{ id: string; name: string }[]>([]);
  const [classSectionId, setClassSectionId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [view, setView] = useState<"class" | "teacher" | "master">("class");
  const [timetableInfo, setTimetableInfo] = useState<{ id: string; version: number; status: string; qualityScore: number | null; publishedAt: string | null; publishedBy: string | null } | null>(null);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [selected, setSelected] = useState<TimetableEntry | null>(null);
  const [dragged, setDragged] = useState<TimetableEntry | null>(null);
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);
  const [dropAction, setDropAction] = useState<"swap" | "parallel" | null>(null);
  const [changingTeacher, setChangingTeacher] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [repairingClass, setRepairingClass] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationChecked, setValidationChecked] = useState(false);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [coverageRows, setCoverageRows] = useState<ClassCoverageRow[]>([]);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !schoolId || !academicYearId) { setLoading(false); return; }
    setLoading(true); setLoadError(null);
    const [daysRes, slotsRes, classesRes, teachersRes, timetableRes] = await Promise.all([
      supabase.from("working_days").select("id, name, sort_order").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("is_active", true).order("sort_order"),
      supabase.from("period_slots").select("id, name, period_number, start_time, end_time").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("kind", "lesson").order("sort_order"),
      supabase.from("class_sections").select("id, name").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("status", "active").order("name"),
      supabase.from("teachers").select("id, full_name").eq("school_id", schoolId).eq("status", "active").order("full_name"),
      supabase.from("timetables").select("id, version, status, quality_score, published_at, published_by").eq("school_id", schoolId).eq("academic_year_id", academicYearId).order("version", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const err = daysRes.error?.message ?? slotsRes.error?.message ?? classesRes.error?.message ?? teachersRes.error?.message ?? timetableRes.error?.message ?? null;
    if (err) { setLoadError(err); setLoading(false); return; }
    setWorkingDays((daysRes.data ?? []).map((d): WorkingDay => ({ id: d.id, name: d.name, sortOrder: d.sort_order })));
    setPeriodSlots((slotsRes.data ?? []).map((p): PeriodSlot => ({ id: p.id, name: p.name, periodNumber: p.period_number, startTime: p.start_time, endTime: p.end_time })));
    setClassOptions(classesRes.data ?? []);
    setTeacherOptions((teachersRes.data ?? []).map(t => ({ id: t.id, name: t.full_name })));
    setTimetableInfo(timetableRes.data ? { id: timetableRes.data.id, version: timetableRes.data.version, status: timetableRes.data.status, qualityScore: timetableRes.data.quality_score, publishedAt: timetableRes.data.published_at, publishedBy: timetableRes.data.published_by } : null);
    setLoading(false);
  }, [schoolId, academicYearId]);

  useEffect(() => { if (!schoolLoading) load(); }, [schoolLoading, load]);
  useEffect(() => { if (!classSectionId && classOptions.length) setClassSectionId(classOptions[0].id); }, [classOptions, classSectionId]);
  useEffect(() => { if (!teacherId && teacherOptions.length) setTeacherId(teacherOptions[0].id); }, [teacherOptions, teacherId]);

  const loadEntries = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !timetableInfo) { setEntries([]); return; }
    if (view === "class" && !classSectionId) { setEntries([]); return; }
    if (view === "teacher" && !teacherId) { setEntries([]); return; }
    setEntriesError(null); setEntriesLoading(true);
    let query = supabase.from("timetable_entries")
      .select("id, subject_id, teacher_id, working_day_id, period_slot_id, is_locked, subjects(name, color), teachers(full_name), class_sections(name)")
      .eq("timetable_id", timetableInfo.id);
    if (view === "class") query = query.eq("class_section_id", classSectionId);
    if (view === "teacher") query = query.eq("teacher_id", teacherId);
    const { data, error } = await query;
    if (error) { setEntriesError(error.message); setEntriesLoading(false); return; }
    setEntries((data ?? []).map((e): TimetableEntry => {
      const subject = Array.isArray(e.subjects) ? e.subjects[0] : e.subjects;
      const teacher = Array.isArray(e.teachers) ? e.teachers[0] : e.teachers;
      const classRow = Array.isArray(e.class_sections) ? e.class_sections[0] : e.class_sections;
      return { id: e.id, subjectId: e.subject_id, teacherId: e.teacher_id, dayId: e.working_day_id, periodSlotId: e.period_slot_id, isLocked: e.is_locked, subjectName: (subject as { name: string } | null)?.name ?? "—", subjectColor: (subject as { color: string } | null)?.color ?? "#3b82f6", teacherName: (teacher as { full_name: string } | null)?.full_name ?? "—", className: (classRow as { name: string } | null)?.name ?? "—" };
    }));
    setSelected(null);
    setValidationChecked(false);
    setEntriesLoading(false);
  }, [timetableInfo, view, classSectionId, teacherId]);

  useEffect(() => { loadEntries(); }, [loadEntries]);
  useEffect(() => { setCoverageOpen(false); }, [classSectionId, view, timetableInfo?.id]);

  const cells = useMemo(() => {
    const map = new Map<string, TimetableEntry[]>();
    for (const e of entries) {
      const key = `${e.dayId}-${e.periodSlotId}`;
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return map;
  }, [entries]);

  async function toggleLock() {
    if (!selected) return;
    const next = !selected.isLocked;
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.from("timetable_entries").update({ is_locked: next }).eq("id", selected.id);
    if (error) { toast.error(error.message); return; }
    setEntries(list => list.map(e => e.id === selected.id ? { ...e, isLocked: next } : e));
    setSelected(s => s ? { ...s, isLocked: next } : s);
    toast.success(next ? "Lesson locked" : "Lesson unlocked");
  }

  async function changeSelectedTeacher(nextTeacherId: string) {
    if (!selected || nextTeacherId === selected.teacherId) return;
    const supabase = createClient();
    if (!supabase) return;

    setChangingTeacher(true);
    const { error } = await supabase.rpc("change_timetable_entry_teacher", {
      p_entry_id: selected.id,
      p_teacher_id: nextTeacherId,
    });
    setChangingTeacher(false);
    if (error) { toast.error(error.message); return; }

    const teacherName = teacherOptions.find(teacher => teacher.id === nextTeacherId)?.name ?? "Selected teacher";
    const updated = { ...selected, teacherId: nextTeacherId, teacherName };
    setSelected(updated);
    setTimetableInfo(info => info ? { ...info, status: "draft", publishedAt: null, publishedBy: null } : info);
    setValidationChecked(false);
    if (view === "teacher") await loadEntries();
    else setEntries(list => list.map(entry => entry.id === selected.id ? updated : entry));
    toast.success(`${teacherName} will teach this ${selected.subjectName} period`);
  }

  async function handleDrop(dayId: string, periodId: string) {
    if (!dragged) return;
    const dragSnapshot = dragged;
    setDragged(null);
    const destEntries = cells.get(`${dayId}-${periodId}`) ?? [];
    if (destEntries.some(x => x.id === dragSnapshot.id)) return;
    if (destEntries.length > 1) { toast.error("This slot already has two parallel lessons — move one of them out first"); return; }
    const target = destEntries[0];
    if (target) {
      setPendingDrop({ dragged: dragSnapshot, target, dayId, periodId });
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.rpc("move_timetable_entry", { p_entry_id: dragSnapshot.id, p_working_day_id: dayId, p_period_slot_id: periodId });
    if (error) { toast.error(error.code === "23505" ? "That slot conflicts with an existing lesson for this teacher or class" : error.message); return; }
    toast.success("Lesson moved");
    setTimetableInfo(info => info ? { ...info, status: "draft", publishedAt: null, publishedBy: null } : info);
    setValidationChecked(false);
    loadEntries();
  }

  async function completeOccupiedDrop(action: "swap" | "parallel") {
    if (!pendingDrop) return;
    const supabase = createClient();
    if (!supabase) return;

    setDropAction(action);
    const { dragged: source, target } = pendingDrop;
    const { error } = action === "swap"
      ? await supabase.rpc("swap_timetable_entries", { p_entry_a: source.id, p_entry_b: target.id })
      : await supabase.rpc("make_timetable_entries_parallel", { p_dragged_entry_id: source.id, p_target_entry_id: target.id });
    setDropAction(null);

    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("unavailable")) toast.error(error.message);
      else if (message.includes("locked")) toast.error("The locked lesson cannot be swapped. You can still make the subjects parallel.");
      else if (error.code === "23505" || message.includes("conflict")) toast.error("That placement conflicts with another lesson for this teacher or class");
      else toast.error(error.message);
      return;
    }

    setPendingDrop(null);
    setTimetableInfo(info => info ? { ...info, status: "draft", publishedAt: null, publishedBy: null } : info);
    setValidationChecked(false);
    toast.success(action === "swap" ? "Lessons swapped" : `${source.subjectName} and ${target.subjectName} now run in parallel`);
    loadEntries();
  }

  async function validateTimetable() {
    if (!schoolId || !academicYearId || !timetableInfo) return;
    const supabase = createClient();
    if (!supabase) return;

    setValidating(true);
    const [assignmentsRes, entriesRes] = await Promise.all([
      supabase.from("teaching_assignments")
        .select("id, periods_per_week, teachers(full_name), subjects(name), class_sections(name)")
        .eq("school_id", schoolId)
        .eq("academic_year_id", academicYearId)
        .eq("status", "active"),
      supabase.from("timetable_entries")
        .select("assignment_id")
        .eq("timetable_id", timetableInfo.id)
        .not("assignment_id", "is", null),
    ]);
    setValidating(false);

    const err = assignmentsRes.error?.message ?? entriesRes.error?.message ?? null;
    if (err) { toast.error(err); return; }

    const actualByAssignment = new Map<string, number>();
    (entriesRes.data ?? []).forEach(row => {
      if (row.assignment_id) actualByAssignment.set(row.assignment_id, (actualByAssignment.get(row.assignment_id) ?? 0) + 1);
    });

    const issues: ValidationIssue[] = (assignmentsRes.data ?? []).flatMap(assignment => {
      const expected = assignment.periods_per_week;
      const actual = actualByAssignment.get(assignment.id) ?? 0;
      if (actual === expected) return [];

      const subject = Array.isArray(assignment.subjects) ? assignment.subjects[0] : assignment.subjects;
      const teacher = Array.isArray(assignment.teachers) ? assignment.teachers[0] : assignment.teachers;
      const classSection = Array.isArray(assignment.class_sections) ? assignment.class_sections[0] : assignment.class_sections;
      const subjectName = (subject as { name: string } | null)?.name ?? "This subject";
      const teacherName = (teacher as { full_name: string } | null)?.full_name ?? "this teacher";
      const className = (classSection as { name: string } | null)?.name ?? "this class";
      const difference = Math.abs(expected - actual);
      const direction = actual < expected ? "missing" : "extra";

      return [{
        id: assignment.id,
        title: `${subjectName} has ${actual} of ${expected} required periods`,
        text: `${className} with ${teacherName} should have ${expected} period${expected === 1 ? "" : "s"} per week, but the timetable has ${actual}. It is ${direction} ${difference} period${difference === 1 ? "" : "s"}.`,
      }];
    });

    setValidationIssues(issues);
    setValidationChecked(true);
    if (issues.length === 0) toast.success("All assignment period counts are correct");
    else toast.warning(`${issues.length} assignment period issue${issues.length === 1 ? "" : "s"} found`);
  }

  async function openClassCoverage() {
    if (!timetableInfo || !classSectionId) return;
    setCoverageOpen(true);
    setCoverageLoading(true);
    setCoverageError(null);

    const supabase = createClient();
    if (!supabase) { setCoverageLoading(false); return; }
    const [assignmentsRes, entriesRes] = await Promise.all([
      supabase.from("teaching_assignments")
        .select("id, subject_id, periods_per_week, subjects(id, name, color, status), teachers(full_name, status)")
        .eq("class_section_id", classSectionId)
        .eq("status", "active"),
      supabase.from("timetable_entries")
        .select("assignment_id")
        .eq("timetable_id", timetableInfo.id)
        .eq("class_section_id", classSectionId)
        .not("assignment_id", "is", null),
    ]);
    setCoverageLoading(false);

    const error = assignmentsRes.error?.message ?? entriesRes.error?.message ?? null;
    if (error) { setCoverageError(error); return; }

    const rowsBySubject = new Map<string, ClassCoverageRow>();
    const subjectByAssignment = new Map<string, string>();
    (assignmentsRes.data ?? []).forEach(assignment => {
      const subject = Array.isArray(assignment.subjects) ? assignment.subjects[0] : assignment.subjects;
      const teacher = Array.isArray(assignment.teachers) ? assignment.teachers[0] : assignment.teachers;
      if (!subject || subject.status !== "active" || !teacher || teacher.status !== "active") return;

      subjectByAssignment.set(assignment.id, assignment.subject_id);
      const current: ClassCoverageRow = rowsBySubject.get(assignment.subject_id) ?? {
        subjectId: assignment.subject_id,
        subjectName: subject.name,
        subjectColor: subject.color,
        teacherNames: [],
        scheduled: 0,
        required: 0,
      };
      current.required += assignment.periods_per_week;
      if (!current.teacherNames.includes(teacher.full_name)) current.teacherNames.push(teacher.full_name);
      rowsBySubject.set(assignment.subject_id, current);
    });

    (entriesRes.data ?? []).forEach(entry => {
      if (!entry.assignment_id) return;
      const subjectId = subjectByAssignment.get(entry.assignment_id);
      const row = subjectId ? rowsBySubject.get(subjectId) : undefined;
      if (row) row.scheduled += 1;
    });

    setCoverageRows([...rowsBySubject.values()].sort((a, b) => a.subjectName.localeCompare(b.subjectName)));
  }

  async function regenerateUnlocked() {
    if (!schoolId || !academicYearId || !timetableInfo) return;
    if (!window.confirm("Regenerate all unlocked lessons? Locked lessons will stay in place, but every other slot may move.")) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schoolId, academicYearId, timetableId: timetableInfo.id }) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Regeneration failed"); return; }
      const summary = data;
      toast.success(summary.hardConflicts > 0 ? `${summary.scheduled} of ${summary.totalRequired} lessons scheduled — ${summary.hardConflicts} assignment(s) could not be fully placed` : `${summary.scheduled} lessons scheduled with no hard conflicts`);
      setTimetableInfo(info => info ? { ...info, status: "draft", qualityScore: summary.qualityScore, publishedAt: null, publishedBy: null } : info);
      setValidationChecked(false);
      loadEntries();
    } catch { toast.error("Regeneration failed"); }
    finally { setRegenerating(false); }
  }

  async function repairClass() {
    if (!schoolId || !academicYearId || !timetableInfo || !classSectionId) return;
    const className = classOptions.find(option => option.id === classSectionId)?.name ?? "this class";
    if (!window.confirm(`Repair ${className}? Its unlocked lessons may move, but locked lessons and every other class will stay unchanged.`)) return;

    setRepairingClass(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, academicYearId, timetableId: timetableInfo.id, classSectionId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Class repair failed"); return; }

      const coverage = `${data.subjectsCovered}/${data.subjectsRequired} subjects`;
      const periods = `${data.classScheduled}/${data.classRequired} periods`;
      if (data.hardConflicts > 0) toast.warning(`${className} repaired: ${coverage}, ${periods}. Some shortages remain.`);
      else toast.success(`${className} repaired: ${coverage}, ${periods} scheduled.`);

      setTimetableInfo(info => info ? { ...info, status: "draft", qualityScore: data.qualityScore, publishedAt: null, publishedBy: null } : info);
      setValidationChecked(false);
      await loadEntries();
      if (coverageOpen) await openClassCoverage();
    } catch {
      toast.error("Class repair failed");
    } finally {
      setRepairingClass(false);
    }
  }

  async function publishTimetable() {
    if (!timetableInfo) return;
    if (timetableInfo.status === "published") { toast.info("This timetable is already published"); return; }
    if (!validationChecked) { toast.info("Validate the timetable before publishing"); return; }
    if (validationIssues.length > 0) { toast.error("Fix all assignment period issues before publishing"); return; }
    if (!window.confirm("Publish this timetable? It will become the official timetable for this academic year.")) return;

    const supabase = createClient();
    if (!supabase) return;

    setPublishing(true);
    const { data, error } = await supabase.rpc("publish_timetable", { p_timetable_id: timetableInfo.id });
    setPublishing(false);
    if (error) { toast.error(error.message); return; }
    const publishedAt = data as string;

    setTimetableInfo(info => info ? { ...info, status: "published", publishedAt } : info);
    toast.success("Timetable published");
  }

  async function logoPngDataUrl() {
    const logoUrl = schoolLogoUrl ?? DEFAULT_LOGO_URL;
    try {
      const res = await fetch(logoUrl);
      if (!res.ok) return null;
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      return await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext("2d")?.drawImage(img, 0, 0);
          URL.revokeObjectURL(objectUrl);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error("Logo could not be loaded"));
        };
        img.src = objectUrl;
      });
    } catch {
      return null;
    }
  }

  async function downloadPdf() {
    const [{ jsPDF: JsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const subtitle = view === "master" ? "Master timetable — all classes" : view === "teacher" ? `Teacher timetable — ${teacherOptions.find(t => t.id === teacherId)?.name ?? ""}` : `Class timetable — ${classOptions.find(c => c.id === classSectionId)?.name ?? ""}`;
    const doc = new JsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const logo = await logoPngDataUrl();
    if (logo) doc.addImage(logo, "PNG", 40, 24, 34, 34);
    const textX = logo ? 86 : 40;
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(schoolName ?? "Timetable", textX, 40);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`${subtitle}${academicYearName ? ` · ${academicYearName}` : ""}`, textX, 58);
    autoTable(doc, {
      startY: 74,
      head: [["Period", ...workingDays.map(d => d.name)]],
      body: periodSlots.map(p => [`${p.name}\n${p.startTime.slice(0, 5)}–${p.endTime.slice(0, 5)}`, ...workingDays.map(d => (cells.get(`${d.id}-${p.id}`) ?? []).map(e => `${e.subjectName} · ${view === "teacher" ? e.className : e.teacherName}`).join("\n"))]),
      styles: { fontSize: 8, cellPadding: 5, valign: "middle" },
      headStyles: { fillColor: [21, 86, 216] },
      columnStyles: { 0: { fontStyle: "bold" } },
    });
    const fileSafe = `${schoolName ?? "timetable"}-${view}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    doc.save(`${fileSafe}.pdf`);
  }

  if (loadError) return <ErrorState message={loadError} onRetry={load} />;
  if (loading) return <div className="timetable-layout single"><section className="panel timetable-main">
    <div className="tt-toolbar"><div className="segmented"><button className="active">Class</button><button>Teacher</button><button>Master</button></div><span className="skeleton" style={{ width: 120, height: 40, borderRadius: 8 }} /></div>
    <div className="score-row"><Skel w="120px" /></div>
    <div className="tt-grid"><div className="tt-head">Period</div>{Array.from({ length: 5 }).map((_, i) => <div className="tt-head" key={i}><Skel w="60%" /></div>)}<GridSkeleton rows={6} cols={5} /></div>
  </section></div>;
  if (!timetableInfo) return <div className="empty-inspector"><CalendarDays /><h3>No timetable generated yet</h3><p>Head to Generate timetable to create the first draft.</p></div>;
  if (workingDays.length === 0 || periodSlots.length === 0) return <div className="empty-inspector"><CalendarDays /><h3>School schedule not configured</h3><p>Set up teaching days and lesson periods first.</p></div>;

  return <div className="timetable-layout single">
    <section className="panel timetable-main">
      <div className="tt-school-head">
        <span><img src={schoolLogoUrl ?? DEFAULT_LOGO_URL} alt={`${schoolName ?? "School"} logo`} /></span>
        <div>
          <b>{schoolName ?? "School timetable"}</b>
          <small>{view === "master" ? "Master timetable" : view === "teacher" ? `Teacher timetable · ${teacherOptions.find(t => t.id === teacherId)?.name ?? ""}` : `Class timetable · ${classOptions.find(c => c.id === classSectionId)?.name ?? ""}`}{academicYearName ? ` · ${academicYearName}` : ""}</small>
        </div>
      </div>
      <div className="tt-toolbar">
        <div className="segmented">
          <button className={view === "class" ? "active" : ""} onClick={() => setView("class")}>Class</button>
          <button className={view === "teacher" ? "active" : ""} onClick={() => setView("teacher")}>Teacher</button>
          <button className={view === "master" ? "active" : ""} onClick={() => setView("master")}>Master</button>
        </div>
        {view === "class" && <select value={classSectionId} onChange={e => setClassSectionId(e.target.value)}>{classOptions.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select>}
        {view === "class" && <button className="btn" onClick={openClassCoverage}><ChartNoAxesColumn /> Class coverage</button>}
        {view === "class" && <button className="btn" onClick={repairClass} disabled={repairingClass || regenerating}><Sparkles /> {repairingClass ? "Repairing…" : "Repair class"}</button>}
        {view === "teacher" && <select value={teacherId} onChange={e => setTeacherId(e.target.value)}>{teacherOptions.map(t => <option value={t.id} key={t.id}>{t.name}</option>)}</select>}
        <button className="btn" onClick={validateTimetable} disabled={validating}><ShieldCheck /> {validating ? "Validating…" : "Validate"}</button>
        <button className="btn" onClick={regenerateUnlocked} disabled={regenerating || repairingClass}><RefreshCw /> {regenerating ? "Regenerating…" : "Regenerate unlocked"}</button>
        {selected && <button className="btn" onClick={toggleLock} title={selected.isLocked ? "Locked — click to unlock." : "Unlocked — click to lock."}>
          {selected.isLocked ? <LockKeyhole /> : <UnlockKeyhole />} {selected.isLocked ? "Unlock lesson" : "Lock lesson"}
        </button>}
        {selected && <label className="lesson-teacher-control" title="Change the teacher for this lesson only">
          <UserRound />
          <select aria-label={`Teacher for this ${selected.subjectName} period`} value={selected.teacherId} disabled={changingTeacher} onChange={event => changeSelectedTeacher(event.target.value)}>
            {!teacherOptions.some(teacher => teacher.id === selected.teacherId) && <option value={selected.teacherId}>{selected.teacherName}</option>}
            {teacherOptions.map(teacher => <option value={teacher.id} key={teacher.id}>{teacher.name}</option>)}
          </select>
        </label>}
        <div className="tt-toolbar-actions">
          <button className="btn" onClick={downloadPdf}><Download /> Download</button>
          <button className="btn primary" onClick={publishTimetable} disabled={publishing || timetableInfo.status === "published"}>{publishing ? "Publishing…" : timetableInfo.status === "published" ? "Published" : "Publish timetable"}</button>
        </div>
      </div>
      <div className="score-row">
        <span><b>{timetableInfo.qualityScore ?? "—"}</b>/100 Quality</span>
        <span><CalendarDays /> <b>{entries.length}</b> lessons scheduled</span>
        <small>Version {timetableInfo.version} · {timetableInfo.status === "published" ? "Published official timetable" : "Draft"} {view === "class" ? "· Drag a lesson to reschedule" : "· Read-only view"}</small>
      </div>
      {entriesError && <div className="error-banner" style={{ margin: "0 14px" }}><AlertTriangle /><span>{entriesError}</span><button className="btn" onClick={loadEntries}>Retry</button></div>}
      {validationChecked && <div className={validationIssues.length ? "validation-results warning" : "validation-results success"}>
        {validationIssues.length ? <AlertTriangle /> : <ShieldCheck />}
        <div>
          <b>{validationIssues.length ? `${validationIssues.length} assignment period issue${validationIssues.length === 1 ? "" : "s"}` : "Assignment period counts are correct"}</b>
          {validationIssues.length ? <ul>{validationIssues.map(issue => <li key={issue.id}><strong>{issue.title}</strong><span>{issue.text}</span></li>)}</ul> : <p>Every active teaching assignment has the expected number of timetable periods.</p>}
        </div>
      </div>}
      <div className="tt-grid" style={entriesLoading ? { opacity: 0.5 } : undefined}>
        <div className="tt-head">Period</div>
        {workingDays.map(d => <div className="tt-head" key={d.id}>{d.name}</div>)}
        {periodSlots.flatMap(p => [
          <div className="tt-period" key={`p-${p.id}`}><b>{p.name}</b><small>{p.startTime.slice(0, 5)} – {p.endTime.slice(0, 5)}</small></div>,
          ...workingDays.map(d => {
            const cellEntries = cells.get(`${d.id}-${p.id}`) ?? [];
            if (view === "master") {
              return <div className="tt-cell" key={`${d.id}-${p.id}`} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {cellEntries.map(e => <button key={e.id} onClick={() => setSelected(e)} className={`lesson ${selected?.id === e.id ? "selected" : ""}`} style={{ borderLeft: `4px solid ${e.subjectColor}` }}>
                  <span><b>{e.className}</b><small>{e.subjectName} · {e.teacherName}</small></span>{e.isLocked && <LockKeyhole />}
                </button>)}
              </div>;
            }
            const isDragging = !!dragged && cellEntries.some(x => x.id === dragged.id);
            return <div className={isDragging ? "tt-cell dragging" : "tt-cell"} key={`${d.id}-${p.id}`}
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              onDragOver={view === "class" ? ev => ev.preventDefault() : undefined}
              onDrop={view === "class" ? () => handleDrop(d.id, p.id) : undefined}>
              {cellEntries.map(e => <button key={e.id} draggable={view === "class" && !e.isLocked} onDragStart={() => setDragged(e)} onClick={() => setSelected(e)} className={`lesson ${selected?.id === e.id ? "selected" : ""}`} style={{ borderLeft: `4px solid ${e.subjectColor}` }}>
                <span><b>{e.subjectName}</b><small>{view === "teacher" ? e.className : e.teacherName}</small></span>{e.isLocked && <LockKeyhole />}
              </button>)}
            </div>;
          }),
        ])}
      </div>
    </section>
    {pendingDrop && <div className="modal-backdrop" onClick={() => { if (!dropAction) setPendingDrop(null); }}>
      <section className="modal drop-action-modal" role="dialog" aria-modal="true" aria-labelledby="drop-action-title" onClick={event => event.stopPropagation()}>
        <div className="modal-head">
          <div><h2 id="drop-action-title">Choose drop action</h2><p>{pendingDrop.dragged.subjectName} was dropped onto {pendingDrop.target.subjectName}.</p></div>
          <button className="icon-btn" onClick={() => setPendingDrop(null)} disabled={!!dropAction} aria-label="Cancel drop"><X /></button>
        </div>
        <div className="drop-action-list">
          <button type="button" onClick={() => completeOccupiedDrop("swap")} disabled={!!dropAction || pendingDrop.target.isLocked}>
            <ArrowLeftRight />
            <span><b>{dropAction === "swap" ? "Swapping…" : "Swap lessons"}</b><small>{pendingDrop.target.isLocked ? `${pendingDrop.target.subjectName} is locked and cannot move.` : `Move each lesson into the other lesson's slot.`}</small></span>
          </button>
          <button type="button" onClick={() => completeOccupiedDrop("parallel")} disabled={!!dropAction || pendingDrop.dragged.subjectId === pendingDrop.target.subjectId}>
            <GitMerge />
            <span><b>{dropAction === "parallel" ? "Saving…" : "Teach in parallel"}</b><small>{pendingDrop.dragged.subjectId === pendingDrop.target.subjectId ? "A subject cannot run in parallel with itself." : `Keep both lessons in this slot and save the pairing for this level.`}</small></span>
          </button>
        </div>
        <footer><button type="button" className="btn" onClick={() => setPendingDrop(null)} disabled={!!dropAction}>Cancel</button></footer>
      </section>
    </div>}
    {coverageOpen && <div className="modal-backdrop" onClick={() => setCoverageOpen(false)}>
      <section className="modal coverage-modal" role="dialog" aria-modal="true" aria-labelledby="coverage-title" onClick={event => event.stopPropagation()}>
        <div className="modal-head">
          <div><h2 id="coverage-title">Class coverage</h2><p>{classOptions.find(option => option.id === classSectionId)?.name ?? "Selected class"} timetable completion</p></div>
          <button className="icon-btn" onClick={() => setCoverageOpen(false)} aria-label="Close class coverage"><X /></button>
        </div>
        {coverageLoading ? <div className="coverage-loading"><Skel w="100%" /><Skel w="100%" /><Skel w="100%" /></div> : coverageError ? (
          <div className="error-banner"><AlertTriangle /><span>{coverageError}</span><button className="btn" onClick={openClassCoverage}>Retry</button></div>
        ) : <>
          <div className="coverage-summary">
            <div><span>Subjects scheduled</span><b>{coverageRows.filter(row => row.scheduled > 0).length}/{coverageRows.length}</b></div>
            <div><span>Weekly periods</span><b>{coverageRows.reduce((sum, row) => sum + row.scheduled, 0)}/{coverageRows.reduce((sum, row) => sum + row.required, 0)}</b></div>
            <div><span>Subjects complete</span><b>{coverageRows.filter(row => row.scheduled === row.required).length}/{coverageRows.length}</b></div>
          </div>
          {coverageRows.length === 0 ? <div className="empty-inspector"><ChartNoAxesColumn /><h3>No subjects expected</h3><p>Add teaching assignments for this class to see coverage.</p></div> : <div className="coverage-list">
            {coverageRows.map(row => {
              const difference = row.required - row.scheduled;
              const complete = difference === 0;
              return <div className="coverage-row" key={row.subjectId}>
                <i className="color-dot" style={{ background: row.subjectColor }} />
                <div className="coverage-subject"><b>{row.subjectName}</b><small>{row.teacherNames.join(", ")}</small></div>
                <div className="coverage-meter"><span><i style={{ width: `${Math.min(100, row.required ? row.scheduled / row.required * 100 : 0)}%`, background: complete ? "var(--green)" : "var(--orange)" }} /></span></div>
                <strong>{row.scheduled}/{row.required} periods</strong>
                <em className={complete ? "complete" : "issue"}>{complete ? <><CheckCircle2 /> Complete</> : <><AlertTriangle /> {difference > 0 ? `${difference} missing` : `${Math.abs(difference)} extra`}</>}</em>
              </div>;
            })}
          </div>}
        </>}
        <footer><button className="btn primary" onClick={() => setCoverageOpen(false)}>Done</button></footer>
      </section>
    </div>}
  </div>;
}
