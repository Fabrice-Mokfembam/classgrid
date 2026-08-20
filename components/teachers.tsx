"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useSchool } from "@/lib/school-context";
import type { SchoolSubject, SchoolTeacher } from "@/lib/types";
import { ErrorState, firstError, Skel, TableShell } from "@/components/shared";

function TeacherModal({ mode, initial, subjectOptions, classOptions, close, onSave }: { mode: "add" | "edit"; initial?: SchoolTeacher; subjectOptions: SchoolSubject[]; classOptions: { id: string; name: string; levelId: string }[]; close: () => void; onSave: (values: { fullName: string; teacherCode: string; email: string; phone: string; subjectIds: string[]; classSectionIds: string[] }) => Promise<void> }) {
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [teacherCode, setTeacherCode] = useState(initial?.teacherCode ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [subjectIds, setSubjectIds] = useState<string[]>(initial?.subjectIds ?? []);
  const [classSectionIds, setClassSectionIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const toggleSubject = (id: string) => setSubjectIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  const toggleClass = (id: string) => setClassSectionIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  return <div className="modal-backdrop"><form className="modal" onSubmit={async e => { e.preventDefault(); if (!fullName.trim()) return; setSaving(true); await onSave({ fullName: fullName.trim(), teacherCode: teacherCode.trim(), email: email.trim(), phone: phone.trim(), subjectIds, classSectionIds }); setSaving(false); }}>
    <div className="modal-head"><div><h2>{mode === "edit" ? "Edit teacher" : "Add teacher"}</h2><p>Enter the information used by the timetable generator.</p></div><button type="button" className="icon-btn" onClick={close}><X /></button></div>
    <label>Full name<input required autoFocus value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Enter full name" /></label>
    <label>Teacher code<input value={teacherCode} onChange={e => setTeacherCode(e.target.value)} placeholder="e.g. T-001" /></label>
    <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter email address" /></label>
    <label>Phone number<input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Enter phone number" /></label>
    <fieldset><legend>Subjects taught</legend>
      {subjectOptions.length === 0 ? <small className="field-hint">Add subjects first to assign them here.</small> : <div className="subject-checks">
        {subjectOptions.map(s => <label key={s.id} className="check"><input type="checkbox" checked={subjectIds.includes(s.id)} onChange={() => toggleSubject(s.id)} />{s.name}</label>)}
      </div>}
    </fieldset>
    <fieldset><legend>Classes taught</legend>
      {classOptions.length === 0 ? <small className="field-hint">Add class sections first to assign them here.</small> : <>
        <small className="field-hint">Creates a teaching assignment for every selected class × subject pair the class's level actually offers, with periods per week set from that level's configuration.</small>
        <div className="subject-checks" style={{ marginTop: 8 }}>
          {classOptions.map(c => <label key={c.id} className="check"><input type="checkbox" checked={classSectionIds.includes(c.id)} onChange={() => toggleClass(c.id)} />{c.name}</label>)}
        </div>
      </>}
    </fieldset>
    <footer><button type="button" className="btn" onClick={close}>Cancel</button><button className="btn primary" disabled={saving}>{saving ? "Saving…" : `Save ${mode === "edit" ? "changes" : "teacher"}`}</button></footer>
  </form></div>;
}

export function Teachers() {
  const { schoolId, academicYearId, loading: schoolLoading } = useSchool();
  const [teachersList, setTeachersList] = useState<SchoolTeacher[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<SchoolSubject[]>([]);
  const [classOptions, setClassOptions] = useState<{ id: string; name: string; levelId: string }[]>([]);
  const [levelSubjects, setLevelSubjects] = useState<{ levelId: string; subjectId: string; periodsPerWeek: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [teacherModal, setTeacherModal] = useState<{ mode: "add" } | { mode: "edit"; teacher: SchoolTeacher } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !schoolId) { setTeachersList([]); setSubjectOptions([]); setClassOptions([]); setLevelSubjects([]); setLoading(false); return; }
    setLoading(true); setLoadError(null);
    const [teachersRes, subjectsRes, linksRes] = await Promise.all([
      supabase.from("teachers").select("id, full_name, teacher_code, email, phone, status").eq("school_id", schoolId).order("full_name"),
      supabase.from("subjects").select("id, name, code, color, status").eq("school_id", schoolId).order("name"),
      supabase.from("teacher_subjects").select("teacher_id, subject_id, subjects(name)").eq("school_id", schoolId),
    ]);
    const err0 = firstError(teachersRes, subjectsRes, linksRes);
    if (err0) { setLoadError(err0); setLoading(false); return; }
    let requiredByTeacher = new Map<string, number>();
    let availableByTeacher = new Map<string, number>();
    if (academicYearId) {
      const [assignmentsRes, availabilityRes, classesRes, levelSubjectsRes] = await Promise.all([
        supabase.from("teaching_assignments").select("teacher_id, periods_per_week").eq("school_id", schoolId).eq("academic_year_id", academicYearId),
        supabase.from("teacher_availability").select("teacher_id").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("is_available", true),
        supabase.from("class_sections").select("id, name, level_id").eq("school_id", schoolId).eq("academic_year_id", academicYearId).order("name"),
        supabase.from("level_subjects").select("level_id, subject_id, periods_per_week").eq("school_id", schoolId),
      ]);
      const err1 = firstError(assignmentsRes, availabilityRes, classesRes, levelSubjectsRes);
      if (err1) { setLoadError(err1); setLoading(false); return; }
      (assignmentsRes.data ?? []).forEach(a => requiredByTeacher.set(a.teacher_id, (requiredByTeacher.get(a.teacher_id) ?? 0) + a.periods_per_week));
      (availabilityRes.data ?? []).forEach(a => availableByTeacher.set(a.teacher_id, (availableByTeacher.get(a.teacher_id) ?? 0) + 1));
      setClassOptions((classesRes.data ?? []).map(c => ({ id: c.id, name: c.name, levelId: c.level_id })));
      setLevelSubjects((levelSubjectsRes.data ?? []).map(ls => ({ levelId: ls.level_id, subjectId: ls.subject_id, periodsPerWeek: ls.periods_per_week })));
    } else {
      setClassOptions([]); setLevelSubjects([]);
    }
    const linksByTeacher = new Map<string, { id: string; name: string }[]>();
    (linksRes.data ?? []).forEach(l => {
      const subjectRow = Array.isArray(l.subjects) ? l.subjects[0] : l.subjects;
      const list = linksByTeacher.get(l.teacher_id) ?? [];
      list.push({ id: l.subject_id, name: (subjectRow as { name: string } | null)?.name ?? "—" });
      linksByTeacher.set(l.teacher_id, list);
    });
    setTeachersList((teachersRes.data ?? []).map((t): SchoolTeacher => {
      const links = linksByTeacher.get(t.id) ?? [];
      return { id: t.id, fullName: t.full_name, teacherCode: t.teacher_code, email: t.email, phone: t.phone, status: t.status, subjectIds: links.map(l => l.id), subjectNames: links.map(l => l.name), requiredPeriods: requiredByTeacher.get(t.id) ?? 0, availableSlots: availableByTeacher.get(t.id) ?? 0 };
    }));
    setSubjectOptions((subjectsRes.data ?? []).map((s): SchoolSubject => ({ id: s.id, name: s.name, code: s.code, color: s.color, status: s.status })));
    setLoading(false);
  }, [schoolId, academicYearId]);

  useEffect(() => { if (!schoolLoading) load(); }, [schoolLoading, load]);

  async function saveTeacher(values: { fullName: string; teacherCode: string; email: string; phone: string; subjectIds: string[]; classSectionIds: string[] }) {
    const supabase = createClient();
    if (!supabase || !schoolId) return;
    const payload = { school_id: schoolId, full_name: values.fullName, teacher_code: values.teacherCode || null, email: values.email || null, phone: values.phone || null };
    let teacherId: string | undefined = teacherModal?.mode === "edit" ? teacherModal.teacher.id : undefined;
    if (teacherModal?.mode === "edit") {
      const { error } = await supabase.from("teachers").update(payload).eq("id", teacherModal.teacher.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { data, error } = await supabase.from("teachers").insert(payload).select("id").single();
      if (error) { toast.error(error.message); return; }
      teacherId = data.id;
    }
    if (teacherId) {
      await supabase.from("teacher_subjects").delete().eq("teacher_id", teacherId);
      if (values.subjectIds.length) {
        const { error: linkError } = await supabase.from("teacher_subjects").insert(values.subjectIds.map(subjectId => ({ teacher_id: teacherId, subject_id: subjectId, school_id: schoolId })));
        if (linkError) { toast.error(linkError.message); return; }
      }
      if (academicYearId && values.classSectionIds.length && values.subjectIds.length) {
        const rows = values.classSectionIds.flatMap(classSectionId => {
          const levelId = classOptions.find(c => c.id === classSectionId)?.levelId;
          if (!levelId) return [];
          return values.subjectIds.flatMap(subjectId => {
            const ls = levelSubjects.find(l => l.levelId === levelId && l.subjectId === subjectId);
            if (!ls) return [];
            return [{ school_id: schoolId, academic_year_id: academicYearId, teacher_id: teacherId, subject_id: subjectId, class_section_id: classSectionId, periods_per_week: ls.periodsPerWeek }];
          });
        });
        if (rows.length) {
          const { error: assignError } = await supabase.from("teaching_assignments").upsert(rows, { onConflict: "academic_year_id,teacher_id,subject_id,class_section_id", ignoreDuplicates: true });
          if (assignError) toast.error(assignError.message);
        }
      }
    }
    toast.success(teacherModal?.mode === "edit" ? "Teacher updated" : "Teacher created");
    setTeacherModal(null);
    load();
  }

  async function deleteTeacher(teacher: SchoolTeacher) {
    if (!window.confirm(`Remove ${teacher.fullName}?`)) return;
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.from("teachers").delete().eq("id", teacher.id);
    if (error) { toast.error(error.code === "23503" ? `Remove teaching assignments for ${teacher.fullName} before deleting them.` : error.message); return; }
    toast.success("Teacher removed");
    setOpenMenuId(null);
    load();
  }

  const filteredTeachers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachersList;
    return teachersList.filter(t => [
      t.fullName, t.teacherCode ?? "", t.email ?? "", t.phone ?? "", t.status, ...t.subjectNames,
      String(t.requiredPeriods), String(t.availableSlots),
    ].some(value => value.toLowerCase().includes(q)));
  }, [teachersList, search]);

  if (loadError) return <ErrorState message={loadError} onRetry={load} />;

  return <TableShell title="Teaching staff" count={filteredTeachers.length} button="Add teacher" onAdd={() => setTeacherModal({ mode: "add" })} searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search teachers…">
    {loading ? <div className="teacher-cards">{Array.from({ length: 3 }).map((_, i) => <article key={i}>
      <div className="teacher-top"><span className="avatar large skeleton" style={{ boxShadow: "none" }} /></div>
      <h3><Skel w="60%" /></h3>
      <p><Skel w="80%" /></p>
      <div className="load"><Skel w="100%" /><div className="progress"><i className="skeleton" style={{ width: "40%" }} /></div></div>
      <footer><Skel w="50%" /></footer>
    </article>)}</div> : teachersList.length === 0 ? (
      <div className="empty-inspector"><UsersRound /><h3>No teachers yet</h3><p>Add your first teacher to get started.</p></div>
    ) : filteredTeachers.length === 0 ? (
      <div className="empty-inspector"><UsersRound /><h3>No teachers found</h3><p>Try a different name, code, subject, phone, email, or workload.</p></div>
    ) : <div className="teacher-cards">
      {filteredTeachers.map(t => <article key={t.id}>
        <div className="teacher-top">
          <span className="avatar large">{t.fullName.split(" ").map(x => x[0]).join("")}</span>
          <div className="row-menu">
            <button className="more" onClick={() => setOpenMenuId(openMenuId === t.id ? null : t.id)}>•••</button>
            {openMenuId === t.id && <>
              <div className="row-menu-scrim" onClick={() => setOpenMenuId(null)} />
              <div className="row-menu-dropdown">
                <button onClick={() => { setTeacherModal({ mode: "edit", teacher: t }); setOpenMenuId(null); }}>Edit</button>
                <button onClick={() => deleteTeacher(t)}>Delete</button>
              </div>
            </>}
          </div>
        </div>
        <h3>{t.fullName}</h3>
        <p>{t.subjectNames.length ? t.subjectNames.join(" · ") : "No subjects assigned"}</p>
        <div className="load"><span>Weekly load <b>{t.requiredPeriods} periods</b></span><div className="progress"><i style={{ width: `${Math.min(100, t.requiredPeriods / 25 * 100)}%` }} /></div></div>
        <footer><span><CheckCircle2 /> {t.availableSlots} available slots</span></footer>
      </article>)}
    </div>}
    {teacherModal && <TeacherModal mode={teacherModal.mode} initial={teacherModal.mode === "edit" ? teacherModal.teacher : undefined} subjectOptions={subjectOptions} classOptions={classOptions} close={() => setTeacherModal(null)} onSave={saveTeacher} />}
  </TableShell>;
}
