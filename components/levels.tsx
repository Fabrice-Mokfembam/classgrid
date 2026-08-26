"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Clock3, Layers3, Plus, Search, School2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useSchool } from "@/lib/school-context";
import type { ClassSection, Level, LevelSubjectRow, ParallelGroup, SchoolSubject } from "@/lib/types";
import { ErrorState, Explainer, firstError, RowsSkeleton, Skel, TableShell } from "@/components/shared";

function LevelModal({ mode, initial, close, onSave }: { mode: "add" | "edit"; initial?: Level; close: () => void; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [saving, setSaving] = useState(false);
  return <div className="modal-backdrop"><form className="modal" onSubmit={async e => { e.preventDefault(); if (!name.trim()) return; setSaving(true); await onSave(name.trim()); setSaving(false); }}>
    <div className="modal-head"><div><h2>{mode === "edit" ? "Edit level" : "Add level"}</h2><p>A broad grouping such as Form 1 or Primary.</p></div><button type="button" className="icon-btn" onClick={close}><X /></button></div>
    <label>Level name<input required autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Form 1" /></label>
    <footer><button type="button" className="btn" onClick={close}>Cancel</button><button className="btn primary" disabled={saving}>{saving ? "Saving…" : "Save level"}</button></footer>
  </form></div>;
}

function ClassSectionModal({ mode, initial, levels, close, onSave }: { mode: "add" | "edit"; initial?: ClassSection; levels: Level[]; close: () => void; onSave: (values: { name: string; levelId: string; studentCount: string }) => Promise<void> }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [levelId, setLevelId] = useState(initial?.levelId ?? "");
  const [studentCount, setStudentCount] = useState(initial?.studentCount != null ? String(initial.studentCount) : "");
  const [saving, setSaving] = useState(false);
  return <div className="modal-backdrop"><form className="modal" onSubmit={async e => { e.preventDefault(); if (!name.trim() || !levelId) return; setSaving(true); await onSave({ name: name.trim(), levelId, studentCount }); setSaving(false); }}>
    <div className="modal-head"><div><h2>{mode === "edit" ? "Edit class section" : "Add class section"}</h2><p>Enter the information used by the timetable generator.</p></div><button type="button" className="icon-btn" onClick={close}><X /></button></div>
    <label>Class name<input required autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Form 1A" /></label>
    <label>Level<select required value={levelId} onChange={e => setLevelId(e.target.value)}><option value="">Select level</option>{levels.map(l => <option value={l.id} key={l.id}>{l.name}</option>)}</select></label>
    <label>Estimated students<input type="number" min="0" value={studentCount} onChange={e => setStudentCount(e.target.value)} placeholder="Enter estimated students" /></label>
    <footer><button type="button" className="btn" onClick={close}>Cancel</button><button className="btn primary" disabled={saving}>{saving ? "Saving…" : `Save ${mode === "edit" ? "changes" : "class section"}`}</button></footer>
  </form></div>;
}

function LevelSubjectsModal({ level, schoolId, close }: { level: Level; schoolId: string; close: () => void }) {
  const [subjectsCatalog, setSubjectsCatalog] = useState<SchoolSubject[]>([]);
  const [rows, setRows] = useState<LevelSubjectRow[]>([]);
  const [groups, setGroups] = useState<ParallelGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busySubjectId, setBusySubjectId] = useState<string | null>(null);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [subjectView, setSubjectView] = useState<"all" | "selected">("all");

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;
    setLoading(true); setLoadError(null);
    const [subjectsRes, rowsRes, groupsRes] = await Promise.all([
      supabase.from("subjects").select("id, name, code, color, status").eq("school_id", schoolId).order("name"),
      supabase.from("level_subjects").select("id, subject_id, periods_per_week, stream_label").eq("level_id", level.id),
      supabase.from("parallel_subject_groups").select("id, name").eq("level_id", level.id).order("created_at"),
    ]);
    const err = firstError(subjectsRes, rowsRes, groupsRes);
    if (err) { setLoadError(err); setLoading(false); return; }
    const rowIds = (rowsRes.data ?? []).map(r => r.id);
    const membershipsRes = rowIds.length ? await supabase.from("level_subject_parallel_groups").select("level_subject_id, parallel_group_id").in("level_subject_id", rowIds) : { data: [], error: null };
    if (membershipsRes.error) { setLoadError(membershipsRes.error.message); setLoading(false); return; }
    const membershipsByRow = new Map<string, string[]>();
    (membershipsRes.data ?? []).forEach(m => membershipsByRow.set(m.level_subject_id, [...(membershipsByRow.get(m.level_subject_id) ?? []), m.parallel_group_id]));
    setSubjectsCatalog((subjectsRes.data ?? []).map((s): SchoolSubject => ({ id: s.id, name: s.name, code: s.code, color: s.color, status: s.status })));
    setRows((rowsRes.data ?? []).map((r): LevelSubjectRow => ({ id: r.id, subjectId: r.subject_id, periodsPerWeek: r.periods_per_week, streamLabel: r.stream_label, parallelGroupIds: membershipsByRow.get(r.id) ?? [] })));
    setGroups((groupsRes.data ?? []).map((g): ParallelGroup => ({ id: g.id, name: g.name })));
    setLoading(false);
  }, [schoolId, level.id]);

  useEffect(() => { load(); }, [load]);

  async function toggleSubject(subjectId: string, on: boolean) {
    const supabase = createClient();
    if (!supabase) return;
    setBusySubjectId(subjectId);
    if (on) {
      const { data, error } = await supabase.from("level_subjects")
        .insert({ school_id: schoolId, level_id: level.id, subject_id: subjectId, periods_per_week: 1 })
        .select("id, subject_id, periods_per_week, stream_label")
        .single();
      if (error) toast.error(error.message);
      else setRows(rs => [...rs, { id: data.id, subjectId: data.subject_id, periodsPerWeek: data.periods_per_week, streamLabel: data.stream_label, parallelGroupIds: [] }]);
    } else {
      const row = rows.find(r => r.subjectId === subjectId);
      if (row) {
        const { error } = await supabase.from("level_subjects").delete().eq("id", row.id);
        if (error) toast.error(error.message);
        else setRows(rs => rs.filter(r => r.id !== row.id));
      }
    }
    setBusySubjectId(null);
  }

  async function updateRow(row: LevelSubjectRow, patch: { periods_per_week?: number; stream_label?: string | null }) {
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.from("level_subjects").update(patch).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    setRows(rs => rs.map(r => r.id === row.id ? {
      ...r,
      periodsPerWeek: patch.periods_per_week ?? r.periodsPerWeek,
      streamLabel: patch.stream_label === undefined ? r.streamLabel : patch.stream_label,
    } : r));
  }

  async function toggleGroupMembership(row: LevelSubjectRow, groupId: string, on: boolean) {
    const supabase = createClient();
    if (!supabase) return;
    const { error } = on
      ? await supabase.from("level_subject_parallel_groups").insert({ level_subject_id: row.id, parallel_group_id: groupId })
      : await supabase.from("level_subject_parallel_groups").delete().eq("level_subject_id", row.id).eq("parallel_group_id", groupId);
    if (error) { toast.error(error.message); return; }
    setRows(rs => rs.map(r => r.id === row.id ? {
      ...r,
      parallelGroupIds: on ? [...new Set([...r.parallelGroupIds, groupId])] : r.parallelGroupIds.filter(id => id !== groupId),
    } : r));
  }

  async function addGroup() {
    const supabase = createClient();
    if (!supabase) return;
    const { data, error } = await supabase.from("parallel_subject_groups")
      .insert({ school_id: schoolId, level_id: level.id, name: null })
      .select("id, name")
      .single();
    if (error) { toast.error(error.message); return; }
    setGroups(gs => [...gs, { id: data.id, name: data.name }]);
  }

  async function renameGroup(group: ParallelGroup, name: string) {
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.from("parallel_subject_groups").update({ name: name || null }).eq("id", group.id);
    if (error) toast.error(error.message);
    else setGroups(gs => gs.map(g => g.id === group.id ? { ...g, name: name || null } : g));
  }

  async function deleteGroup(group: ParallelGroup) {
    if (!window.confirm("Delete this parallel group? Its subjects will no longer be treated as parallel-compatible.")) return;
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.from("parallel_subject_groups").delete().eq("id", group.id);
    if (error) { toast.error(error.message); return; }
    setGroups(gs => gs.filter(g => g.id !== group.id));
    setRows(rs => rs.map(r => ({ ...r, parallelGroupIds: r.parallelGroupIds.filter(id => id !== group.id) })));
  }

  const subjectQuery = subjectSearch.trim().toLowerCase();
  const filteredCatalog = subjectsCatalog.filter(subject => {
    const selected = rows.some(row => row.subjectId === subject.id);
    if (subjectView === "selected" && !selected) return false;
    return !subjectQuery || [subject.name, subject.code ?? ""].some(value => value.toLowerCase().includes(subjectQuery));
  });
  const totalWeeklyPeriods = rows.reduce((sum, row) => sum + row.periodsPerWeek, 0);

  return <div className="modal-backdrop">
    <div className="modal level-subject-modal">
      <div className="modal-head level-subject-modal-head"><div className="level-subject-modal-title"><span><BookOpen /></span><div><h2>Subjects for {level.name}</h2><p>Set the curriculum, weekly periods, and parallel options for this level.</p></div></div><button type="button" className="icon-btn" aria-label="Close subject manager" onClick={close}><X /></button></div>
      <div className="level-subject-modal-body">
        {loadError ? <ErrorState message={loadError} onRetry={load} /> : loading ? <div className="level-subject-loading"><Skel w="100%" /><Skel w="100%" /><Skel w="100%" /></div> : <>
          <section className="level-subject-summary" aria-label="Level subject summary">
            <div><BookOpen /><span><b>{rows.length}</b><small>Subjects selected</small></span></div>
            <div><Clock3 /><span><b>{totalWeeklyPeriods}</b><small>Periods per week</small></span></div>
            <div><Layers3 /><span><b>{groups.length}</b><small>Parallel groups</small></span></div>
          </section>

          <section className="level-subject-catalogue">
            <div className="level-subject-toolbar"><div><h3>Level curriculum</h3><p>Choose subjects and set how often each one is taught.</p></div><div className="level-subject-tools"><div className="segmented"><button type="button" className={subjectView === "all" ? "active" : ""} onClick={() => setSubjectView("all")}>All</button><button type="button" className={subjectView === "selected" ? "active" : ""} onClick={() => setSubjectView("selected")}>Selected</button></div><label className="level-subject-search"><Search /><input aria-label="Search level subjects" value={subjectSearch} onChange={e => setSubjectSearch(e.target.value)} placeholder="Search subjects" /></label></div></div>
            {subjectsCatalog.length === 0 ? <div className="level-subject-empty"><BookOpen /><b>No subjects available</b><span>Add subjects to the school catalogue first.</span></div> : filteredCatalog.length === 0 ? <div className="level-subject-empty"><Search /><b>No matching subjects</b><span>Try another search or switch to All.</span></div> : <div className="level-subject-list">
              <div className="level-subject-row level-subject-row-head"><span>Subject</span><span>Periods/week</span><span>Parallel group</span></div>
              {filteredCatalog.map(subject => {
                const row = rows.find(item => item.subjectId === subject.id);
                return <div className={`level-subject-row${row ? " selected" : ""}`} key={subject.id}>
                  <label className="level-subject-choice"><input type="checkbox" checked={!!row} disabled={busySubjectId === subject.id} onChange={e => toggleSubject(subject.id, e.target.checked)} /><i className="color-dot" style={{ background: subject.color }} /><span><b>{subject.name}</b>{subject.code && <small>{subject.code}</small>}</span></label>
                  {row ? <input className="level-period-input" type="number" min={1} value={row.periodsPerWeek} onChange={e => {
                    const periods = Math.max(1, Number(e.target.value) || 1);
                    setRows(items => items.map(item => item.id === row.id ? { ...item, periodsPerWeek: periods } : item));
                  }} onBlur={e => updateRow(row, { periods_per_week: Math.max(1, Number(e.target.value) || 1) })} aria-label={`${subject.name} periods per week`} /> : <span className="level-subject-muted">Not taught</span>}
                  {row ? groups.length === 0 ? <span className="level-subject-muted">No groups created</span> : <div className="group-toggle-list">
                    {groups.map(group => <label className={`group-toggle${row.parallelGroupIds.includes(group.id) ? " on" : ""}`} key={group.id}><input type="checkbox" checked={row.parallelGroupIds.includes(group.id)} onChange={e => toggleGroupMembership(row, group.id, e.target.checked)} />{group.name || "Unnamed group"}</label>)}
                  </div> : <span />}
                </div>;
              })}
            </div>}
          </section>

          <section className="parallel-group-section">
            <div className="parallel-group-section-head"><div><h3>Parallel groups</h3><p>Group optional subjects that may share the same timetable period.</p></div><button type="button" className="btn" onClick={addGroup}><Plus /> New group</button></div>
            {groups.length === 0 ? <div className="parallel-group-empty"><Layers3 /><div><b>No parallel groups</b><span>Create one only when students choose between subjects, such as Commerce or Computer Science.</span></div></div> : <div className="parallel-group-list">
              {groups.map(group => {
                const members = rows.filter(row => row.parallelGroupIds.includes(group.id)).map(row => subjectsCatalog.find(subject => subject.id === row.subjectId)?.name ?? "—");
                return <div className="parallel-group-row" key={group.id}><Layers3 /><input value={group.name ?? ""} onChange={e => setGroups(items => items.map(item => item.id === group.id ? { ...item, name: e.target.value } : item))} onBlur={e => renameGroup(group, e.target.value.trim())} placeholder="Name this group" aria-label="Parallel group name" /><div className="parallel-group-members">{members.length ? members.map(member => <span key={member}>{member}</span>) : <small>No subjects assigned</small>}</div><button type="button" className="icon-btn danger-icon" onClick={() => deleteGroup(group)} aria-label="Delete parallel group"><Trash2 /></button></div>;
              })}
            </div>}
          </section>
        </>}
      </div>
      <footer><span>{rows.length} subject{rows.length === 1 ? "" : "s"} configured for {level.name}</span><button type="button" className="btn primary" onClick={close}>Done</button></footer>
    </div>
  </div>;
}

export function Levels() {
  const { schoolId, academicYearId, loading: schoolLoading } = useSchool();
  const [levels, setLevels] = useState<Level[]>([]);
  const [sections, setSections] = useState<ClassSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [levelModal, setLevelModal] = useState<{ mode: "add" } | { mode: "edit"; level: Level } | null>(null);
  const [sectionModal, setSectionModal] = useState<{ mode: "add" } | { mode: "edit"; section: ClassSection } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [levelSubjectCounts, setLevelSubjectCounts] = useState<Map<string, number>>(new Map());
  const [subjectsModalLevel, setSubjectsModalLevel] = useState<Level | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !schoolId || !academicYearId) { setLevels([]); setSections([]); setLevelSubjectCounts(new Map()); setLoading(false); return; }
    setLoading(true); setLoadError(null);
    const [levelsRes, sectionsRes, levelSubjectsRes] = await Promise.all([
      supabase.from("levels").select("id, name, sort_order, status").eq("school_id", schoolId).eq("academic_year_id", academicYearId).order("sort_order"),
      supabase.from("class_sections").select("id, name, student_count, status, level_id, levels(name)").eq("school_id", schoolId).eq("academic_year_id", academicYearId).order("name"),
      supabase.from("level_subjects").select("level_id").eq("school_id", schoolId),
    ]);
    const err = firstError(levelsRes, sectionsRes, levelSubjectsRes);
    if (err) { setLoadError(err); setLoading(false); return; }
    setLevels((levelsRes.data ?? []).map((l): Level => ({ id: l.id, name: l.name, sortOrder: l.sort_order, status: l.status })));
    setSections((sectionsRes.data ?? []).map((s): ClassSection => {
      const levelRow = Array.isArray(s.levels) ? s.levels[0] : s.levels;
      return { id: s.id, name: s.name, levelId: s.level_id, levelName: (levelRow as { name: string } | null)?.name ?? "—", studentCount: s.student_count, status: s.status };
    }));
    const counts = new Map<string, number>();
    (levelSubjectsRes.data ?? []).forEach(r => counts.set(r.level_id, (counts.get(r.level_id) ?? 0) + 1));
    setLevelSubjectCounts(counts);
    setLoading(false);
  }, [schoolId, academicYearId]);

  useEffect(() => { if (!schoolLoading) load(); }, [schoolLoading, load]);

  async function refreshLevelSubjectCount(levelId: string) {
    const supabase = createClient();
    if (!supabase || !schoolId) return;
    const { count, error } = await supabase.from("level_subjects").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("level_id", levelId);
    if (error) { toast.error(error.message); return; }
    setLevelSubjectCounts(counts => {
      const next = new Map(counts);
      next.set(levelId, count ?? 0);
      return next;
    });
  }

  async function saveLevel(name: string) {
    const supabase = createClient();
    if (!supabase || !schoolId || !academicYearId) return;
    if (levelModal?.mode === "edit") {
      const { data, error } = await supabase.from("levels").update({ name }).eq("id", levelModal.level.id).select("id, name, sort_order, status").single();
      if (error) { toast.error(error.message); return; }
      const savedLevel: Level = { id: data.id, name: data.name, sortOrder: data.sort_order, status: data.status };
      setLevels(items => items.map(level => level.id === savedLevel.id ? savedLevel : level));
      setSections(items => items.map(section => section.levelId === savedLevel.id ? { ...section, levelName: savedLevel.name } : section));
      toast.success("Level updated");
    } else {
      const nextOrder = levels.length ? Math.max(...levels.map(l => l.sortOrder)) + 1 : 1;
      const { data, error } = await supabase.from("levels").insert({ school_id: schoolId, academic_year_id: academicYearId, name, sort_order: nextOrder }).select("id, name, sort_order, status").single();
      if (error) { toast.error(error.message); return; }
      const savedLevel: Level = { id: data.id, name: data.name, sortOrder: data.sort_order, status: data.status };
      setLevels(items => [...items, savedLevel].sort((a, b) => a.sortOrder - b.sortOrder));
      setLevelSubjectCounts(counts => new Map(counts).set(savedLevel.id, 0));
      toast.success("Level added");
    }
    setLevelModal(null);
  }

  async function deleteLevel(level: Level) {
    if (!window.confirm(`Remove ${level.name}?`)) return;
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.from("levels").delete().eq("id", level.id);
    if (error) {
      toast.error(error.code === "23503" ? `Move or remove class sections in ${level.name} before deleting it.` : error.message);
      return;
    }
    toast.success("Level removed");
    setLevels(items => items.filter(item => item.id !== level.id));
    setLevelSubjectCounts(counts => {
      const next = new Map(counts);
      next.delete(level.id);
      return next;
    });
  }

  async function saveSection(values: { name: string; levelId: string; studentCount: string }) {
    const supabase = createClient();
    if (!supabase || !schoolId || !academicYearId) return;
    const payload = { school_id: schoolId, academic_year_id: academicYearId, level_id: values.levelId, name: values.name, student_count: values.studentCount ? Number(values.studentCount) : null };
    const { data, error } = sectionModal?.mode === "edit"
      ? await supabase.from("class_sections").update(payload).eq("id", sectionModal.section.id).select("id, name, student_count, status, level_id").single()
      : await supabase.from("class_sections").insert(payload).select("id, name, student_count, status, level_id").single();
    if (error) { toast.error(error.message); return; }
    const savedSection: ClassSection = {
      id: data.id,
      name: data.name,
      levelId: data.level_id,
      levelName: levels.find(level => level.id === data.level_id)?.name ?? "—",
      studentCount: data.student_count,
      status: data.status,
    };
    setSections(items => (sectionModal?.mode === "edit"
      ? items.map(section => section.id === savedSection.id ? savedSection : section)
      : [...items, savedSection]).sort((a, b) => a.name.localeCompare(b.name)));
    toast.success(sectionModal?.mode === "edit" ? "Class section updated" : "Class section created");
    setSectionModal(null);
  }

  async function deleteSection(section: ClassSection) {
    if (!window.confirm(`Remove ${section.name}?`)) return;
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.from("class_sections").delete().eq("id", section.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Class section removed");
    setOpenMenuId(null);
    setSections(items => items.filter(item => item.id !== section.id));
  }

  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter(s => [s.name, s.levelName, s.status, String(s.studentCount ?? "")].some(value => value.toLowerCase().includes(q)));
  }, [sections, search]);

  if (loadError) return <ErrorState message={loadError} onRetry={load} />;

  return <div className="levels-page">
    <Explainer title="Levels carry the curriculum; classes receive timetables">Configure subjects and weekly periods on a level first. Every class section inside that level then uses the same curriculum when assignments and timetables are created.</Explainer>
    <section className="panel form-panel">
      <div className="section-heading"><div><h3>Levels</h3><p>Broad groupings like Form 1 — every class section belongs to one.</p></div></div>
      {loading ? <div className="level-chips">{Array.from({ length: 4 }).map((_, i) => <span className="skeleton" key={i} style={{ height: 36, width: 90, borderRadius: 99 }} />)}</div> : <div className="level-chips">
        {levels.map(l => <span className="level-chip" key={l.id}>
          <button type="button" className="level-chip-name" onClick={() => setLevelModal({ mode: "edit", level: l })}>{l.name}</button>
          <button type="button" aria-label={`Remove ${l.name}`} onClick={() => deleteLevel(l)}><X size={12} /></button>
        </span>)}
        <button type="button" className="level-chip add" onClick={() => setLevelModal({ mode: "add" })}><Plus size={13} /> Add level</button>
      </div>}
    </section>

    <TableShell title="Class sections" count={filteredSections.length} button="Add class" onAdd={() => { if (levels.length === 0) { toast.error("Add a level first"); return; } setSectionModal({ mode: "add" }); }} searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search classes…">
      {loading ? <div className="data-table"><div className="data-row head levels"><span>Class</span><span>Level</span><span>Students</span><span>Status</span><span></span></div><RowsSkeleton className="data-row levels" cols={4} rows={4} /></div> : sections.length === 0 ? (
        <div className="empty-inspector"><School2 /><h3>No class sections yet</h3><p>Add your first class section to get started.</p></div>
      ) : filteredSections.length === 0 ? (
        <div className="empty-inspector"><School2 /><h3>No class sections found</h3><p>Try a different class name, level, student count, or status.</p></div>
      ) : <div className="data-table">
        <div className="data-row head levels"><span>Class</span><span>Level</span><span>Students</span><span>Status</span><span></span></div>
        {filteredSections.map(s => <div className="data-row levels" key={s.id}>
          <span><b>{s.name}</b><small>Actual timetable class</small></span>
          <span>{s.levelName}</span>
          <span>{s.studentCount ?? "—"}</span>
          <span><i className={s.status === "active" ? "status-pill success" : "status-pill"}>{s.status === "active" ? "Active" : "Inactive"}</i></span>
          <div className="row-menu">
            <button className="more" onClick={() => setOpenMenuId(openMenuId === s.id ? null : s.id)}>•••</button>
            {openMenuId === s.id && <>
              <div className="row-menu-scrim" onClick={() => setOpenMenuId(null)} />
              <div className="row-menu-dropdown">
                <button onClick={() => { setSectionModal({ mode: "edit", section: s }); setOpenMenuId(null); }}>Edit</button>
                <button onClick={() => deleteSection(s)}>Delete</button>
              </div>
            </>}
          </div>
        </div>)}
      </div>}
    </TableShell>

    <section className="panel table-panel">
      <div className="table-tools"><div><h3>Subjects per level</h3><span>{levels.length} levels</span></div></div>
      {loading ? <div className="data-table"><div className="data-row head levelsubjects"><span>Level</span><span>Subjects configured</span><span></span></div><RowsSkeleton className="data-row levelsubjects" cols={2} rows={3} /></div> : levels.length === 0 ? (
        <div className="empty-inspector"><BookOpen /><h3>No levels yet</h3><p>Add a level above, then come back here to configure its subjects.</p></div>
      ) : <div className="data-table">
        <div className="data-row head levelsubjects"><span>Level</span><span>Subjects configured</span><span></span></div>
        {levels.map(l => <div className="data-row levelsubjects" key={l.id}>
          <span><b>{l.name}</b></span>
          <span>{levelSubjectCounts.get(l.id) ?? 0} subject{(levelSubjectCounts.get(l.id) ?? 0) === 1 ? "" : "s"}</span>
          <button className="btn" onClick={() => setSubjectsModalLevel(l)}>Manage subjects</button>
        </div>)}
      </div>}
    </section>

    {levelModal && <LevelModal mode={levelModal.mode} initial={levelModal.mode === "edit" ? levelModal.level : undefined} close={() => setLevelModal(null)} onSave={saveLevel} />}
    {sectionModal && <ClassSectionModal mode={sectionModal.mode} initial={sectionModal.mode === "edit" ? sectionModal.section : undefined} levels={levels} close={() => setSectionModal(null)} onSave={saveSection} />}
    {subjectsModalLevel && schoolId && <LevelSubjectsModal level={subjectsModalLevel} schoolId={schoolId} close={() => {
      const levelId = subjectsModalLevel.id;
      setSubjectsModalLevel(null);
      void refreshLevelSubjectCount(levelId);
    }} />}
  </div>;
}
