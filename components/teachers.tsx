"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, Hash, Info, Mail, Phone, School2, Search, UserRound, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useSchool } from "@/lib/school-context";
import type { SchoolSubject, SchoolTeacher } from "@/lib/types";
import { ErrorState, Explainer, firstError, Skel, TableShell } from "@/components/shared";

function TeacherModal({ mode, initial, subjectOptions, classOptions, close, onSave }: { mode: "add" | "edit"; initial?: SchoolTeacher; subjectOptions: SchoolSubject[]; classOptions: { id: string; name: string; levelId: string }[]; close: () => void; onSave: (values: { fullName: string; teacherCode: string; email: string; phone: string; subjectIds: string[]; classSectionIds: string[] }) => Promise<void> }) {
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [teacherCode, setTeacherCode] = useState(initial?.teacherCode ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [subjectIds, setSubjectIds] = useState<string[]>(initial?.subjectIds ?? []);
  const [classSectionIds, setClassSectionIds] = useState<string[]>([]);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [classSearch, setClassSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const toggleSubject = (id: string) => setSubjectIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  const toggleClass = (id: string) => setClassSectionIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  const subjectQuery = subjectSearch.trim().toLowerCase();
  const classQuery = classSearch.trim().toLowerCase();
  const filteredSubjects = subjectOptions.filter(subject => !subjectQuery || [subject.name, subject.code ?? ""].some(value => value.toLowerCase().includes(subjectQuery)));
  const filteredClasses = classOptions.filter(classSection => !classQuery || classSection.name.toLowerCase().includes(classQuery));

  return <div className="modal-backdrop"><form className="modal teacher-modal" onSubmit={async e => { e.preventDefault(); if (!fullName.trim()) return; setSaving(true); await onSave({ fullName: fullName.trim(), teacherCode: teacherCode.trim(), email: email.trim(), phone: phone.trim(), subjectIds, classSectionIds }); setSaving(false); }}>
    <div className="modal-head teacher-modal-head"><div className="teacher-modal-title"><span><UsersRound /></span><div><h2>{mode === "edit" ? "Edit teacher" : "Add teacher"}</h2><p>Add contact details and teaching responsibilities.</p></div></div><button type="button" className="icon-btn" aria-label="Close teacher form" onClick={close}><X /></button></div>
    <div className="teacher-details-grid">
      <label className="teacher-field teacher-name-field"><span><UserRound />Full name</span><input required autoFocus value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Enter full name" /></label>
      <label className="teacher-field"><span><Hash />Teacher code</span><input value={teacherCode} onChange={e => setTeacherCode(e.target.value)} placeholder="e.g. T-001" /></label>
      <label className="teacher-field"><span><Mail />Email address</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="teacher@school.com" /></label>
      <label className="teacher-field"><span><Phone />Phone number</span><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Enter phone number" /></label>
    </div>
    <div className="teacher-assignment-note"><Info /><div><b>How teaching assignments are created</b><p>Selecting subjects records what this teacher can teach. When you also select classes, ClassGrid creates an assignment for every selected subject that each class level offers, using that level's weekly period requirement.{mode === "edit" ? " Existing assignments are changed or removed from the Teaching assignments page." : " Selecting subjects without classes does not create class assignments."}</p></div></div>
    <div className="teacher-selection-grid">
      <fieldset className="teacher-selector"><div className="teacher-selector-head"><div><BookOpen /><span><b>Subjects taught</b><small>{subjectIds.length} selected</small></span></div>{subjectIds.length > 0 && <button type="button" onClick={() => setSubjectIds([])}>Clear</button>}</div>
        <div className="teacher-selector-search"><Search /><input aria-label="Search subjects" value={subjectSearch} onChange={e => setSubjectSearch(e.target.value)} placeholder="Search subjects" /></div>
        {subjectOptions.length === 0 ? <small className="teacher-selector-empty">Add subjects first to assign them here.</small> : filteredSubjects.length === 0 ? <small className="teacher-selector-empty">No matching subjects.</small> : <div className="teacher-option-list">
          {filteredSubjects.map(subject => <label key={subject.id} className={subjectIds.includes(subject.id) ? "teacher-option selected" : "teacher-option"}><input type="checkbox" checked={subjectIds.includes(subject.id)} onChange={() => toggleSubject(subject.id)} /><i style={{ background: subject.color }} /><span><b>{subject.name}</b>{subject.code && <small>{subject.code}</small>}</span></label>)}
        </div>}
      </fieldset>
      <fieldset className="teacher-selector"><div className="teacher-selector-head"><div><School2 /><span><b>Classes taught</b><small>{classSectionIds.length} selected</small></span></div>{classSectionIds.length > 0 && <button type="button" onClick={() => setClassSectionIds([])}>Clear</button>}</div>
        <div className="teacher-selector-search"><Search /><input aria-label="Search classes" value={classSearch} onChange={e => setClassSearch(e.target.value)} placeholder="Search classes" /></div>
        {classOptions.length === 0 ? <small className="teacher-selector-empty">Add class sections first to assign them here.</small> : filteredClasses.length === 0 ? <small className="teacher-selector-empty">No matching classes.</small> : <div className="teacher-option-list">
          {filteredClasses.map(classSection => <label key={classSection.id} className={classSectionIds.includes(classSection.id) ? "teacher-option selected" : "teacher-option"}><input type="checkbox" checked={classSectionIds.includes(classSection.id)} onChange={() => toggleClass(classSection.id)} /><span><b>{classSection.name}</b><small>Creates matching assignments</small></span></label>)}
        </div>}
      </fieldset>
    </div>
    <footer><span className="teacher-selection-note">{subjectIds.length} subject{subjectIds.length === 1 ? "" : "s"} · {classSectionIds.length} class{classSectionIds.length === 1 ? "" : "es"}</span><button type="button" className="btn" onClick={close}>Cancel</button><button className="btn primary" disabled={saving || !fullName.trim()}>{saving ? "Saving…" : `Save ${mode === "edit" ? "changes" : "teacher"}`}</button></footer>
  </form></div>;
}

export function Teachers() {
  const { schoolId, academicYearId, loading: schoolLoading } = useSchool();
  const [teachersList, setTeachersList] = useState<SchoolTeacher[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<SchoolSubject[]>([]);
  const [classOptions, setClassOptions] = useState<{ id: string; name: string; levelId: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [teacherModal, setTeacherModal] = useState<{ mode: "add" } | { mode: "edit"; teacher: SchoolTeacher } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !schoolId) { setTeachersList([]); setSubjectOptions([]); setClassOptions([]); setLoading(false); return; }
    setLoading(true); setLoadError(null);
    const [teachersRes, subjectsRes, linksRes] = await Promise.all([
      supabase.from("teachers").select("id, full_name, teacher_code, email, phone, status").eq("school_id", schoolId).order("full_name"),
      supabase.from("subjects").select("id, name, code, color, status").eq("school_id", schoolId).order("name"),
      supabase.from("teacher_subjects").select("teacher_id, subject_id, subjects(name)").eq("school_id", schoolId),
    ]);
    const err0 = firstError(teachersRes, subjectsRes, linksRes);
    if (err0) { setLoadError(err0); setLoading(false); return; }
    let requiredByTeacher = new Map<string, number>();
    let unavailableByTeacher = new Map<string, number>();
    let totalWeeklySlots = 0;
    if (academicYearId) {
      const [assignmentsRes, availabilityRes, classesRes, daysRes, periodsRes] = await Promise.all([
        supabase.from("teaching_assignments").select("teacher_id, periods_per_week").eq("school_id", schoolId).eq("academic_year_id", academicYearId),
        supabase.from("teacher_availability").select("teacher_id").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("is_available", false),
        supabase.from("class_sections").select("id, name, level_id").eq("school_id", schoolId).eq("academic_year_id", academicYearId).order("name"),
        supabase.from("working_days").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("is_active", true),
        supabase.from("period_slots").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("kind", "lesson"),
      ]);
      const err1 = firstError(assignmentsRes, availabilityRes, classesRes, daysRes, periodsRes);
      if (err1) { setLoadError(err1); setLoading(false); return; }
      totalWeeklySlots = (daysRes.count ?? 0) * (periodsRes.count ?? 0);
      (assignmentsRes.data ?? []).forEach(a => requiredByTeacher.set(a.teacher_id, (requiredByTeacher.get(a.teacher_id) ?? 0) + a.periods_per_week));
      (availabilityRes.data ?? []).forEach(a => unavailableByTeacher.set(a.teacher_id, (unavailableByTeacher.get(a.teacher_id) ?? 0) + 1));
      setClassOptions((classesRes.data ?? []).map(c => ({ id: c.id, name: c.name, levelId: c.level_id })));
    } else {
      setClassOptions([]);
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
      return { id: t.id, fullName: t.full_name, teacherCode: t.teacher_code, email: t.email, phone: t.phone, status: t.status, subjectIds: links.map(l => l.id), subjectNames: links.map(l => l.name), requiredPeriods: requiredByTeacher.get(t.id) ?? 0, availableSlots: Math.max(0, totalWeeklySlots - (unavailableByTeacher.get(t.id) ?? 0)) };
    }));
    setSubjectOptions((subjectsRes.data ?? []).map((s): SchoolSubject => ({ id: s.id, name: s.name, code: s.code, color: s.color, status: s.status })));
    setLoading(false);
  }, [schoolId, academicYearId]);

  useEffect(() => { if (!schoolLoading) load(); }, [schoolLoading, load]);

  async function saveTeacher(values: { fullName: string; teacherCode: string; email: string; phone: string; subjectIds: string[]; classSectionIds: string[] }) {
    const supabase = createClient();
    if (!supabase || !schoolId) return;
    const { error } = await supabase.rpc("save_teacher_with_relationships", {
      p_school_id: schoolId,
      p_academic_year_id: academicYearId,
      p_teacher_id: teacherModal?.mode === "edit" ? teacherModal.teacher.id : null,
      p_full_name: values.fullName,
      p_teacher_code: values.teacherCode,
      p_email: values.email,
      p_phone: values.phone,
      p_subject_ids: values.subjectIds,
      p_class_section_ids: values.classSectionIds,
    });
    if (error) { toast.error(error.message); return; }
    await load();
    toast.success(teacherModal?.mode === "edit" ? "Teacher updated" : "Teacher created");
    setTeacherModal(null);
  }

  async function deleteTeacher(teacher: SchoolTeacher) {
    if (!window.confirm(`Remove ${teacher.fullName}?`)) return;
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.from("teachers").delete().eq("id", teacher.id);
    if (error) { toast.error(error.code === "23503" ? `Remove teaching assignments for ${teacher.fullName} before deleting them.` : error.message); return; }
    toast.success("Teacher removed");
    setOpenMenuId(null);
    setTeachersList(teachers => teachers.filter(item => item.id !== teacher.id));
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

  return <div className="setup-page-stack"><Explainer title="Teacher profiles connect people to the timetable">Record what each teacher can teach here. Selecting subjects and classes together can create matching assignments; unavailable times are configured separately on Availability.</Explainer><TableShell title="Teaching staff" count={filteredTeachers.length} button="Add teacher" onAdd={() => setTeacherModal({ mode: "add" })} searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search teachers…">
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
  </TableShell></div>;
}
