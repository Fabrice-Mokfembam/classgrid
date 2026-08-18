"use client";
import { useCallback,useEffect,useMemo,useState } from "react";
import { AlertTriangle,ArrowRight,BookOpen,CalendarDays,Check,CheckCircle2,ChevronDown,Clock3,Download,FileCheck2,GripVertical,LayoutDashboard,LockKeyhole,LogOut,Menu,Plus,RefreshCw,School2,Search,Settings,ShieldCheck,Sparkles,UnlockKeyhole,UserRound,UsersRound,X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useSchool } from "@/lib/school-context";
import type { ClassSection,GenerationSummary,Level,PeriodSlot,SchedulePeriod,SchoolSubject,SchoolTeacher,TeachingAssignment,TimetableEntry,WorkingDay } from "@/lib/types";

type Page="dashboard"|"setup"|"levels"|"subjects"|"teachers"|"availability"|"assignments"|"generate"|"timetable"|"settings";
const nav=[{id:"dashboard",label:"Dashboard",icon:LayoutDashboard},{id:"setup",label:"School schedule",icon:Clock3},{id:"levels",label:"Levels & classes",icon:School2},{id:"subjects",label:"Subjects",icon:BookOpen},{id:"teachers",label:"Teachers",icon:UsersRound},{id:"availability",label:"Availability",icon:CalendarDays},{id:"assignments",label:"Teaching assignments",icon:FileCheck2},{id:"generate",label:"Generate timetable",icon:Sparkles},{id:"timetable",label:"Timetables",icon:CalendarDays},{id:"settings",label:"School settings",icon:Settings}] as const;
const titles:Record<Page,[string,string]>={dashboard:["Good morning, Administrator","Here’s what’s happening with your timetable setup."],setup:["School schedule","Define your teaching days, lesson periods and breaks."],levels:["Levels & classes","Create broad levels and the actual class sections that receive timetables."],subjects:["Subjects","Manage the subjects offered by your school."],teachers:["Teachers","Manage teacher profiles and review their workloads."],availability:["Teacher availability","Set when each teacher can be scheduled for lessons."],assignments:["Teaching assignments","Connect each teacher, subject and class with its weekly lesson requirement."],generate:["Generate timetable","Validate your school data before creating a conflict-free timetable."],timetable:["Timetable editor","Review, move, lock and publish generated lessons."],settings:["School settings","Manage the profile and account details printed on school timetables."]};

export function AppShell({onLogout}:{onLogout:()=>void}){
 const [page,setPage]=useState<Page>("dashboard"); const [mobile,setMobile]=useState(false);
 const {schoolName,academicYearName,loading:schoolLoading}=useSchool();
 const go=(p:Page)=>{setPage(p);setMobile(false)};
 return <div className="app-shell"><aside className={mobile?"sidebar open":"sidebar"}><div className="brand"><span className="brand-mark"><CalendarDays/></span>ClassGrid<button className="mobile-close" onClick={()=>setMobile(false)}><X/></button></div><div className="school-switch"><span><School2/></span><div><b>{schoolLoading?"Loading…":schoolName??"Your school"}</b><small>{academicYearName??""}</small></div><ChevronDown/></div><nav>{nav.map(n=><button key={n.id} className={page===n.id?"nav-item active":"nav-item"} onClick={()=>go(n.id)}><n.icon/>{n.label}{n.id==="generate"&&<span className="nav-dot"/>}</button>)}</nav><div className="sidebar-bottom"><div className="setup-mini"><b>Setup progress <span>82%</span></b><div className="progress"><i style={{width:"82%"}}/></div><small>6 of 7 steps completed</small></div><button className="nav-item" onClick={async()=>{const supabase=createClient();if(supabase)await supabase.auth.signOut();onLogout()}}><LogOut/> Sign out</button></div></aside>{mobile&&<div className="scrim" onClick={()=>setMobile(false)}/>}<div className="app-main"><header className="topbar"><button className="menu-btn" onClick={()=>setMobile(true)}><Menu/></button><div className="crumb">School workspace <span>/</span> {titles[page][0]}</div><div className="top-actions"><button className="icon-btn"><Search/></button><div className="avatar">GA</div><div className="admin-name"><b>Grace Admin</b><small>School Administrator</small></div></div></header><main className="workspace"><div className="page-heading"><div><h1>{titles[page][0]}</h1><p>{titles[page][1]}</p></div>{page==="timetable"&&<div className="heading-actions"><button className="btn"><Download/> Export</button><button className="btn primary" onClick={()=>toast.success("Timetable published")}>Publish timetable</button></div>}</div>
 {page==="dashboard"&&<Dashboard go={go}/>} {page==="setup"&&<Schedule/>} {page==="levels"&&<Levels/>} {page==="subjects"&&<Subjects/>} {page==="teachers"&&<Teachers/>} {page==="availability"&&<Availability/>} {page==="assignments"&&<Assignments/>} {page==="generate"&&<Generate onGenerated={()=>go("timetable")}/>} {page==="timetable"&&<Timetable/>} {page==="settings"&&<SettingsPage/>}
 </main></div></div>;
}

function Dashboard({go}:{go:(p:Page)=>void}){return <><section className="setup-banner"><div className="ring"><span>82%</span></div><div><b>Complete your school setup</b><p>Add the remaining teaching assignments to get the best generation results.</p><div className="progress"><i style={{width:"82%"}}/></div><small>6 of 7 steps completed</small></div><button className="btn primary" onClick={()=>go("assignments")}>Continue setup <ArrowRight/></button></section><section className="stats-grid"><Stat icon={UsersRound} n="24" label="Teachers" note="All active"/><Stat icon={School2} n="12" label="Classes" note="Across 5 levels"/><Stat icon={BookOpen} n="18" label="Subjects" note="2 practical subjects"/><Stat icon={CalendarDays} n="186" label="Weekly lessons" note="All assigned"/></section><section className="dashboard-grid"><article className="panel workload"><PanelTitle title="Weekly workload" action="View report"/><div className="bars">{[32,45,48,42,38].map((n,i)=><div key={n}><span style={{height:`${n*2.4}px`}}><b>{n}</b></span><small>{["Mon","Tue","Wed","Thu","Fri"][i]}</small></div>)}</div></article><article className="panel status-card"><PanelTitle title="Timetable status"/><div className="status-content"><div className="ring small"><span>92</span></div><div><span className="status-pill">Draft · Version 3</span><h3>Ready for review</h3><p>186 of 186 lessons scheduled.</p></div></div><button className="btn full" onClick={()=>go("timetable")}>Open timetable editor <ArrowRight/></button></article><article className="panel validation"><PanelTitle title="Validation summary" action="View details"/><p className="validation-head"><span className="status-pill warning">3 items need attention</span></p><ValidationItem good={false} title="Soft preferences" text="3 distribution warnings"/><ValidationItem good title="Hard conflicts" text="No blocking conflicts"/><ValidationItem good title="Availability" text="Every workload is feasible"/></article></section><section className="panel quick"><PanelTitle title="Quick actions"/><div className="quick-grid"><Quick icon={UsersRound} text="Add teacher" onClick={()=>go("teachers")}/><Quick icon={School2} text="Add class" onClick={()=>go("levels")}/><Quick icon={FileCheck2} text="Add assignment" onClick={()=>go("assignments")}/><Quick icon={Sparkles} text="Generate timetable" onClick={()=>go("generate")}/></div></section></>}
function Stat({icon:Icon,n,label,note}:{icon:any;n:string;label:string;note:string}){return <article className="stat-card"><span><Icon/></span><div><b>{n}</b><strong>{label}</strong><small>{note}</small></div></article>};
function PanelTitle({title,action}:{title:string;action?:string}){return <div className="panel-title"><h3>{title}</h3>{action&&<button>{action}<ArrowRight/></button>}</div>};
function ValidationItem({good,title,text}:{good:boolean;title:string;text:string}){return <div className="validation-item">{good?<CheckCircle2 className="good"/>:<AlertTriangle className="warn"/>}<div><b>{title}</b><small>{text}</small></div><ArrowRight/></div>};
function Quick({icon:Icon,text,onClick}:{icon:any;text:string;onClick:()=>void}){return <button onClick={onClick}><Icon/><b>{text}</b><ArrowRight/></button>}

function Schedule(){
  const { schoolId, academicYearId, loading: schoolLoading } = useSchool();
  const [workingDays, setWorkingDays] = useState<WorkingDay[]>([]);
  const [periodList, setPeriodList] = useState<SchedulePeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodModal, setPeriodModal] = useState<{ mode: "add" } | { mode: "edit"; period: SchedulePeriod } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !schoolId || !academicYearId) { setWorkingDays([]); setPeriodList([]); setLoading(false); return; }
    setLoading(true);
    const [daysRes, slotsRes] = await Promise.all([
      supabase.from("working_days").select("id, name, weekday, sort_order, is_active").eq("school_id", schoolId).eq("academic_year_id", academicYearId).order("sort_order"),
      supabase.from("period_slots").select("id, name, kind, start_time, end_time, period_number, sort_order").eq("school_id", schoolId).eq("academic_year_id", academicYearId).order("sort_order"),
    ]);
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
    } else if (sixDays) {
      const { error } = await supabase.from("working_days").insert({ school_id: schoolId, academic_year_id: academicYearId, weekday: 6, name: "Saturday", sort_order: 6, is_active: true });
      if (error) { toast.error(error.message); return; }
    }
    toast.success(sixDays ? "Saturday added to the teaching week" : "Saturday removed from the teaching week");
    load();
  }

  async function savePeriod(values: { name: string; kind: "lesson" | "break"; startTime: string; endTime: string }) {
    const supabase = createClient();
    if (!supabase || !schoolId || !academicYearId) return;
    if (values.startTime >= values.endTime) { toast.error("End time must be after start time"); return; }
    const dayBlock = values.startTime < "12:00" ? "morning" : "afternoon";
    if (periodModal?.mode === "edit") {
      const periodNumber = values.kind === "lesson" ? (periodModal.period.periodNumber ?? (periodList.filter(p => p.kind === "lesson" && p.id !== periodModal.period.id).length + 1)) : null;
      const { error } = await supabase.from("period_slots").update({ name: values.name, kind: values.kind, start_time: values.startTime, end_time: values.endTime, period_number: periodNumber, day_block: dayBlock }).eq("id", periodModal.period.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const nextSort = periodList.length ? Math.max(...periodList.map(p => p.sortOrder)) + 1 : 1;
      const lessonCount = periodList.filter(p => p.kind === "lesson").length;
      const { error } = await supabase.from("period_slots").insert({
        school_id: schoolId, academic_year_id: academicYearId, name: values.name, kind: values.kind,
        start_time: values.startTime, end_time: values.endTime, sort_order: nextSort,
        period_number: values.kind === "lesson" ? lessonCount + 1 : null, day_block: dayBlock,
      });
      if (error) { toast.error(error.message); return; }
    }
    toast.success(periodModal?.mode === "edit" ? "Period updated" : "Period added");
    setPeriodModal(null);
    load();
  }

  async function deletePeriod(period: SchedulePeriod) {
    if (!window.confirm(`Remove ${period.name}?`)) return;
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.from("period_slots").delete().eq("id", period.id);
    if (error) {
      toast.error(error.code === "23503" ? "This period is used by existing timetable data — remove that first." : error.message);
      return;
    }
    toast.success("Period removed");
    setOpenMenuId(null);
    load();
  }

  if (loading) return <p className="muted">Loading…</p>;

  const activeDaysCount = workingDays.filter(d => d.isActive).length;
  const lessonCount = periodList.filter(p => p.kind === "lesson").length;

  return <div className="settings-layout">
    <section className="panel form-panel">
      <div className="section-heading"><div><h3>Weekly structure</h3><p>These slots form the grid used by the generation engine.</p></div></div>
      <div className="field-row">
        <label>Teaching days<select value={sixDayWeek ? "6" : "5"} onChange={e => setTeachingDays(e.target.value === "6")}><option value="5">Monday – Friday</option><option value="6">Monday – Saturday</option></select></label>
      </div>
      <div className="period-list">
        <div className="period-row head"><span>Type</span><span>Name</span><span>Start</span><span>End</span><span></span></div>
        {periodList.map(p => <div className={`period-row ${p.kind === "break" ? "break" : ""}`} key={p.id}>
          <span className="drag"><GripVertical/></span>
          <span><b>{p.name}</b><small>{p.kind === "break" ? "Break" : "Lesson"}</small></span>
          <input value={p.startTime.slice(0, 5)} readOnly/>
          <input value={p.endTime.slice(0, 5)} readOnly/>
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
        {periodList.length === 0 && <p className="muted" style={{ padding: "16px 0" }}>No periods or breaks configured yet.</p>}
      </div>
      <button type="button" className="btn dashed" onClick={() => setPeriodModal({ mode: "add" })}><Plus/> Add period or break</button>
    </section>
    <aside className="panel tips">
      <Sparkles/><h3>Configuration tip</h3>
      <p>Use explicit start and end times. Double lessons will only be placed in consecutive lesson slots and will never cross a break.</p>
      <div className="capacity"><span>Weekly capacity</span><b>{lessonCount * activeDaysCount} lesson slots</b><small>{lessonCount} periods × {activeDaysCount} days</small></div>
    </aside>
    {periodModal && <PeriodModal mode={periodModal.mode} initial={periodModal.mode === "edit" ? periodModal.period : undefined} close={() => setPeriodModal(null)} onSave={savePeriod} />}
  </div>;
}

function PeriodModal({ mode, initial, close, onSave }: { mode: "add" | "edit"; initial?: SchedulePeriod; close: () => void; onSave: (values: { name: string; kind: "lesson" | "break"; startTime: string; endTime: string }) => Promise<void> }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<"lesson" | "break">(initial?.kind ?? "lesson");
  const [startTime, setStartTime] = useState(initial?.startTime?.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState(initial?.endTime?.slice(0, 5) ?? "");
  const [saving, setSaving] = useState(false);
  return <div className="modal-backdrop"><form className="modal" onSubmit={async e => { e.preventDefault(); if (!name.trim() || !startTime || !endTime) return; setSaving(true); await onSave({ name: name.trim(), kind, startTime, endTime }); setSaving(false); }}>
    <div className="modal-head"><div><h2>{mode === "edit" ? "Edit period" : "Add period or break"}</h2><p>Defines a slot in the weekly timetable grid.</p></div><button type="button" className="icon-btn" onClick={close}><X/></button></div>
    <label>Type<select value={kind} onChange={e => setKind(e.target.value as "lesson" | "break")}><option value="lesson">Lesson</option><option value="break">Break</option></select></label>
    <label>Name<input required autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={kind === "break" ? "e.g. Short Break" : "e.g. Period 1"}/></label>
    <label>Start time<input type="time" required value={startTime} onChange={e => setStartTime(e.target.value)}/></label>
    <label>End time<input type="time" required value={endTime} onChange={e => setEndTime(e.target.value)}/></label>
    <footer><button type="button" className="btn" onClick={close}>Cancel</button><button className="btn primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button></footer>
  </form></div>;
}
function TableShell({children,title,count,button,onAdd}:{children:React.ReactNode;title:string;count:number;button:string;onAdd:()=>void}){return <section className="panel table-panel"><div className="table-tools"><div><h3>{title}</h3><span>{count} records</span></div><div><div className="search"><Search/><input placeholder="Search…"/></div><button className="btn primary" onClick={onAdd}><Plus/> {button}</button></div></div>{children}</section>}
function Levels(){
  const { schoolId, academicYearId, loading: schoolLoading } = useSchool();
  const [levels, setLevels] = useState<Level[]>([]);
  const [sections, setSections] = useState<ClassSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelModal, setLevelModal] = useState<{ mode: "add" } | { mode: "edit"; level: Level } | null>(null);
  const [sectionModal, setSectionModal] = useState<{ mode: "add" } | { mode: "edit"; section: ClassSection } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !schoolId || !academicYearId) { setLevels([]); setSections([]); setLoading(false); return; }
    setLoading(true);
    const [levelsRes, sectionsRes] = await Promise.all([
      supabase.from("levels").select("id, name, sort_order, status").eq("school_id", schoolId).eq("academic_year_id", academicYearId).order("sort_order"),
      supabase.from("class_sections").select("id, name, student_count, status, level_id, levels(name)").eq("school_id", schoolId).eq("academic_year_id", academicYearId).order("name"),
    ]);
    setLevels((levelsRes.data ?? []).map((l): Level => ({ id: l.id, name: l.name, sortOrder: l.sort_order, status: l.status })));
    setSections((sectionsRes.data ?? []).map((s): ClassSection => {
      const levelRow = Array.isArray(s.levels) ? s.levels[0] : s.levels;
      return { id: s.id, name: s.name, levelId: s.level_id, levelName: (levelRow as { name: string } | null)?.name ?? "—", studentCount: s.student_count, status: s.status };
    }));
    setLoading(false);
  }, [schoolId, academicYearId]);

  useEffect(() => { if (!schoolLoading) load(); }, [schoolLoading, load]);

  async function saveLevel(name: string) {
    const supabase = createClient();
    if (!supabase || !schoolId || !academicYearId) return;
    if (levelModal?.mode === "edit") {
      const { error } = await supabase.from("levels").update({ name }).eq("id", levelModal.level.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Level updated");
    } else {
      const nextOrder = levels.length ? Math.max(...levels.map(l => l.sortOrder)) + 1 : 1;
      const { error } = await supabase.from("levels").insert({ school_id: schoolId, academic_year_id: academicYearId, name, sort_order: nextOrder });
      if (error) { toast.error(error.message); return; }
      toast.success("Level added");
    }
    setLevelModal(null);
    load();
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
    load();
  }

  async function saveSection(values: { name: string; levelId: string; studentCount: string }) {
    const supabase = createClient();
    if (!supabase || !schoolId || !academicYearId) return;
    const payload = { school_id: schoolId, academic_year_id: academicYearId, level_id: values.levelId, name: values.name, student_count: values.studentCount ? Number(values.studentCount) : null };
    const { error } = sectionModal?.mode === "edit"
      ? await supabase.from("class_sections").update(payload).eq("id", sectionModal.section.id)
      : await supabase.from("class_sections").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(sectionModal?.mode === "edit" ? "Class section updated" : "Class section created");
    setSectionModal(null);
    load();
  }

  async function deleteSection(section: ClassSection) {
    if (!window.confirm(`Remove ${section.name}?`)) return;
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.from("class_sections").delete().eq("id", section.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Class section removed");
    setOpenMenuId(null);
    load();
  }

  return <div className="levels-page">
    <section className="panel form-panel">
      <div className="section-heading"><div><h3>Levels</h3><p>Broad groupings like Form 1 — every class section belongs to one.</p></div></div>
      {loading ? <p className="muted">Loading…</p> : <div className="level-chips">
        {levels.map(l => <span className="level-chip" key={l.id}>
          <button type="button" className="level-chip-name" onClick={() => setLevelModal({ mode: "edit", level: l })}>{l.name}</button>
          <button type="button" aria-label={`Remove ${l.name}`} onClick={() => deleteLevel(l)}><X size={12} /></button>
        </span>)}
        <button type="button" className="level-chip add" onClick={() => setLevelModal({ mode: "add" })}><Plus size={13} /> Add level</button>
      </div>}
    </section>

    <TableShell title="Class sections" count={sections.length} button="Add class" onAdd={() => { if (levels.length === 0) { toast.error("Add a level first"); return; } setSectionModal({ mode: "add" }); }}>
      {loading ? <p className="muted" style={{ padding: "20px" }}>Loading…</p> : sections.length === 0 ? (
        <div className="empty-inspector"><School2 /><h3>No class sections yet</h3><p>Add your first class section to get started.</p></div>
      ) : <div className="data-table">
        <div className="data-row head levels"><span>Class</span><span>Level</span><span>Students</span><span>Status</span><span></span></div>
        {sections.map(s => <div className="data-row levels" key={s.id}>
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

    {levelModal && <LevelModal mode={levelModal.mode} initial={levelModal.mode === "edit" ? levelModal.level : undefined} close={() => setLevelModal(null)} onSave={saveLevel} />}
    {sectionModal && <ClassSectionModal mode={sectionModal.mode} initial={sectionModal.mode === "edit" ? sectionModal.section : undefined} levels={levels} close={() => setSectionModal(null)} onSave={saveSection} />}
  </div>;
}

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
const SUBJECT_COLOR_PRESETS = ["#3b82f6","#8b5cf6","#22a06b","#f97362","#a855f7","#f59e0b"];

function Subjects(){
  const { schoolId, loading: schoolLoading } = useSchool();
  const [subjectsList, setSubjectsList] = useState<SchoolSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectModal, setSubjectModal] = useState<{ mode: "add" } | { mode: "edit"; subject: SchoolSubject } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !schoolId) { setSubjectsList([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from("subjects").select("id, name, code, color, status").eq("school_id", schoolId).order("name");
    setSubjectsList((data ?? []).map((s): SchoolSubject => ({ id: s.id, name: s.name, code: s.code, color: s.color, status: s.status })));
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { if (!schoolLoading) load(); }, [schoolLoading, load]);

  async function saveSubject(values: { name: string; code: string; color: string }) {
    const supabase = createClient();
    if (!supabase || !schoolId) return;
    const payload = { school_id: schoolId, name: values.name, code: values.code || null, color: values.color };
    const { error } = subjectModal?.mode === "edit"
      ? await supabase.from("subjects").update(payload).eq("id", subjectModal.subject.id)
      : await supabase.from("subjects").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(subjectModal?.mode === "edit" ? "Subject updated" : "Subject created");
    setSubjectModal(null);
    load();
  }

  async function deleteSubject(subject: SchoolSubject) {
    if (!window.confirm(`Remove ${subject.name}?`)) return;
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.from("subjects").delete().eq("id", subject.id);
    if (error) {
      toast.error(error.code === "23503" ? `Remove teaching assignments using ${subject.name} before deleting it.` : error.message);
      return;
    }
    toast.success("Subject removed");
    setOpenMenuId(null);
    load();
  }

  return <TableShell title="All subjects" count={subjectsList.length} button="Add subject" onAdd={() => setSubjectModal({ mode: "add" })}>
    {loading ? <p className="muted" style={{ padding: "20px" }}>Loading…</p> : subjectsList.length === 0 ? (
      <div className="empty-inspector"><BookOpen /><h3>No subjects yet</h3><p>Add your first subject to get started.</p></div>
    ) : <div className="data-table">
      <div className="data-row head subjects"><span>Subject</span><span>Code</span><span>Display colour</span><span>Status</span><span></span></div>
      {subjectsList.map(s => <div className="data-row subjects" key={s.id}>
        <span><i className="color-dot" style={{ background: s.color }} /><b>{s.name}</b></span>
        <span>{s.code ?? "—"}</span>
        <span><i className="color-swatch" style={{ background: s.color }} />{s.color}</span>
        <span><i className={s.status === "active" ? "status-pill success" : "status-pill"}>{s.status === "active" ? "Active" : "Inactive"}</i></span>
        <div className="row-menu">
          <button className="more" onClick={() => setOpenMenuId(openMenuId === s.id ? null : s.id)}>•••</button>
          {openMenuId === s.id && <>
            <div className="row-menu-scrim" onClick={() => setOpenMenuId(null)} />
            <div className="row-menu-dropdown">
              <button onClick={() => { setSubjectModal({ mode: "edit", subject: s }); setOpenMenuId(null); }}>Edit</button>
              <button onClick={() => deleteSubject(s)}>Delete</button>
            </div>
          </>}
        </div>
      </div>)}
    </div>}
    {subjectModal && <SubjectModal mode={subjectModal.mode} initial={subjectModal.mode === "edit" ? subjectModal.subject : undefined} close={() => setSubjectModal(null)} onSave={saveSubject} />}
  </TableShell>;
}

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
function Teachers(){
  const { schoolId, academicYearId, loading: schoolLoading } = useSchool();
  const [teachersList, setTeachersList] = useState<SchoolTeacher[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<SchoolSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [teacherModal, setTeacherModal] = useState<{ mode: "add" } | { mode: "edit"; teacher: SchoolTeacher } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !schoolId) { setTeachersList([]); setSubjectOptions([]); setLoading(false); return; }
    setLoading(true);
    const [teachersRes, subjectsRes, linksRes] = await Promise.all([
      supabase.from("teachers").select("id, full_name, teacher_code, email, phone, status").eq("school_id", schoolId).order("full_name"),
      supabase.from("subjects").select("id, name, code, color, status").eq("school_id", schoolId).order("name"),
      supabase.from("teacher_subjects").select("teacher_id, subject_id, subjects(name)").eq("school_id", schoolId),
    ]);
    let requiredByTeacher = new Map<string, number>();
    let availableByTeacher = new Map<string, number>();
    if (academicYearId) {
      const [assignmentsRes, availabilityRes] = await Promise.all([
        supabase.from("teaching_assignments").select("teacher_id, periods_per_week").eq("school_id", schoolId).eq("academic_year_id", academicYearId),
        supabase.from("teacher_availability").select("teacher_id").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("is_available", true),
      ]);
      (assignmentsRes.data ?? []).forEach(a => requiredByTeacher.set(a.teacher_id, (requiredByTeacher.get(a.teacher_id) ?? 0) + a.periods_per_week));
      (availabilityRes.data ?? []).forEach(a => availableByTeacher.set(a.teacher_id, (availableByTeacher.get(a.teacher_id) ?? 0) + 1));
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
      return {
        id: t.id, fullName: t.full_name, teacherCode: t.teacher_code, email: t.email, phone: t.phone, status: t.status,
        subjectIds: links.map(l => l.id), subjectNames: links.map(l => l.name),
        requiredPeriods: requiredByTeacher.get(t.id) ?? 0, availableSlots: availableByTeacher.get(t.id) ?? 0,
      };
    }));
    setSubjectOptions((subjectsRes.data ?? []).map((s): SchoolSubject => ({ id: s.id, name: s.name, code: s.code, color: s.color, status: s.status })));
    setLoading(false);
  }, [schoolId, academicYearId]);

  useEffect(() => { if (!schoolLoading) load(); }, [schoolLoading, load]);

  async function saveTeacher(values: { fullName: string; teacherCode: string; email: string; phone: string; subjectIds: string[] }) {
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
    if (error) {
      toast.error(error.code === "23503" ? `Remove teaching assignments for ${teacher.fullName} before deleting them.` : error.message);
      return;
    }
    toast.success("Teacher removed");
    setOpenMenuId(null);
    load();
  }

  return <TableShell title="Teaching staff" count={teachersList.length} button="Add teacher" onAdd={() => setTeacherModal({ mode: "add" })}>
    {loading ? <p className="muted" style={{ padding: "20px" }}>Loading…</p> : teachersList.length === 0 ? (
      <div className="empty-inspector"><UsersRound /><h3>No teachers yet</h3><p>Add your first teacher to get started.</p></div>
    ) : <div className="teacher-cards">
      {teachersList.map(t => <article key={t.id}>
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
    {teacherModal && <TeacherModal mode={teacherModal.mode} initial={teacherModal.mode === "edit" ? teacherModal.teacher : undefined} subjectOptions={subjectOptions} close={() => setTeacherModal(null)} onSave={saveTeacher} />}
  </TableShell>;
}

function TeacherModal({ mode, initial, subjectOptions, close, onSave }: { mode: "add" | "edit"; initial?: SchoolTeacher; subjectOptions: SchoolSubject[]; close: () => void; onSave: (values: { fullName: string; teacherCode: string; email: string; phone: string; subjectIds: string[] }) => Promise<void> }) {
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [teacherCode, setTeacherCode] = useState(initial?.teacherCode ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [subjectIds, setSubjectIds] = useState<string[]>(initial?.subjectIds ?? []);
  const [saving, setSaving] = useState(false);
  const toggleSubject = (id: string) => setSubjectIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  return <div className="modal-backdrop"><form className="modal" onSubmit={async e => { e.preventDefault(); if (!fullName.trim()) return; setSaving(true); await onSave({ fullName: fullName.trim(), teacherCode: teacherCode.trim(), email: email.trim(), phone: phone.trim(), subjectIds }); setSaving(false); }}>
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
    <footer><button type="button" className="btn" onClick={close}>Cancel</button><button className="btn primary" disabled={saving}>{saving ? "Saving…" : `Save ${mode === "edit" ? "changes" : "teacher"}`}</button></footer>
  </form></div>;
}

const DEFAULT_PERIODS = [
  { n: 1, start: "07:45", end: "08:30" }, { n: 2, start: "08:30", end: "09:15" },
  { n: 3, start: "09:30", end: "10:15" }, { n: 4, start: "10:15", end: "11:00" },
  { n: 5, start: "11:30", end: "12:15" }, { n: 6, start: "12:15", end: "13:00" },
  { n: 7, start: "13:00", end: "13:45" }, { n: 8, start: "13:45", end: "14:30" },
];

function Availability(){
  const { schoolId, academicYearId, loading: schoolLoading } = useSchool();
  const [workingDays, setWorkingDays] = useState<WorkingDay[]>([]);
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>([]);
  const [teachersList, setTeachersList] = useState<{ id: string; fullName: string; requiredPeriods: number }[]>([]);
  const [teacherId, setTeacherId] = useState<string>("");
  const [availability, setAvailability] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !schoolId || !academicYearId) { setWorkingDays([]); setPeriodSlots([]); setTeachersList([]); setLoading(false); return; }
    setLoading(true);
    const [daysRes, slotsRes, teachersRes, assignmentsRes] = await Promise.all([
      supabase.from("working_days").select("id, name, sort_order").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("is_active", true).order("sort_order"),
      supabase.from("period_slots").select("id, name, period_number, start_time, end_time").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("kind", "lesson").order("sort_order"),
      supabase.from("teachers").select("id, full_name").eq("school_id", schoolId).order("full_name"),
      supabase.from("teaching_assignments").select("teacher_id, periods_per_week").eq("school_id", schoolId).eq("academic_year_id", academicYearId),
    ]);
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
      const { data } = await supabase.from("teacher_availability").select("working_day_id, period_slot_id, is_available").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("teacher_id", teacherId);
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
    const rows = DEFAULT_PERIODS.map(p => ({
      school_id: schoolId, academic_year_id: academicYearId, name: `Period ${p.n}`, kind: "lesson",
      start_time: p.start, end_time: p.end, period_number: p.n, sort_order: p.n, day_block: p.n <= 4 ? "morning" : "afternoon",
    }));
    const { error } = await supabase.from("period_slots").insert(rows);
    setSeeding(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Default lesson periods created");
    load();
  }

  const teacher = teachersList.find(t => t.id === teacherId);
  const availableCount = workingDays.flatMap(d => periodSlots.map(p => availability.get(`${d.id}-${p.id}`) ?? true)).filter(Boolean).length;

  if (loading) return <p className="muted">Loading…</p>;
  if (workingDays.length === 0) return <div className="empty-inspector"><CalendarDays /><h3>No teaching days configured</h3><p>Set up your school's teaching days first, on the School schedule page.</p></div>;
  if (periodSlots.length === 0) return <div className="empty-inspector"><CalendarDays /><h3>No lesson periods configured yet</h3><p>The availability grid needs lesson periods before it can be used.</p><button className="btn primary" onClick={seedDefaultPeriods} disabled={seeding}>{seeding ? "Setting up…" : "Use default schedule (8 periods)"}</button></div>;
  if (!teacher) return <div className="empty-inspector"><UsersRound /><h3>No teachers yet</h3><p>Add a teacher first to set their availability.</p></div>;

  return <div className="availability-layout"><section className="panel availability-main"><div className="availability-toolbar"><label>Teacher<select value={teacherId} onChange={e=>setTeacherId(e.target.value)}>{teachersList.map(t=><option value={t.id} key={t.id}>{t.fullName}</option>)}</select></label><div><small>Workload summary</small><b>{teacher.requiredPeriods} required periods · <i>{availableCount} available slots</i></b></div><button className="btn" onClick={resetAvailability}>Reset</button></div><div className="availability-grid"><div className="av-head">Period</div>{workingDays.map(d=><div className="av-head" key={d.id}>{d.name}</div>)}{periodSlots.flatMap(p=>[<div className="av-period" key={`p-${p.id}`}><b>{p.name}</b><small>{p.startTime.slice(0,5)} – {p.endTime.slice(0,5)}</small></div>,...workingDays.map(d=>{const key=`${d.id}-${p.id}`,on=availability.get(key)??true;return <button aria-label={`${d.name} ${p.name}`} className={on?"av-cell on":"av-cell off"} onClick={()=>toggleCell(d.id,p.id)} key={key}>{on?<Check/>:<X/>}</button>})])}</div><div className="legend"><span><i className="lg available"/>Available</span><span><i className="lg unavailable"/>Unavailable</span><small>Click any slot to change it.</small></div></section><aside className="panel teacher-side"><div className="avatar xlarge">{teacher.fullName.split(" ").map((x:string)=>x[0]).join("")}</div><h3>{teacher.fullName}</h3><hr/><span>Required periods <b>{teacher.requiredPeriods}</b></span><span>Available slots <b>{availableCount}</b></span>{availableCount>=teacher.requiredPeriods?<div className="success-box"><CheckCircle2/><div><b>Availability is sufficient</b><p>{availableCount-teacher.requiredPeriods} more slots than required.</p></div></div>:<div className="warning-box"><AlertTriangle/><div><b>Availability may be tight</b><p>{teacher.requiredPeriods-availableCount} more slots needed than currently available.</p></div></div>}</aside></div>;
}
const PATTERN_LABELS: Record<string, string> = { singles: "Singles", double: "Double", mixed: "Mixed" };

function Assignments(){
  const { schoolId, academicYearId, loading: schoolLoading } = useSchool();
  const [assignmentsList, setAssignmentsList] = useState<TeachingAssignment[]>([]);
  const [teacherOptions, setTeacherOptions] = useState<{ id: string; name: string }[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<{ id: string; name: string }[]>([]);
  const [classOptions, setClassOptions] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignmentModal, setAssignmentModal] = useState<{ mode: "add" } | { mode: "edit"; assignment: TeachingAssignment } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !schoolId || !academicYearId) { setAssignmentsList([]); setTeacherOptions([]); setSubjectOptions([]); setClassOptions([]); setLoading(false); return; }
    setLoading(true);
    const [assignmentsRes, teachersRes, subjectsRes, classesRes] = await Promise.all([
      supabase.from("teaching_assignments").select("id, periods_per_week, pattern, status, teacher_id, subject_id, class_section_id, teachers(full_name), subjects(name), class_sections(name)").eq("school_id", schoolId).eq("academic_year_id", academicYearId).order("created_at"),
      supabase.from("teachers").select("id, full_name").eq("school_id", schoolId).order("full_name"),
      supabase.from("subjects").select("id, name").eq("school_id", schoolId).order("name"),
      supabase.from("class_sections").select("id, name").eq("school_id", schoolId).eq("academic_year_id", academicYearId).order("name"),
    ]);
    setAssignmentsList((assignmentsRes.data ?? []).map((a): TeachingAssignment => {
      const teacherRow = Array.isArray(a.teachers) ? a.teachers[0] : a.teachers;
      const subjectRow = Array.isArray(a.subjects) ? a.subjects[0] : a.subjects;
      const classRow = Array.isArray(a.class_sections) ? a.class_sections[0] : a.class_sections;
      return {
        id: a.id, teacherId: a.teacher_id, teacherName: (teacherRow as { full_name: string } | null)?.full_name ?? "—",
        subjectId: a.subject_id, subjectName: (subjectRow as { name: string } | null)?.name ?? "—",
        classSectionId: a.class_section_id, className: (classRow as { name: string } | null)?.name ?? "—",
        periodsPerWeek: a.periods_per_week, pattern: a.pattern, status: a.status,
      };
    }));
    setTeacherOptions((teachersRes.data ?? []).map(t => ({ id: t.id, name: t.full_name })));
    setSubjectOptions((subjectsRes.data ?? []).map(s => ({ id: s.id, name: s.name })));
    setClassOptions((classesRes.data ?? []).map(c => ({ id: c.id, name: c.name })));
    setLoading(false);
  }, [schoolId, academicYearId]);

  useEffect(() => { if (!schoolLoading) load(); }, [schoolLoading, load]);

  async function saveAssignment(values: { teacherId: string; subjectId: string; classSectionId: string; periodsPerWeek: string; pattern: string }) {
    const supabase = createClient();
    if (!supabase || !schoolId || !academicYearId) return;
    const payload = {
      school_id: schoolId, academic_year_id: academicYearId, teacher_id: values.teacherId, subject_id: values.subjectId,
      class_section_id: values.classSectionId, periods_per_week: Number(values.periodsPerWeek), pattern: values.pattern,
    };
    const { error } = assignmentModal?.mode === "edit"
      ? await supabase.from("teaching_assignments").update(payload).eq("id", assignmentModal.assignment.id)
      : await supabase.from("teaching_assignments").insert(payload);
    if (error) {
      toast.error(error.code === "23505" ? "This teacher, subject and class combination already exists." : error.message);
      return;
    }
    toast.success(assignmentModal?.mode === "edit" ? "Assignment updated" : "Assignment created");
    setAssignmentModal(null);
    load();
  }

  async function deleteAssignment(assignment: TeachingAssignment) {
    if (!window.confirm("Remove this assignment?")) return;
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.from("teaching_assignments").delete().eq("id", assignment.id);
    if (error) {
      toast.error(error.code === "23503" ? "This assignment is used by a published timetable — remove it there first." : error.message);
      return;
    }
    toast.success("Assignment removed");
    setOpenMenuId(null);
    load();
  }

  return <TableShell title="Teaching assignments" count={assignmentsList.length} button="Add assignment" onAdd={() => {
    if (teacherOptions.length === 0 || subjectOptions.length === 0 || classOptions.length === 0) { toast.error("Add a teacher, a subject and a class section first"); return; }
    setAssignmentModal({ mode: "add" });
  }}>
    <div className="info-banner"><ShieldCheck/><div><b>The assignment is the generator’s core input</b><span>It connects one teacher, subject and actual class with its weekly period requirement.</span></div></div>
    {loading ? <p className="muted" style={{ padding: "20px" }}>Loading…</p> : assignmentsList.length === 0 ? (
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
    {assignmentModal && <AssignmentModal mode={assignmentModal.mode} initial={assignmentModal.mode === "edit" ? assignmentModal.assignment : undefined} teacherOptions={teacherOptions} subjectOptions={subjectOptions} classOptions={classOptions} close={() => setAssignmentModal(null)} onSave={saveAssignment} />}
  </TableShell>;
}

function AssignmentModal({ mode, initial, teacherOptions, subjectOptions, classOptions, close, onSave }: { mode: "add" | "edit"; initial?: TeachingAssignment; teacherOptions: { id: string; name: string }[]; subjectOptions: { id: string; name: string }[]; classOptions: { id: string; name: string }[]; close: () => void; onSave: (values: { teacherId: string; subjectId: string; classSectionId: string; periodsPerWeek: string; pattern: string }) => Promise<void> }) {
  const [teacherId, setTeacherId] = useState(initial?.teacherId ?? "");
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? "");
  const [classSectionId, setClassSectionId] = useState(initial?.classSectionId ?? "");
  const [periodsPerWeek, setPeriodsPerWeek] = useState(initial ? String(initial.periodsPerWeek) : "");
  const [pattern, setPattern] = useState(initial?.pattern ?? "singles");
  const [saving, setSaving] = useState(false);
  return <div className="modal-backdrop"><form className="modal" onSubmit={async e => { e.preventDefault(); if (!teacherId || !subjectId || !classSectionId || !periodsPerWeek) return; setSaving(true); await onSave({ teacherId, subjectId, classSectionId, periodsPerWeek, pattern }); setSaving(false); }}>
    <div className="modal-head"><div><h2>{mode === "edit" ? "Edit teaching assignment" : "Add teaching assignment"}</h2><p>Enter the information used by the timetable generator.</p></div><button type="button" className="icon-btn" onClick={close}><X /></button></div>
    <label>Teacher<select required autoFocus value={teacherId} onChange={e => setTeacherId(e.target.value)}><option value="">Select teacher</option>{teacherOptions.map(t => <option value={t.id} key={t.id}>{t.name}</option>)}</select></label>
    <label>Subject<select required value={subjectId} onChange={e => setSubjectId(e.target.value)}><option value="">Select subject</option>{subjectOptions.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
    <label>Class section<select required value={classSectionId} onChange={e => setClassSectionId(e.target.value)}><option value="">Select class section</option>{classOptions.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
    <label>Periods per week<input type="number" min="1" required value={periodsPerWeek} onChange={e => setPeriodsPerWeek(e.target.value)} placeholder="Enter periods per week" /></label>
    <label>Lesson pattern<select value={pattern} onChange={e => setPattern(e.target.value)}><option value="singles">Singles</option><option value="double">Double</option><option value="mixed">Mixed</option></select></label>
    <footer><button type="button" className="btn" onClick={close}>Cancel</button><button className="btn primary" disabled={saving}>{saving ? "Saving…" : `Save ${mode === "edit" ? "changes" : "assignment"}`}</button></footer>
  </form></div>;
}
function Generate({ onGenerated }: { onGenerated: (timetableId: string) => void }) {
  const { schoolId, academicYearId, loading: schoolLoading } = useSchool();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [classCount, setClassCount] = useState(0);
  const [teacherCount, setTeacherCount] = useState(0);
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [weeklyLessons, setWeeklyLessons] = useState(0);
  const [dayCount, setDayCount] = useState(0);
  const [lessonPeriodCount, setLessonPeriodCount] = useState(0);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !schoolId || !academicYearId) { setLoading(false); return; }
    setLoading(true);
    const [classesRes, teachersRes, assignmentsRes, daysRes, periodsRes] = await Promise.all([
      supabase.from("class_sections").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("status", "active"),
      supabase.from("teachers").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("status", "active"),
      supabase.from("teaching_assignments").select("periods_per_week").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("status", "active"),
      supabase.from("working_days").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("is_active", true),
      supabase.from("period_slots").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("kind", "lesson"),
    ]);
    setClassCount(classesRes.count ?? 0);
    setTeacherCount(teachersRes.count ?? 0);
    const assignmentRows = assignmentsRes.data ?? [];
    setAssignmentCount(assignmentRows.length);
    setWeeklyLessons(assignmentRows.reduce((sum, a) => sum + a.periods_per_week, 0));
    setDayCount(daysRes.count ?? 0);
    setLessonPeriodCount(periodsRes.count ?? 0);
    setLoading(false);
  }, [schoolId, academicYearId]);

  useEffect(() => { if (!schoolLoading) load(); }, [schoolLoading, load]);

  const availableSlots = dayCount * lessonPeriodCount;
  const scheduleReady = dayCount > 0 && lessonPeriodCount > 0;
  const assignmentsReady = assignmentCount > 0;
  const capacityReady = availableSlots >= weeklyLessons;
  const canGenerate = scheduleReady && assignmentsReady && !generating;

  async function run() {
    if (!schoolId || !academicYearId) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schoolId, academicYearId }) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Generation failed"); return; }
      const summary = data as GenerationSummary;
      toast.success(summary.hardConflicts > 0
        ? `${summary.scheduled} of ${summary.totalRequired} lessons scheduled — ${summary.hardConflicts} assignment(s) could not be fully placed`
        : `${summary.scheduled} lessons scheduled with no hard conflicts`);
      onGenerated(summary.timetableId);
    } catch {
      toast.error("Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;

  return <div className="generate-layout">
    <section className="panel generate-card">
      <div className="generate-title"><span><Sparkles/></span><div><h2>Ready to generate</h2><p>We checked the active configuration across all {classCount} classes.</p></div></div>
      <div className="generation-summary">
        <div><span>Classes</span><b>{classCount}</b></div>
        <div><span>Teaching assignments</span><b>{assignmentCount}</b></div>
        <div><span>Weekly lessons</span><b>{weeklyLessons}</b></div>
        <div><span>Available slots</span><b>{availableSlots}</b></div>
      </div>
      <div className="check-list">
        <ValidationItem good={scheduleReady} title="School structure" text={scheduleReady ? `${dayCount} teaching days and ${lessonPeriodCount} lesson periods configured` : "Set up teaching days and lesson periods on School schedule first"}/>
        <ValidationItem good={teacherCount > 0} title="Teachers" text={teacherCount > 0 ? `${teacherCount} active teachers` : "No active teachers yet"}/>
        <ValidationItem good={assignmentsReady} title="Teaching assignments" text={assignmentsReady ? `${assignmentCount} active assignments` : "No teaching assignments yet"}/>
        <ValidationItem good={capacityReady} title="Capacity" text={capacityReady ? "Enough weekly slots for the required lessons" : `Only ${availableSlots} slots available for ${weeklyLessons} required lessons`}/>
      </div>
      <button className="btn primary huge" onClick={run} disabled={!canGenerate}><Sparkles/> {generating ? "Generating…" : "Generate conflict-free timetable"}</button>
      <p className="center muted">Generation runs on the server. You can safely leave this page and return later.</p>
    </section>
    <aside className="panel rules-card">
      <h3>Rules being enforced</h3>
      <div><LockKeyhole/><span><b>No teacher clashes</b><small>A teacher is only in one class at a time.</small></span></div>
      <div><LockKeyhole/><span><b>No class clashes</b><small>A class receives one lesson per period.</small></span></div>
      <div><LockKeyhole/><span><b>Availability respected</b><small>Unavailable slots are never used.</small></span></div>
      <div><Sparkles/><span><b>Balanced distribution</b><small>Lessons are spread through the week.</small></span></div>
    </aside>
  </div>;
}

function Timetable() {
  const { schoolId, academicYearId, loading: schoolLoading } = useSchool();
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

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !schoolId || !academicYearId) { setLoading(false); return; }
    setLoading(true);
    const [daysRes, slotsRes, classesRes, teachersRes, timetableRes] = await Promise.all([
      supabase.from("working_days").select("id, name, sort_order").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("is_active", true).order("sort_order"),
      supabase.from("period_slots").select("id, name, period_number, start_time, end_time").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("kind", "lesson").order("sort_order"),
      supabase.from("class_sections").select("id, name").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("status", "active").order("name"),
      supabase.from("teachers").select("id, full_name").eq("school_id", schoolId).eq("status", "active").order("full_name"),
      supabase.from("timetables").select("id, version, quality_score").eq("school_id", schoolId).eq("academic_year_id", academicYearId).order("version", { ascending: false }).limit(1).maybeSingle(),
    ]);
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
    let query = supabase.from("timetable_entries")
      .select("id, working_day_id, period_slot_id, is_locked, subjects(name, color), teachers(full_name), class_sections(name)")
      .eq("timetable_id", timetableInfo.id);
    if (view === "class") query = query.eq("class_section_id", classSectionId);
    if (view === "teacher") query = query.eq("teacher_id", teacherId);
    const { data } = await query;
    setEntries((data ?? []).map((e): TimetableEntry => {
      const subject = Array.isArray(e.subjects) ? e.subjects[0] : e.subjects;
      const teacher = Array.isArray(e.teachers) ? e.teachers[0] : e.teachers;
      const classRow = Array.isArray(e.class_sections) ? e.class_sections[0] : e.class_sections;
      return {
        id: e.id, dayId: e.working_day_id, periodSlotId: e.period_slot_id, isLocked: e.is_locked,
        subjectName: (subject as { name: string } | null)?.name ?? "—", subjectColor: (subject as { color: string } | null)?.color ?? "#3b82f6",
        teacherName: (teacher as { full_name: string } | null)?.full_name ?? "—", className: (classRow as { name: string } | null)?.name ?? "—",
      };
    }));
    setSelected(null);
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
      if (error) {
        const message = error.code === "23505" ? "That slot conflicts with an existing lesson for this teacher elsewhere in the timetable"
          : error.message.includes("locked") ? "This lesson is locked and cannot be replaced" : error.message;
        toast.error(message);
        return;
      }
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
    setRegenerating(true);
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schoolId, academicYearId, timetableId: timetableInfo.id }) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Regeneration failed"); return; }
      const summary = data as GenerationSummary;
      toast.success(summary.hardConflicts > 0
        ? `${summary.scheduled} of ${summary.totalRequired} lessons scheduled — ${summary.hardConflicts} assignment(s) could not be fully placed`
        : `${summary.scheduled} lessons scheduled with no hard conflicts`);
      setTimetableInfo(info => info ? { ...info, qualityScore: summary.qualityScore } : info);
      loadEntries();
    } catch {
      toast.error("Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;
  if (!timetableInfo) return <div className="empty-inspector"><CalendarDays/><h3>No timetable generated yet</h3><p>Head to Generate timetable to create the first draft.</p></div>;
  if (workingDays.length === 0 || periodSlots.length === 0) return <div className="empty-inspector"><CalendarDays/><h3>School schedule not configured</h3><p>Set up teaching days and lesson periods first.</p></div>;

  return <div className="timetable-layout">
    <section className="panel timetable-main">
      <div className="tt-toolbar">
        <div className="segmented">
          <button className={view === "class" ? "active" : ""} onClick={() => setView("class")}>Class</button>
          <button className={view === "teacher" ? "active" : ""} onClick={() => setView("teacher")}>Teacher</button>
          <button className={view === "master" ? "active" : ""} onClick={() => setView("master")}>Master</button>
        </div>
        {view === "class" && <select value={classSectionId} onChange={e => setClassSectionId(e.target.value)}>{classOptions.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select>}
        {view === "teacher" && <select value={teacherId} onChange={e => setTeacherId(e.target.value)}>{teacherOptions.map(t => <option value={t.id} key={t.id}>{t.name}</option>)}</select>}
        <button className="btn" disabled title="Not built yet"><ShieldCheck/> Validate</button>
        <button className="btn" onClick={regenerateUnlocked} disabled={regenerating}><RefreshCw/> {regenerating ? "Regenerating…" : "Regenerate unlocked"}</button>
      </div>
      <div className="score-row">
        <span><b>{timetableInfo.qualityScore ?? "—"}</b>/100 Quality</span>
        <span><CalendarDays/> <b>{entries.length}</b> lessons scheduled</span>
        <small>Version {timetableInfo.version} {view === "class" ? "· Drag a lesson to reschedule" : "· Read-only view"}</small>
      </div>
      <div className="tt-grid">
        <div className="tt-head">Period</div>
        {workingDays.map(d => <div className="tt-head" key={d.id}>{d.name}</div>)}
        {periodSlots.flatMap(p => [
          <div className="tt-period" key={`p-${p.id}`}><b>{p.name}</b><small>{p.startTime.slice(0, 5)} – {p.endTime.slice(0, 5)}</small></div>,
          ...workingDays.map(d => {
            const cellEntries = cells.get(`${d.id}-${p.id}`) ?? [];
            if (view === "master") {
              return <div className="tt-cell" key={`${d.id}-${p.id}`} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {cellEntries.map(e => <button key={e.id} onClick={() => setSelected(e)} className={`lesson ${selected?.id === e.id ? "selected" : ""}`} style={{ borderLeft: `4px solid ${e.subjectColor}` }}>
                  <span><b>{e.className}</b><small>{e.subjectName} · {e.teacherName}</small></span>{e.isLocked && <LockKeyhole/>}
                </button>)}
              </div>;
            }
            const e = cellEntries[0];
            return <div className={dragged && dragged.id === e?.id ? "tt-cell dragging" : "tt-cell"} key={`${d.id}-${p.id}`}
              onDragOver={view === "class" ? ev => ev.preventDefault() : undefined}
              onDrop={view === "class" ? () => handleDrop(d.id, p.id) : undefined}>
              {e && <button draggable={view === "class" && !e.isLocked} onDragStart={() => setDragged(e)} onClick={() => setSelected(e)} className={`lesson ${selected?.id === e.id ? "selected" : ""}`} style={{ borderLeft: `4px solid ${e.subjectColor}` }}>
                <span><b>{e.subjectName}</b><small>{view === "teacher" ? e.className : e.teacherName}</small></span>{e.isLocked && <LockKeyhole/>}
              </button>}
            </div>;
          }),
        ])}
      </div>
    </section>
    <aside className="panel inspector">
      {selected ? <>
        <div className="inspector-head"><div><span>Selected lesson</span><h3>{selected.subjectName}</h3><p>{selected.className}</p></div><button className="icon-btn" onClick={() => setSelected(null)}><X/></button></div>
        <div className="detail-list"><span>Teacher <b>{selected.teacherName}</b></span></div>
        <button className="lock-toggle" onClick={toggleLock}>
          {selected.isLocked ? <LockKeyhole/> : <UnlockKeyhole/>}
          <span><b>{selected.isLocked ? "Lesson locked" : "Lesson unlocked"}</b><small>{selected.isLocked ? "Regeneration will keep this slot." : "Regeneration may move this lesson."}</small></span>
          <i className={selected.isLocked ? "switch on" : "switch"}/>
        </button>
      </> : <div className="empty-inspector"><CalendarDays/><h3>Select a lesson</h3><p>View its details.</p></div>}
    </aside>
  </div>;
}
function SettingsPage(){return <section className="panel form-panel"><div className="section-heading"><div><h3>School profile</h3><p>This information is kept inside your school workspace.</p></div><button className="btn primary" onClick={()=>toast.success("School profile saved")}>Save changes</button></div><div className="logo-upload"><span><School2/></span><div><b>School logo</b><p>PNG or JPG, maximum 2 MB</p><button className="btn">Upload logo</button></div></div><div className="form-grid wide"><label>School display name<input defaultValue="Excellence Bilingual Academy"/></label><label>Registered name<input defaultValue="Excellence Bilingual Academy Ltd."/></label><label>School type<select><option>Primary & Secondary School</option></select></label><label>Curriculum<input defaultValue="Cameroon National Curriculum"/></label><label>Country<input defaultValue="Cameroon"/></label><label>Region<input defaultValue="Littoral"/></label><label>City<input defaultValue="Douala"/></label><label>Timezone<select><option>Africa/Douala</option></select></label><label className="span-2">Physical address<input defaultValue="Bonamoussadi, Douala"/></label><label>School email<input defaultValue="admin@excellence.edu.cm"/></label><label>School phone<input defaultValue="+237 677 000 000"/></label></div></section>}
