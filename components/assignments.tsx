"use client";
import { useCallback, useEffect, useState } from "react";
import { FileCheck2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useSchool } from "@/lib/school-context";
import type { TeachingAssignment } from "@/lib/types";
import { ErrorState, firstError, RowsSkeleton, TableShell } from "@/components/shared";

const PATTERN_LABELS: Record<string, string> = { singles: "Singles", double: "Double", mixed: "Mixed" };

function AssignmentModal({ mode, initial, teacherOptions, subjectOptions, classOptions, levelSubjects, close, onSave }: { mode: "add" | "edit"; initial?: TeachingAssignment; teacherOptions: { id: string; name: string }[]; subjectOptions: { id: string; name: string }[]; classOptions: { id: string; name: string; levelId: string }[]; levelSubjects: { levelId: string; subjectId: string; periodsPerWeek: number }[]; close: () => void; onSave: (values: { teacherId: string; subjectId: string; classSectionId: string; periodsPerWeek: number; pattern: string }) => Promise<void> }) {
  const [teacherId, setTeacherId] = useState(initial?.teacherId ?? "");
  const [classSectionId, setClassSectionId] = useState(initial?.classSectionId ?? "");
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? "");
  const [pattern, setPattern] = useState(initial?.pattern ?? "singles");
  const [saving, setSaving] = useState(false);

  const levelId = classOptions.find(c => c.id === classSectionId)?.levelId ?? null;
  const levelSubjectOptions = levelId ? levelSubjects.filter(ls => ls.levelId === levelId) : [];
  const allowedSubjects = subjectOptions.filter(s => levelSubjectOptions.some(ls => ls.subjectId === s.id));
  const periodsPerWeek = levelSubjectOptions.find(ls => ls.subjectId === subjectId)?.periodsPerWeek ?? null;

  function onClassChange(id: string) {
    setClassSectionId(id);
    const newLevelId = classOptions.find(c => c.id === id)?.levelId;
    if (!newLevelId || !levelSubjects.some(ls => ls.levelId === newLevelId && ls.subjectId === subjectId)) setSubjectId("");
  }

  return <div className="modal-backdrop"><form className="modal" onSubmit={async e => { e.preventDefault(); if (!teacherId || !subjectId || !classSectionId || periodsPerWeek == null) return; setSaving(true); await onSave({ teacherId, subjectId, classSectionId, periodsPerWeek, pattern }); setSaving(false); }}>
    <div className="modal-head"><div><h2>{mode === "edit" ? "Edit teaching assignment" : "Add teaching assignment"}</h2><p>Enter the information used by the timetable generator.</p></div><button type="button" className="icon-btn" onClick={close}><X /></button></div>
    <label>Teacher<select required autoFocus value={teacherId} onChange={e => setTeacherId(e.target.value)}><option value="">Select teacher</option>{teacherOptions.map(t => <option value={t.id} key={t.id}>{t.name}</option>)}</select></label>
    <label>Class section<select required value={classSectionId} onChange={e => onClassChange(e.target.value)}><option value="">Select class section</option>{classOptions.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
    {classSectionId && allowedSubjects.length === 0 ? (
      <small className="field-hint">This class's level has no subjects configured yet — set them up on the Levels page (Manage subjects) first.</small>
    ) : <>
      <label>Subject<select required disabled={!classSectionId} value={subjectId} onChange={e => setSubjectId(e.target.value)}><option value="">{classSectionId ? "Select subject" : "Select a class section first"}</option>{allowedSubjects.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
      <label>Periods per week<input value={periodsPerWeek ?? ""} disabled placeholder="Set by the level's subject configuration" /></label>
    </>}
    <label>Lesson pattern<select value={pattern} onChange={e => setPattern(e.target.value)}><option value="singles">Singles</option><option value="double">Double</option><option value="mixed">Mixed</option></select></label>
    <footer><button type="button" className="btn" onClick={close}>Cancel</button><button className="btn primary" disabled={saving || periodsPerWeek == null}>{saving ? "Saving…" : `Save ${mode === "edit" ? "changes" : "assignment"}`}</button></footer>
  </form></div>;
}

export function Assignments() {
  const { schoolId, academicYearId, loading: schoolLoading } = useSchool();
  const [assignmentsList, setAssignmentsList] = useState<TeachingAssignment[]>([]);
  const [teacherOptions, setTeacherOptions] = useState<{ id: string; name: string }[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<{ id: string; name: string }[]>([]);
  const [classOptions, setClassOptions] = useState<{ id: string; name: string; levelId: string }[]>([]);
  const [levelSubjects, setLevelSubjects] = useState<{ levelId: string; subjectId: string; periodsPerWeek: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assignmentModal, setAssignmentModal] = useState<{ mode: "add" } | { mode: "edit"; assignment: TeachingAssignment } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !schoolId || !academicYearId) { setAssignmentsList([]); setTeacherOptions([]); setSubjectOptions([]); setClassOptions([]); setLevelSubjects([]); setLoading(false); return; }
    setLoading(true); setLoadError(null);
    const [assignmentsRes, teachersRes, subjectsRes, classesRes, levelSubjectsRes] = await Promise.all([
      supabase.from("teaching_assignments").select("id, periods_per_week, pattern, status, teacher_id, subject_id, class_section_id, teachers(full_name), subjects(name), class_sections(name)").eq("school_id", schoolId).eq("academic_year_id", academicYearId).order("created_at"),
      supabase.from("teachers").select("id, full_name").eq("school_id", schoolId).order("full_name"),
      supabase.from("subjects").select("id, name").eq("school_id", schoolId).order("name"),
      supabase.from("class_sections").select("id, name, level_id").eq("school_id", schoolId).eq("academic_year_id", academicYearId).order("name"),
      supabase.from("level_subjects").select("level_id, subject_id, periods_per_week").eq("school_id", schoolId),
    ]);
    const err = firstError(assignmentsRes, teachersRes, subjectsRes, classesRes, levelSubjectsRes);
    if (err) { setLoadError(err); setLoading(false); return; }
    setAssignmentsList((assignmentsRes.data ?? []).map((a): TeachingAssignment => {
      const teacherRow = Array.isArray(a.teachers) ? a.teachers[0] : a.teachers;
      const subjectRow = Array.isArray(a.subjects) ? a.subjects[0] : a.subjects;
      const classRow = Array.isArray(a.class_sections) ? a.class_sections[0] : a.class_sections;
      return { id: a.id, teacherId: a.teacher_id, teacherName: (teacherRow as { full_name: string } | null)?.full_name ?? "—", subjectId: a.subject_id, subjectName: (subjectRow as { name: string } | null)?.name ?? "—", classSectionId: a.class_section_id, className: (classRow as { name: string } | null)?.name ?? "—", periodsPerWeek: a.periods_per_week, pattern: a.pattern, status: a.status };
    }));
    setTeacherOptions((teachersRes.data ?? []).map(t => ({ id: t.id, name: t.full_name })));
    setSubjectOptions((subjectsRes.data ?? []).map(s => ({ id: s.id, name: s.name })));
    setClassOptions((classesRes.data ?? []).map(c => ({ id: c.id, name: c.name, levelId: c.level_id })));
    setLevelSubjects((levelSubjectsRes.data ?? []).map(ls => ({ levelId: ls.level_id, subjectId: ls.subject_id, periodsPerWeek: ls.periods_per_week })));
    setLoading(false);
  }, [schoolId, academicYearId]);

  useEffect(() => { if (!schoolLoading) load(); }, [schoolLoading, load]);

  async function saveAssignment(values: { teacherId: string; subjectId: string; classSectionId: string; periodsPerWeek: number; pattern: string }) {
    const supabase = createClient();
    if (!supabase || !schoolId || !academicYearId) return;
    const payload = { school_id: schoolId, academic_year_id: academicYearId, teacher_id: values.teacherId, subject_id: values.subjectId, class_section_id: values.classSectionId, periods_per_week: values.periodsPerWeek, pattern: values.pattern };
    const { error } = assignmentModal?.mode === "edit"
      ? await supabase.from("teaching_assignments").update(payload).eq("id", assignmentModal.assignment.id)
      : await supabase.from("teaching_assignments").insert(payload);
    if (error) { toast.error(error.code === "23505" ? "This teacher, subject and class combination already exists." : error.message); return; }
    toast.success(assignmentModal?.mode === "edit" ? "Assignment updated" : "Assignment created");
    setAssignmentModal(null);
    load();
  }

  async function deleteAssignment(assignment: TeachingAssignment) {
    if (!window.confirm("Remove this assignment?")) return;
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.from("teaching_assignments").delete().eq("id", assignment.id);
    if (error) { toast.error(error.code === "23503" ? "This assignment is used by a published timetable — remove it there first." : error.message); return; }
    toast.success("Assignment removed");
    setOpenMenuId(null);
    load();
  }

  if (loadError) return <ErrorState message={loadError} onRetry={load} />;

  return <TableShell title="Teaching assignments" count={assignmentsList.length} button="Add assignment" onAdd={() => {
    if (teacherOptions.length === 0 || subjectOptions.length === 0 || classOptions.length === 0) { toast.error("Add a teacher, a subject and a class section first"); return; }
    setAssignmentModal({ mode: "add" });
  }}>
    <div className="info-banner"><ShieldCheck /><div><b>The assignment is the generator's core input</b><span>It connects one teacher, subject and actual class with its weekly period requirement.</span></div></div>
    {loading ? <div className="data-table"><div className="data-row head assignments"><span>Teacher</span><span>Subject</span><span>Class</span><span>Periods / week</span><span>Pattern</span><span></span></div><RowsSkeleton className="data-row assignments" cols={5} rows={5} /></div> : assignmentsList.length === 0 ? (
      <div className="empty-inspector"><FileCheck2 /><h3>No teaching assignments yet</h3><p>Add your first assignment to get started.</p></div>
    ) : <div className="data-table">
      <div className="data-row head assignments"><span>Teacher</span><span>Subject</span><span>Class</span><span>Periods / week</span><span>Pattern</span><span></span></div>
      {assignmentsList.map(a => <div className="data-row assignments" key={a.id}>
        <span><span className="avatar">{a.teacherName.split(" ").map(x => x[0]).join("")}</span><b>{a.teacherName}</b></span>
        <span>{a.subjectName}</span>
        <span><i className="status-pill">{a.className}</i></span>
        <span><b>{a.periodsPerWeek}</b></span>
        <span>{PATTERN_LABELS[a.pattern] ?? a.pattern}</span>
        <div className="row-menu">
          <button className="more" onClick={() => setOpenMenuId(openMenuId === a.id ? null : a.id)}>•••</button>
          {openMenuId === a.id && <>
            <div className="row-menu-scrim" onClick={() => setOpenMenuId(null)} />
            <div className="row-menu-dropdown">
              <button onClick={() => { setAssignmentModal({ mode: "edit", assignment: a }); setOpenMenuId(null); }}>Edit</button>
              <button onClick={() => deleteAssignment(a)}>Delete</button>
            </div>
          </>}
        </div>
      </div>)}
    </div>}
    {assignmentModal && <AssignmentModal mode={assignmentModal.mode} initial={assignmentModal.mode === "edit" ? assignmentModal.assignment : undefined} teacherOptions={teacherOptions} subjectOptions={subjectOptions} classOptions={classOptions} levelSubjects={levelSubjects} close={() => setAssignmentModal(null)} onSave={saveAssignment} />}
  </TableShell>;
}
