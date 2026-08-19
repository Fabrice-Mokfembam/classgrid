"use client";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarDays, Check, CheckCircle2, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useSchool } from "@/lib/school-context";
import type { PeriodSlot, WorkingDay } from "@/lib/types";
import { ErrorState, firstError, GridSkeleton, Skel } from "@/components/shared";

const DEFAULT_PERIODS = [
  { n: 1, start: "07:45", end: "08:30" }, { n: 2, start: "08:30", end: "09:15" },
  { n: 3, start: "09:30", end: "10:15" }, { n: 4, start: "10:15", end: "11:00" },
  { n: 5, start: "11:30", end: "12:15" }, { n: 6, start: "12:15", end: "13:00" },
  { n: 7, start: "13:00", end: "13:45" }, { n: 8, start: "13:45", end: "14:30" },
];

export function Availability() {
  const { schoolId, academicYearId, loading: schoolLoading } = useSchool();
  const [workingDays, setWorkingDays] = useState<WorkingDay[]>([]);
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>([]);
  const [teachersList, setTeachersList] = useState<{ id: string; fullName: string; requiredPeriods: number }[]>([]);
  const [teacherId, setTeacherId] = useState<string>("");
  const [availability, setAvailability] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !schoolId || !academicYearId) { setWorkingDays([]); setPeriodSlots([]); setTeachersList([]); setLoading(false); return; }
    setLoading(true); setLoadError(null);
    const [daysRes, slotsRes, teachersRes, assignmentsRes] = await Promise.all([
      supabase.from("working_days").select("id, name, sort_order").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("is_active", true).order("sort_order"),
      supabase.from("period_slots").select("id, name, period_number, start_time, end_time").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("kind", "lesson").order("sort_order"),
      supabase.from("teachers").select("id, full_name").eq("school_id", schoolId).order("full_name"),
      supabase.from("teaching_assignments").select("teacher_id, periods_per_week").eq("school_id", schoolId).eq("academic_year_id", academicYearId),
    ]);
    const err = firstError(daysRes, slotsRes, teachersRes, assignmentsRes);
    if (err) { setLoadError(err); setLoading(false); return; }
    setWorkingDays((daysRes.data ?? []).map((d): WorkingDay => ({ id: d.id, name: d.name, sortOrder: d.sort_order })));
    setPeriodSlots((slotsRes.data ?? []).map((p): PeriodSlot => ({ id: p.id, name: p.name, periodNumber: p.period_number, startTime: p.start_time, endTime: p.end_time })));
    const requiredByTeacher = new Map<string, number>();
    (assignmentsRes.data ?? []).forEach(a => requiredByTeacher.set(a.teacher_id, (requiredByTeacher.get(a.teacher_id) ?? 0) + a.periods_per_week));
    setTeachersList((teachersRes.data ?? []).map(t => ({ id: t.id, fullName: t.full_name, requiredPeriods: requiredByTeacher.get(t.id) ?? 0 })));
    setLoading(false);
  }, [schoolId, academicYearId]);

  useEffect(() => { if (!schoolLoading) load(); }, [schoolLoading, load]);
  useEffect(() => { if (!teacherId && teachersList.length) setTeacherId(teachersList[0].id); }, [teachersList, teacherId]);

  useEffect(() => {
    async function loadAvailability() {
      const supabase = createClient();
      if (!supabase || !schoolId || !academicYearId || !teacherId) { setAvailability(new Map()); return; }
      const { data, error } = await supabase.from("teacher_availability").select("working_day_id, period_slot_id, is_available").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("teacher_id", teacherId);
      if (error) { toast.error(error.message); return; }
      const map = new Map<string, boolean>();
      (data ?? []).forEach(row => map.set(`${row.working_day_id}-${row.period_slot_id}`, row.is_available));
      setAvailability(map);
    }
    loadAvailability();
  }, [schoolId, academicYearId, teacherId]);

  async function toggleCell(dayId: string, slotId: string) {
    const key = `${dayId}-${slotId}`;
    const current = availability.get(key) ?? true;
    const next = !current;
    setAvailability(m => new Map(m).set(key, next));
    const supabase = createClient();
    if (!supabase || !schoolId || !academicYearId || !teacherId) return;
    const { error } = await supabase.from("teacher_availability").upsert(
      { school_id: schoolId, academic_year_id: academicYearId, teacher_id: teacherId, working_day_id: dayId, period_slot_id: slotId, is_available: next },
      { onConflict: "academic_year_id,teacher_id,working_day_id,period_slot_id" }
    );
    if (error) { toast.error(error.message); setAvailability(m => new Map(m).set(key, current)); }
  }

  async function resetAvailability() {
    if (!window.confirm("Reset this teacher back to fully available?")) return;
    const supabase = createClient();
    if (!supabase || !schoolId || !academicYearId || !teacherId) return;
    const { error } = await supabase.from("teacher_availability").delete().eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("teacher_id", teacherId);
    if (error) { toast.error(error.message); return; }
    setAvailability(new Map());
    toast.success("Availability reset");
  }

  async function seedDefaultPeriods() {
    const supabase = createClient();
    if (!supabase || !schoolId || !academicYearId) return;
    setSeeding(true);
    const rows = DEFAULT_PERIODS.map(p => ({ school_id: schoolId, academic_year_id: academicYearId, name: `Period ${p.n}`, kind: "lesson", start_time: p.start, end_time: p.end, period_number: p.n, sort_order: p.n, day_block: p.n <= 4 ? "morning" : "afternoon" }));
    const { error } = await supabase.from("period_slots").insert(rows);
    setSeeding(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Default lesson periods created");
    load();
  }

  const teacher = teachersList.find(t => t.id === teacherId);
  const availableCount = workingDays.flatMap(d => periodSlots.map(p => availability.get(`${d.id}-${p.id}`) ?? true)).filter(Boolean).length;

  if (loadError) return <ErrorState message={loadError} onRetry={load} />;
  if (loading) return <div className="availability-layout"><section className="panel availability-main">
    <div className="availability-toolbar"><label>Teacher<span className="skeleton" style={{ height: 45, borderRadius: 8 }} /></label><div><small>Workload summary</small><Skel w="140px" /></div><button className="btn" disabled>Reset</button></div>
    <div className="availability-grid"><div className="av-head">Period</div>{Array.from({ length: 5 }).map((_, i) => <div className="av-head" key={i}><Skel w="60%" /></div>)}<GridSkeleton rows={6} cols={5} /></div>
  </section><aside className="panel teacher-side"><span className="avatar xlarge skeleton" style={{ boxShadow: "none" }} /><h3><Skel w="60%" /></h3></aside></div>;
  if (workingDays.length === 0) return <div className="empty-inspector"><CalendarDays /><h3>No teaching days configured</h3><p>Set up your school's teaching days first, on the School schedule page.</p></div>;
  if (periodSlots.length === 0) return <div className="empty-inspector"><CalendarDays /><h3>No lesson periods configured yet</h3><p>The availability grid needs lesson periods before it can be used.</p><button className="btn primary" onClick={seedDefaultPeriods} disabled={seeding}>{seeding ? "Setting up…" : "Use default schedule (8 periods)"}</button></div>;
  if (!teacher) return <div className="empty-inspector"><UsersRound /><h3>No teachers yet</h3><p>Add a teacher first to set their availability.</p></div>;

  return <div className="availability-layout"><section className="panel availability-main"><div className="availability-toolbar"><label>Teacher<select value={teacherId} onChange={e => setTeacherId(e.target.value)}>{teachersList.map(t => <option value={t.id} key={t.id}>{t.fullName}</option>)}</select></label><div><small>Workload summary</small><b>{teacher.requiredPeriods} required periods · <i>{availableCount} available slots</i></b></div><button className="btn" onClick={resetAvailability}>Reset</button></div><div className="availability-grid"><div className="av-head">Period</div>{workingDays.map(d => <div className="av-head" key={d.id}>{d.name}</div>)}{periodSlots.flatMap(p => [<div className="av-period" key={`p-${p.id}`}><b>{p.name}</b><small>{p.startTime.slice(0, 5)} – {p.endTime.slice(0, 5)}</small></div>, ...workingDays.map(d => { const key = `${d.id}-${p.id}`, on = availability.get(key) ?? true; return <button aria-label={`${d.name} ${p.name}`} className={on ? "av-cell on" : "av-cell off"} onClick={() => toggleCell(d.id, p.id)} key={key}>{on ? <Check /> : <X />}</button>; })])}</div><div className="legend"><span><i className="lg available" />Available</span><span><i className="lg unavailable" />Unavailable</span><small>Click any slot to change it.</small></div></section><aside className="panel teacher-side"><div className="avatar xlarge">{teacher.fullName.split(" ").map((x: string) => x[0]).join("")}</div><h3>{teacher.fullName}</h3><hr /><span>Required periods <b>{teacher.requiredPeriods}</b></span><span>Available slots <b>{availableCount}</b></span>{availableCount >= teacher.requiredPeriods ? <div className="success-box"><CheckCircle2 /><div><b>Availability is sufficient</b><p>{availableCount - teacher.requiredPeriods} more slots than required.</p></div></div> : <div className="warning-box"><AlertTriangle /><div><b>Availability may be tight</b><p>{teacher.requiredPeriods - availableCount} more slots needed than currently available.</p></div></div>}</aside></div>;
}
