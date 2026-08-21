"use client";
import { useCallback, useEffect, useState } from "react";
import { GripVertical, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useSchool } from "@/lib/school-context";
import type { SchedulePeriod, WorkingDay } from "@/lib/types";
import { ErrorState, firstError, RowsSkeleton, Skel } from "@/components/shared";
import { X } from "lucide-react";

function PeriodModal({ mode, initial, close, onSave }: { mode: "add" | "edit"; initial?: SchedulePeriod; close: () => void; onSave: (values: { name: string; kind: "lesson" | "break"; startTime: string; endTime: string }) => Promise<void> }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<"lesson" | "break">(initial?.kind ?? "lesson");
  const [startTime, setStartTime] = useState(initial?.startTime?.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState(initial?.endTime?.slice(0, 5) ?? "");
  const [saving, setSaving] = useState(false);
  return <div className="modal-backdrop"><form className="modal" onSubmit={async e => { e.preventDefault(); if (!name.trim() || !startTime || !endTime) return; setSaving(true); await onSave({ name: name.trim(), kind, startTime, endTime }); setSaving(false); }}>
    <div className="modal-head"><div><h2>{mode === "edit" ? "Edit period" : "Add period or break"}</h2><p>Defines a slot in the weekly timetable grid.</p></div><button type="button" className="icon-btn" onClick={close}><X /></button></div>
    <label>Type<select value={kind} onChange={e => setKind(e.target.value as "lesson" | "break")}><option value="lesson">Lesson</option><option value="break">Break</option></select></label>
    <label>Name<input required autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={kind === "break" ? "e.g. Short Break" : "e.g. Period 1"} /></label>
    <label>Start time<input type="time" required value={startTime} onChange={e => setStartTime(e.target.value)} /></label>
    <label>End time<input type="time" required value={endTime} onChange={e => setEndTime(e.target.value)} /></label>
    <footer><button type="button" className="btn" onClick={close}>Cancel</button><button className="btn primary" disabled={saving}>{saving ? "Saving\u2026" : "Save"}</button></footer>
  </form></div>;
}

export function Schedule() {
  const { schoolId, academicYearId, loading: schoolLoading } = useSchool();
  const [workingDays, setWorkingDays] = useState<WorkingDay[]>([]);
  const [periodList, setPeriodList] = useState<SchedulePeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [periodModal, setPeriodModal] = useState<{ mode: "add" } | { mode: "edit"; period: SchedulePeriod } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !schoolId || !academicYearId) { setWorkingDays([]); setPeriodList([]); setLoading(false); return; }
    setLoading(true); setLoadError(null);
    const [daysRes, slotsRes] = await Promise.all([
      supabase.from("working_days").select("id, name, weekday, sort_order, is_active").eq("school_id", schoolId).eq("academic_year_id", academicYearId).order("sort_order"),
      supabase.from("period_slots").select("id, name, kind, start_time, end_time, period_number, sort_order").eq("school_id", schoolId).eq("academic_year_id", academicYearId).order("sort_order"),
    ]);
    const err = firstError(daysRes, slotsRes);
    if (err) { setLoadError(err); setLoading(false); return; }
    setWorkingDays((daysRes.data ?? []).map((d): WorkingDay => ({ id: d.id, name: d.name, weekday: d.weekday, sortOrder: d.sort_order, isActive: d.is_active })));
    setPeriodList((slotsRes.data ?? []).map((p): SchedulePeriod => ({ id: p.id, name: p.name, kind: p.kind, startTime: p.start_time, endTime: p.end_time, periodNumber: p.period_number, sortOrder: p.sort_order })));
    setLoading(false);
  }, [schoolId, academicYearId]);

  useEffect(() => { if (!schoolLoading) load(); }, [schoolLoading, load]);

  const saturday = workingDays.find(d => d.weekday === 6);
  const sixDayWeek = !!saturday?.isActive;

  async function setTeachingDays(sixDays: boolean) {
    const supabase = createClient();
    if (!supabase || !schoolId || !academicYearId) return;
    if (saturday) {
      const { error } = await supabase.from("working_days").update({ is_active: sixDays }).eq("id", saturday.id);
      if (error) { toast.error(error.message); return; }
      setWorkingDays(days => days.map(day => day.id === saturday.id ? { ...day, isActive: sixDays } : day));
    } else if (sixDays) {
      const { data, error } = await supabase.from("working_days").insert({ school_id: schoolId, academic_year_id: academicYearId, weekday: 6, name: "Saturday", sort_order: 6, is_active: true }).select("id, name, weekday, sort_order, is_active").single();
      if (error) { toast.error(error.message); return; }
      setWorkingDays(days => [...days, { id: data.id, name: data.name, weekday: data.weekday, sortOrder: data.sort_order, isActive: data.is_active }].sort((a, b) => a.sortOrder - b.sortOrder));
    }
    toast.success(sixDays ? "Saturday added to the teaching week" : "Saturday removed from the teaching week");
  }

  async function savePeriod(values: { name: string; kind: "lesson" | "break"; startTime: string; endTime: string }) {
    const supabase = createClient();
    if (!supabase || !schoolId || !academicYearId) return;
    if (values.startTime >= values.endTime) { toast.error("End time must be after start time"); return; }
    const dayBlock = values.startTime < "12:00" ? "morning" : "afternoon";
    if (periodModal?.mode === "edit") {
      const periodNumber = values.kind === "lesson" ? (periodModal.period.periodNumber ?? (periodList.filter(p => p.kind === "lesson" && p.id !== periodModal.period.id).length + 1)) : null;
      const { data, error } = await supabase.from("period_slots").update({ name: values.name, kind: values.kind, start_time: values.startTime, end_time: values.endTime, period_number: periodNumber, day_block: dayBlock }).eq("id", periodModal.period.id).select("id, name, kind, start_time, end_time, period_number, sort_order").single();
      if (error) { toast.error(error.message); return; }
      const savedPeriod: SchedulePeriod = { id: data.id, name: data.name, kind: data.kind, startTime: data.start_time, endTime: data.end_time, periodNumber: data.period_number, sortOrder: data.sort_order };
      setPeriodList(periods => periods.map(period => period.id === savedPeriod.id ? savedPeriod : period));
    } else {
      const nextSort = periodList.length ? Math.max(...periodList.map(p => p.sortOrder)) + 1 : 1;
      const lessonCount = periodList.filter(p => p.kind === "lesson").length;
      const { data, error } = await supabase.from("period_slots").insert({
        school_id: schoolId, academic_year_id: academicYearId, name: values.name, kind: values.kind,
        start_time: values.startTime, end_time: values.endTime, sort_order: nextSort,
        period_number: values.kind === "lesson" ? lessonCount + 1 : null, day_block: dayBlock,
      }).select("id, name, kind, start_time, end_time, period_number, sort_order").single();
      if (error) { toast.error(error.message); return; }
      const savedPeriod: SchedulePeriod = { id: data.id, name: data.name, kind: data.kind, startTime: data.start_time, endTime: data.end_time, periodNumber: data.period_number, sortOrder: data.sort_order };
      setPeriodList(periods => [...periods, savedPeriod].sort((a, b) => a.sortOrder - b.sortOrder));
    }
    toast.success(periodModal?.mode === "edit" ? "Period updated" : "Period added");
    setPeriodModal(null);
  }

  async function deletePeriod(period: SchedulePeriod) {
    if (!window.confirm(`Remove ${period.name}?`)) return;
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.from("period_slots").delete().eq("id", period.id);
    if (error) {
      toast.error(error.code === "23503" ? "This period is used by existing timetable data \u2014 remove that first." : error.message);
      return;
    }
    toast.success("Period removed");
    setOpenMenuId(null);
    setPeriodList(periods => periods.filter(item => item.id !== period.id));
  }

  if (loadError) return <ErrorState message={loadError} onRetry={load} />;

  const activeDaysCount = workingDays.filter(d => d.isActive).length;
  const lessonCount = periodList.filter(p => p.kind === "lesson").length;

  return <div className="settings-layout">
    <section className="panel form-panel">
      <div className="section-heading"><div><h3>Weekly structure</h3><p>These slots form the grid used by the generation engine.</p></div></div>
      <div className="field-row">
        <label>Teaching days{loading ? <Skel w="100%" /> : <select value={sixDayWeek ? "6" : "5"} onChange={e => setTeachingDays(e.target.value === "6")}><option value="5">Monday – Friday</option><option value="6">Monday – Saturday</option></select>}</label>
      </div>
      <div className="period-list">
        <div className="period-row head"><span>Type</span><span>Name</span><span>Start</span><span>End</span><span></span></div>
        {loading ? <RowsSkeleton className="period-row" cols={4} rows={5} /> : periodList.map(p => <div className={`period-row ${p.kind === "break" ? "break" : ""}`} key={p.id}>
          <span className="drag"><GripVertical /></span>
          <span><b>{p.name}</b><small>{p.kind === "break" ? "Break" : "Lesson"}</small></span>
          <input value={p.startTime.slice(0, 5)} readOnly />
          <input value={p.endTime.slice(0, 5)} readOnly />
          <div className="row-menu">
            <button className="more" onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}>•••</button>
            {openMenuId === p.id && <>
              <div className="row-menu-scrim" onClick={() => setOpenMenuId(null)} />
              <div className="row-menu-dropdown">
                <button onClick={() => { setPeriodModal({ mode: "edit", period: p }); setOpenMenuId(null); }}>Edit</button>
                <button onClick={() => deletePeriod(p)}>Delete</button>
              </div>
            </>}
          </div>
        </div>)}
        {!loading && periodList.length === 0 && <p className="muted" style={{ padding: "16px 0" }}>No periods or breaks configured yet.</p>}
      </div>
      <button type="button" className="btn dashed" onClick={() => setPeriodModal({ mode: "add" })}><Plus /> Add period or break</button>
    </section>
    <aside className="panel tips">
      <Sparkles /><h3>Configuration tip</h3>
      <p>Use explicit start and end times. Double lessons will only be placed in consecutive lesson slots and will never cross a break.</p>
      <div className="capacity"><span>Weekly capacity</span><b>{lessonCount * activeDaysCount} lesson slots</b><small>{lessonCount} periods × {activeDaysCount} days</small></div>
    </aside>
    {periodModal && <PeriodModal mode={periodModal.mode} initial={periodModal.mode === "edit" ? periodModal.period : undefined} close={() => setPeriodModal(null)} onSave={savePeriod} />}
  </div>;
}
