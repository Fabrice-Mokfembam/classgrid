"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, MoreHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useSchool } from "@/lib/school-context";
import type { SchoolSubject } from "@/lib/types";
import { ErrorState, Explainer, firstError, RowsSkeleton, TableShell } from "@/components/shared";

const SUBJECT_COLOR_PRESETS = ["#3b82f6", "#8b5cf6", "#22a06b", "#f97362", "#a855f7", "#f59e0b"];

function SubjectModal({ mode, initial, close, onSave }: { mode: "add" | "edit"; initial?: SchoolSubject; close: () => void; onSave: (values: { name: string; code: string; color: string }) => Promise<void> }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [color, setColor] = useState(initial?.color ?? SUBJECT_COLOR_PRESETS[0]);
  const [saving, setSaving] = useState(false);
  return <div className="modal-backdrop"><form className="modal" onSubmit={async e => { e.preventDefault(); if (!name.trim()) return; setSaving(true); await onSave({ name: name.trim(), code: code.trim(), color }); setSaving(false); }}>
    <div className="modal-head"><div><h2>{mode === "edit" ? "Edit subject" : "Add subject"}</h2><p>Enter the information used by the timetable generator.</p></div><button type="button" className="icon-btn" onClick={close}><X /></button></div>
    <label>Subject name<input required autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mathematics" /></label>
    <label>Subject code<input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. MATH" /></label>
    <label>Display colour<div className="color-picker">
      {SUBJECT_COLOR_PRESETS.map(c => <button type="button" key={c} className={c === color ? "swatch-btn selected" : "swatch-btn"} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />)}
      <input type="color" value={color} onChange={e => setColor(e.target.value)} aria-label="Custom colour" />
    </div></label>
    <footer><button type="button" className="btn" onClick={close}>Cancel</button><button className="btn primary" disabled={saving}>{saving ? "Saving…" : `Save ${mode === "edit" ? "changes" : "subject"}`}</button></footer>
  </form></div>;
}

export function Subjects() {
  const { schoolId, loading: schoolLoading } = useSchool();
  const [subjectsList, setSubjectsList] = useState<SchoolSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [subjectModal, setSubjectModal] = useState<{ mode: "add" } | { mode: "edit"; subject: SchoolSubject } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !schoolId) { setSubjectsList([]); setLoading(false); return; }
    setLoading(true); setLoadError(null);
    const { data, error } = await supabase.from("subjects").select("id, name, code, color, status").eq("school_id", schoolId).order("name");
    if (error) { setLoadError(error.message); setLoading(false); return; }
    setSubjectsList((data ?? []).map((s): SchoolSubject => ({ id: s.id, name: s.name, code: s.code, color: s.color, status: s.status })));
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { if (!schoolLoading) load(); }, [schoolLoading, load]);

  async function saveSubject(values: { name: string; code: string; color: string }) {
    const supabase = createClient();
    if (!supabase || !schoolId) return;
    const payload = { school_id: schoolId, name: values.name, code: values.code || null, color: values.color };
    const { data, error } = subjectModal?.mode === "edit"
      ? await supabase.from("subjects").update(payload).eq("id", subjectModal.subject.id).select("id, name, code, color, status").single()
      : await supabase.from("subjects").insert(payload).select("id, name, code, color, status").single();
    if (error) { toast.error(error.message); return; }
    const savedSubject: SchoolSubject = { id: data.id, name: data.name, code: data.code, color: data.color, status: data.status };
    setSubjectsList(subjects => (subjectModal?.mode === "edit"
      ? subjects.map(subject => subject.id === savedSubject.id ? savedSubject : subject)
      : [...subjects, savedSubject]).sort((a, b) => a.name.localeCompare(b.name)));
    toast.success(subjectModal?.mode === "edit" ? "Subject updated" : "Subject created");
    setSubjectModal(null);
  }

  async function deleteSubject(subject: SchoolSubject) {
    if (!window.confirm(`Remove ${subject.name}?`)) return;
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.from("subjects").delete().eq("id", subject.id);
    if (error) { toast.error(error.code === "23503" ? `Remove teaching assignments using ${subject.name} before deleting it.` : error.message); return; }
    toast.success("Subject removed");
    setOpenMenuId(null);
    setSubjectsList(subjects => subjects.filter(item => item.id !== subject.id));
  }

  const filteredSubjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subjectsList.filter(subject => {
      if (statusFilter !== "all" && subject.status !== statusFilter) return false;
      return !q || [subject.name, subject.code ?? "", subject.status].some(value => value.toLowerCase().includes(q));
    });
  }, [subjectsList, search, statusFilter]);

  const activeCount = subjectsList.filter(subject => subject.status === "active").length;
  const inactiveCount = subjectsList.length - activeCount;

  if (loadError) return <ErrorState message={loadError} onRetry={load} />;

  return <div className="subjects-page">
    <Explainer title="This is the school-wide subject catalogue">Adding a subject here makes it available to the school. You still choose which levels teach it and set its weekly periods from Levels & classes.</Explainer>
    <section className="subjects-overview" aria-label="Subject summary">
      <div><span>Total subjects</span><b>{subjectsList.length}</b></div>
      <div><span>Active</span><b>{activeCount}</b></div>
      <div><span>Inactive</span><b>{inactiveCount}</b></div>
    </section>
    <TableShell title="Subject catalogue" count={filteredSubjects.length} button="Add subject" onAdd={() => setSubjectModal({ mode: "add" })} searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search subjects…" toolbarExtra={
      <div className="segmented subject-status-filter" aria-label="Filter subjects by status">
        {(["all", "active", "inactive"] as const).map(status => <button type="button" key={status} className={statusFilter === status ? "active" : ""} onClick={() => setStatusFilter(status)}>{status[0].toUpperCase() + status.slice(1)}</button>)}
      </div>
    }>
    {loading ? <div className="data-table"><div className="data-row head subjects"><span>Subject</span><span>Code</span><span>Display colour</span><span>Status</span><span></span></div><RowsSkeleton className="data-row subjects" cols={4} rows={5} /></div> : subjectsList.length === 0 ? (
      <div className="empty-inspector"><BookOpen /><h3>No subjects yet</h3><p>Add your first subject to get started. Once you have some, head to Levels → Manage subjects to decide which levels teach them and their weekly periods.</p></div>
    ) : filteredSubjects.length === 0 ? (
      <div className="empty-inspector"><BookOpen /><h3>No subjects found</h3><p>Try a different subject name, code, or status.</p></div>
    ) : <div className="data-table">
      <div className="data-row head subjects"><span>Subject</span><span>Code</span><span>Display colour</span><span>Status</span><span></span></div>
      {filteredSubjects.map(s => <div className="data-row subjects" key={s.id}>
        <span><i className="color-dot" style={{ background: s.color }} /><b>{s.name}</b></span>
        <span><i className="subject-code">{s.code ?? "—"}</i></span>
        <span className="subject-colour"><i className="color-swatch" style={{ background: s.color }} /><small>{s.color}</small></span>
        <span><i className={s.status === "active" ? "status-pill success" : "status-pill"}>{s.status === "active" ? "Active" : "Inactive"}</i></span>
        <div className="row-menu">
          <button className="more icon-btn" aria-label={`Actions for ${s.name}`} title={`Actions for ${s.name}`} onClick={() => setOpenMenuId(openMenuId === s.id ? null : s.id)}><MoreHorizontal /></button>
          {openMenuId === s.id && <>
            <div className="row-menu-scrim" onClick={() => setOpenMenuId(null)} />
            <div className="row-menu-dropdown">
              <button onClick={() => { setSubjectModal({ mode: "edit", subject: s }); setOpenMenuId(null); }}>Edit</button>
              <button className="danger-action" onClick={() => deleteSubject(s)}>Delete</button>
            </div>
          </>}
        </div>
      </div>)}
    </div>}
    {subjectModal && <SubjectModal mode={subjectModal.mode} initial={subjectModal.mode === "edit" ? subjectModal.subject : undefined} close={() => setSubjectModal(null)} onSave={saveSubject} />}
  </TableShell>
  </div>;
}
