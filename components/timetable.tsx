"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Download, LockKeyhole, RefreshCw, ShieldCheck, Sparkles, UnlockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useSchool } from "@/lib/school-context";
import type { PeriodSlot, TimetableEntry, WorkingDay } from "@/lib/types";
import { ErrorState, GridSkeleton, Skel } from "@/components/shared";

export function Timetable() {
  const { schoolId, academicYearId, schoolName, academicYearName, loading: schoolLoading } = useSchool();
  const [loading, setLoading] = useState(true);
  const [workingDays, setWorkingDays] = useState<WorkingDay[]>([]);
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>([]);
  const [classOptions, setClassOptions] = useState<{ id: string; name: string }[]>([]);
  const [teacherOptions, setTeacherOptions] = useState<{ id: string; name: string }[]>([]);
  const [classSectionId, setClassSectionId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [view, setView] = useState<"class" | "teacher" | "master">("class");
  const [timetableInfo, setTimetableInfo] = useState<{ id: string; version: number; qualityScore: number | null } | null>(null);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [selected, setSelected] = useState<TimetableEntry | null>(null);
  const [dragged, setDragged] = useState<TimetableEntry | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [entriesLoading, setEntriesLoading] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !schoolId || !academicYearId) { setLoading(false); return; }
    setLoading(true); setLoadError(null);
    const [daysRes, slotsRes, classesRes, teachersRes, timetableRes] = await Promise.all([
      supabase.from("working_days").select("id, name, sort_order").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("is_active", true).order("sort_order"),
      supabase.from("period_slots").select("id, name, period_number, start_time, end_time").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("kind", "lesson").order("sort_order"),
      supabase.from("class_sections").select("id, name").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("status", "active").order("name"),
      supabase.from("teachers").select("id, full_name").eq("school_id", schoolId).eq("status", "active").order("full_name"),
      supabase.from("timetables").select("id, version, quality_score").eq("school_id", schoolId).eq("academic_year_id", academicYearId).order("version", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const err = daysRes.error?.message ?? slotsRes.error?.message ?? classesRes.error?.message ?? teachersRes.error?.message ?? timetableRes.error?.message ?? null;
    if (err) { setLoadError(err); setLoading(false); return; }
    setWorkingDays((daysRes.data ?? []).map((d): WorkingDay => ({ id: d.id, name: d.name, sortOrder: d.sort_order })));
    setPeriodSlots((slotsRes.data ?? []).map((p): PeriodSlot => ({ id: p.id, name: p.name, periodNumber: p.period_number, startTime: p.start_time, endTime: p.end_time })));
    setClassOptions(classesRes.data ?? []);
    setTeacherOptions((teachersRes.data ?? []).map(t => ({ id: t.id, name: t.full_name })));
    setTimetableInfo(timetableRes.data ? { id: timetableRes.data.id, version: timetableRes.data.version, qualityScore: timetableRes.data.quality_score } : null);
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
      .select("id, working_day_id, period_slot_id, is_locked, subjects(name, color), teachers(full_name), class_sections(name)")
      .eq("timetable_id", timetableInfo.id);
    if (view === "class") query = query.eq("class_section_id", classSectionId);
    if (view === "teacher") query = query.eq("teacher_id", teacherId);
    const { data, error } = await query;
    if (error) { setEntriesError(error.message); setEntriesLoading(false); return; }
    setEntries((data ?? []).map((e): TimetableEntry => {
      const subject = Array.isArray(e.subjects) ? e.subjects[0] : e.subjects;
      const teacher = Array.isArray(e.teachers) ? e.teachers[0] : e.teachers;
      const classRow = Array.isArray(e.class_sections) ? e.class_sections[0] : e.class_sections;
      return { id: e.id, dayId: e.working_day_id, periodSlotId: e.period_slot_id, isLocked: e.is_locked, subjectName: (subject as { name: string } | null)?.name ?? "—", subjectColor: (subject as { color: string } | null)?.color ?? "#3b82f6", teacherName: (teacher as { full_name: string } | null)?.full_name ?? "—", className: (classRow as { name: string } | null)?.name ?? "—" };
    }));
    setSelected(null);
    setEntriesLoading(false);
  }, [timetableInfo, view, classSectionId, teacherId]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

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

  async function handleDrop(dayId: string, periodId: string) {
    if (!dragged) return;
    const dragSnapshot = dragged;
    setDragged(null);
    const target = (cells.get(`${dayId}-${periodId}`) ?? [])[0];
    if (target?.id === dragSnapshot.id) return;
    if (target?.isLocked) { toast.error("This lesson is locked and cannot be replaced"); return; }
    const supabase = createClient();
    if (!supabase) return;
    if (target) {
      const { error } = await supabase.rpc("swap_timetable_entries", { p_entry_a: dragSnapshot.id, p_entry_b: target.id });
      if (error) { toast.error(error.code === "23505" ? "That slot conflicts with an existing lesson for this teacher elsewhere in the timetable" : error.message.includes("locked") ? "This lesson is locked and cannot be replaced" : error.message); return; }
      toast.success("Lessons swapped");
    } else {
      const { error } = await supabase.from("timetable_entries").update({ working_day_id: dayId, period_slot_id: periodId }).eq("id", dragSnapshot.id);
      if (error) { toast.error(error.code === "23505" ? "That slot conflicts with an existing lesson for this teacher or class" : error.message); return; }
      toast.success("Lesson moved");
    }
    loadEntries();
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
      setTimetableInfo(info => info ? { ...info, qualityScore: summary.qualityScore } : info);
      loadEntries();
    } catch { toast.error("Regeneration failed"); }
    finally { setRegenerating(false); }
  }

  async function downloadPdf() {
    const [{ jsPDF: JsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const subtitle = view === "master" ? "Master timetable — all classes" : view === "teacher" ? `Teacher timetable — ${teacherOptions.find(t => t.id === teacherId)?.name ?? ""}` : `Class timetable — ${classOptions.find(c => c.id === classSectionId)?.name ?? ""}`;
    const doc = new JsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(schoolName ?? "Timetable", 40, 40);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`${subtitle}${academicYearName ? ` · ${academicYearName}` : ""}`, 40, 58);
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
      <div className="tt-toolbar">
        <div className="segmented">
          <button className={view === "class" ? "active" : ""} onClick={() => setView("class")}>Class</button>
          <button className={view === "teacher" ? "active" : ""} onClick={() => setView("teacher")}>Teacher</button>
          <button className={view === "master" ? "active" : ""} onClick={() => setView("master")}>Master</button>
        </div>
        {view === "class" && <select value={classSectionId} onChange={e => setClassSectionId(e.target.value)}>{classOptions.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select>}
        {view === "teacher" && <select value={teacherId} onChange={e => setTeacherId(e.target.value)}>{teacherOptions.map(t => <option value={t.id} key={t.id}>{t.name}</option>)}</select>}
        <button className="btn" disabled title="Not built yet"><ShieldCheck /> Validate</button>
        <button className="btn" onClick={regenerateUnlocked} disabled={regenerating}><RefreshCw /> {regenerating ? "Regenerating…" : "Regenerate unlocked"}</button>
        {selected && <button className="btn" onClick={toggleLock} title={selected.isLocked ? "Locked — click to unlock." : "Unlocked — click to lock."}>
          {selected.isLocked ? <LockKeyhole /> : <UnlockKeyhole />} {selected.isLocked ? "Unlock lesson" : "Lock lesson"}
        </button>}
        <div className="tt-toolbar-actions">
          <button className="btn" onClick={downloadPdf}><Download /> Download</button>
          <button className="btn primary" onClick={() => { if (window.confirm("Publish this timetable? It will become visible to teachers and classes.")) toast.success("Timetable published"); }}>Publish timetable</button>
        </div>
      </div>
      <div className="score-row">
        <span><b>{timetableInfo.qualityScore ?? "—"}</b>/100 Quality</span>
        <span><CalendarDays /> <b>{entries.length}</b> lessons scheduled</span>
        <small>Version {timetableInfo.version} {view === "class" ? "· Drag a lesson to reschedule" : "· Read-only view"}</small>
      </div>
      {entriesError && <div className="error-banner" style={{ margin: "0 14px" }}><AlertTriangle /><span>{entriesError}</span><button className="btn" onClick={loadEntries}>Retry</button></div>}
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
            const e = cellEntries[0];
            return <div className={dragged && dragged.id === e?.id ? "tt-cell dragging" : "tt-cell"} key={`${d.id}-${p.id}`}
              onDragOver={view === "class" ? ev => ev.preventDefault() : undefined}
              onDrop={view === "class" ? () => handleDrop(d.id, p.id) : undefined}>
              {e && <button draggable={view === "class" && !e.isLocked} onDragStart={() => setDragged(e)} onClick={() => setSelected(e)} className={`lesson ${selected?.id === e.id ? "selected" : ""}`} style={{ borderLeft: `4px solid ${e.subjectColor}` }}>
                <span><b>{e.subjectName}</b><small>{view === "teacher" ? e.className : e.teacherName}</small></span>{e.isLocked && <LockKeyhole />}
              </button>}
            </div>;
          }),
        ])}
      </div>
    </section>
  </div>;
}
