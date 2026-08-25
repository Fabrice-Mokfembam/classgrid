"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, AlertTriangle, FileCheck2, HelpCircle, School2, Sparkles, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSchool } from "@/lib/school-context";
import type { SetupStep } from "@/lib/types";
import { ErrorState, firstError, Skel } from "@/components/shared";

type Page = "dashboard" | "setup" | "levels" | "subjects" | "teachers" | "availability" | "assignments" | "generate" | "timetable" | "settings";
function pagePath(schoolSlug: string, id: Page) { return id === "dashboard" ? `/${schoolSlug}` : `/${schoolSlug}/${id}`; }

function Stat({ icon: Icon, n, label, note }: { icon: any; n: string; label: string; note: string }) {
  return <article className="stat-card"><span><Icon /></span><div><b>{n}</b><strong>{label}</strong><small>{note}</small></div></article>;
}
function PanelTitle({ title, action }: { title: string; action?: string }) {
  return <div className="panel-title"><h3>{title}</h3>{action && <button>{action}<ArrowRight /></button>}</div>;
}
function ValidationItem({ good, title, text }: { good: boolean; title: string; text: string }) {
  return <div className="validation-item">{good ? <CheckCircle2 className="good" /> : <AlertTriangle className="warn" />}<div><b>{title}</b><small>{text}</small></div><ArrowRight /></div>;
}
function Quick({ icon: Icon, text, onClick }: { icon: any; text: string; onClick: () => void }) {
  return <button onClick={onClick}><Icon /><b>{text}</b><ArrowRight /></button>;
}
function SetupOrderItem({ n, title, text, onClick }: { n: number; title: string; text: string; onClick: () => void }) {
  return <button type="button" className="validation-item setup-order-item" onClick={onClick}><span className="setup-order-badge">{n}</span><div><b>{title}</b><small>{text}</small></div><ArrowRight /></button>;
}

const STEP_ORDER: { key: SetupStep; label: string; page: Page }[] = [
  { key: "school", label: "School profile", page: "settings" },
  { key: "year", label: "Academic year", page: "settings" },
  { key: "schedule", label: "School schedule", page: "setup" },
  { key: "levels", label: "Levels & classes", page: "levels" },
  { key: "subjects", label: "Subjects", page: "subjects" },
  { key: "teachers", label: "Teachers", page: "teachers" },
  { key: "assignments", label: "Teaching assignments", page: "assignments" },
];

type DashboardStats = {
  teachersActive: number; teachersTotal: number;
  classSections: number; levelsCount: number;
  subjectsTotal: number; requiredPeriods: number;
};
type TimetableInfo = { id: string; version: number; status: string; qualityScore: number | null; scheduled: number };
type WeeklyBar = { label: string; count: number };

export function Dashboard() {
  const router = useRouter();
  const { school } = useParams<{ school: string }>();
  const go = (p: Page) => router.push(pagePath(school, p));
  const { schoolId, academicYearId, loading: schoolLoading } = useSchool();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [stepsDone, setStepsDone] = useState<Record<SetupStep, boolean>>({ school: true, year: true, schedule: false, levels: false, subjects: false, teachers: false, assignments: false });
  const [timetableInfo, setTimetableInfo] = useState<TimetableInfo | null>(null);
  const [weeklyBars, setWeeklyBars] = useState<WeeklyBar[]>([]);
  const [issues, setIssues] = useState({ hard: 0, soft: 0 });

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !schoolId || !academicYearId) { setLoading(false); return; }
    setLoading(true); setLoadError(null);

    const [teachersRes, classesRes, levelsRes, subjectsRes, assignmentsRes, scheduleDaysRes, scheduleSlotsRes, timetableRes] = await Promise.all([
      supabase.from("teachers").select("id, status").eq("school_id", schoolId),
      supabase.from("class_sections").select("id").eq("school_id", schoolId).eq("academic_year_id", academicYearId),
      supabase.from("levels").select("id").eq("school_id", schoolId).eq("academic_year_id", academicYearId),
      supabase.from("subjects").select("id").eq("school_id", schoolId),
      supabase.from("teaching_assignments").select("id, periods_per_week").eq("school_id", schoolId).eq("academic_year_id", academicYearId),
      supabase.from("working_days").select("id").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("is_active", true),
      supabase.from("period_slots").select("id").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("kind", "lesson"),
      supabase.from("timetables").select("id, version, status, quality_score").eq("school_id", schoolId).eq("academic_year_id", academicYearId).order("version", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const err = firstError(teachersRes, classesRes, levelsRes, subjectsRes, assignmentsRes, scheduleDaysRes, scheduleSlotsRes, timetableRes);
    if (err) { setLoadError(err); setLoading(false); return; }

    const teachers = teachersRes.data ?? [];
    const assignments = assignmentsRes.data ?? [];
    const requiredPeriods = assignments.reduce((sum, a) => sum + a.periods_per_week, 0);

    setStats({
      teachersActive: teachers.filter(t => t.status === "active").length,
      teachersTotal: teachers.length,
      classSections: (classesRes.data ?? []).length,
      levelsCount: (levelsRes.data ?? []).length,
      subjectsTotal: (subjectsRes.data ?? []).length,
      requiredPeriods,
    });
    setStepsDone({
      school: true, year: true,
      schedule: (scheduleDaysRes.data?.length ?? 0) > 0 && (scheduleSlotsRes.data?.length ?? 0) > 0,
      levels: (levelsRes.data?.length ?? 0) > 0,
      subjects: (subjectsRes.data?.length ?? 0) > 0,
      teachers: teachers.length > 0,
      assignments: assignments.length > 0,
    });

    const tt = timetableRes.data;
    if (tt) {
      const [entriesRes, runRes, daysRes] = await Promise.all([
        supabase.from("timetable_entries").select("id, working_day_id").eq("timetable_id", tt.id),
        supabase.from("generation_runs").select("id").eq("timetable_id", tt.id).order("started_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("working_days").select("id, name, sort_order").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("is_active", true).order("sort_order"),
      ]);
      const entries = entriesRes.data ?? [];
      setTimetableInfo({ id: tt.id, version: tt.version, status: tt.status, qualityScore: tt.quality_score, scheduled: entries.length });

      const countByDay = new Map<string, number>();
      entries.forEach(e => countByDay.set(e.working_day_id, (countByDay.get(e.working_day_id) ?? 0) + 1));
      setWeeklyBars((daysRes.data ?? []).map(d => ({ label: d.name.slice(0, 3), count: countByDay.get(d.id) ?? 0 })));

      if (runRes.data) {
        const issuesRes = await supabase.from("constraint_issues").select("severity").eq("generation_run_id", runRes.data.id);
        const list = issuesRes.data ?? [];
        setIssues({ hard: list.filter(i => i.severity === "hard").length, soft: list.filter(i => i.severity === "soft").length });
      } else {
        setIssues({ hard: 0, soft: 0 });
      }
    } else {
      setTimetableInfo(null); setWeeklyBars([]); setIssues({ hard: 0, soft: 0 });
    }

    setLoading(false);
  }, [schoolId, academicYearId]);

  useEffect(() => { if (!schoolLoading) load(); }, [schoolLoading, load]);

  if (loadError) return <ErrorState message={loadError} onRetry={load} />;

  if (loading || !stats) return <><section className="setup-banner"><div className="ring"><span><Skel w="30px" /></span></div><div><b><Skel w="180px" /></b><p><Skel w="240px" /></p><div className="progress"><i style={{ width: "0%" }} /></div><small><Skel w="120px" /></small></div></section>
    <section className="stats-grid">{Array.from({ length: 4 }).map((_, i) => <article className="stat-card" key={i}><span className="skeleton" style={{ width: 34, height: 34, borderRadius: 9 }} /><div><b><Skel w="30px" /></b><strong><Skel w="60px" /></strong><small><Skel w="70px" /></small></div></article>)}</section>
  </>;

  const completedCount = STEP_ORDER.filter(s => stepsDone[s.key]).length;
  const percent = Math.round((completedCount / STEP_ORDER.length) * 100);
  const nextStep = STEP_ORDER.find(s => !stepsDone[s.key]);
  const totalIssues = issues.hard + issues.soft;

  return <>
    <section className="setup-banner">
      <div className="ring"><span>{percent}%</span></div>
      <div>
        <b>{nextStep ? "Complete your school setup" : "School setup complete"}</b>
        <p>{nextStep ? `Next up: ${nextStep.label}.` : "Everything's configured — generate a timetable whenever you're ready."}</p>
        <div className="progress"><i style={{ width: `${percent}%` }} /></div>
        <small>{completedCount} of {STEP_ORDER.length} steps completed</small>
      </div>
      <div className="setup-actions">
        <button className="btn" onClick={() => router.push("/guide")}><HelpCircle /> Setup guide</button>
        <button className="btn primary" onClick={() => go(nextStep?.page ?? "generate")}>{nextStep ? "Continue setup" : "Go to Generate"} <ArrowRight /></button>
      </div>
    </section>
    <section className="stats-grid">
      <Stat icon={UsersRound} n={String(stats.teachersActive)} label="Teachers" note={stats.teachersTotal === stats.teachersActive ? "All active" : `${stats.teachersTotal - stats.teachersActive} inactive`} />
      <Stat icon={School2} n={String(stats.classSections)} label="Classes" note={`Across ${stats.levelsCount} level${stats.levelsCount === 1 ? "" : "s"}`} />
      <Stat icon={BookOpen} n={String(stats.subjectsTotal)} label="Subjects" note={`${stats.requiredPeriods} periods/week required`} />
      <Stat icon={CalendarDays} n={String(timetableInfo ? timetableInfo.scheduled : stats.requiredPeriods)} label="Weekly lessons" note={timetableInfo ? `${timetableInfo.scheduled} of ${stats.requiredPeriods} assigned` : "Not generated yet"} />
    </section>
    <section className="dashboard-grid">
      <article className="panel workload">
        <PanelTitle title="Weekly workload" action="View report" />
        {weeklyBars.length === 0 ? <p style={{ fontSize: 11, color: "var(--muted)" }}>Generate a timetable to see this.</p> : <div className="bars">
          {weeklyBars.map(b => <div key={b.label}><span style={{ height: `${Math.max(4, b.count * 2.4)}px` }}><b>{b.count}</b></span><small>{b.label}</small></div>)}
        </div>}
      </article>
      <article className="panel status-card">
        <PanelTitle title="Timetable status" />
        {timetableInfo ? <>
          <div className="status-content"><div className="ring small"><span>{timetableInfo.qualityScore ?? "—"}</span></div><div><span className="status-pill">{timetableInfo.status === "draft" ? "Draft" : timetableInfo.status} · Version {timetableInfo.version}</span><h3>{issues.hard > 0 ? "Needs attention" : "Ready for review"}</h3><p>{timetableInfo.scheduled} of {stats.requiredPeriods} lessons scheduled.</p></div></div>
          <button className="btn full" onClick={() => go("timetable")}>Open timetable editor <ArrowRight /></button>
        </> : <div className="empty-inspector" style={{ padding: "24px 0" }}><CalendarDays /><h3>No timetable yet</h3><p>Generate one once your setup is complete.</p></div>}
      </article>
      <article className="panel validation">
        <PanelTitle title="Validation summary" action="View details" />
        {timetableInfo ? <>
          <p className="validation-head"><span className={`status-pill ${totalIssues > 0 ? "warning" : "success"}`}>{totalIssues === 0 ? "All clear" : `${totalIssues} item${totalIssues === 1 ? "" : "s"} need attention`}</span></p>
          <ValidationItem good={issues.soft === 0} title="Soft preferences" text={issues.soft === 0 ? "No distribution warnings" : `${issues.soft} distribution warning${issues.soft === 1 ? "" : "s"}`} />
          <ValidationItem good={issues.hard === 0} title="Hard conflicts" text={issues.hard === 0 ? "No blocking conflicts" : `${issues.hard} unscheduled assignment${issues.hard === 1 ? "" : "s"}`} />
          <ValidationItem good title="Availability" text="Checked during generation" />
        </> : <p style={{ fontSize: 11, color: "var(--muted)" }}>Generate a timetable to see validation results.</p>}
      </article>
    </section>
    <section className="panel quick">
      <PanelTitle title="Quick actions" />
      <div className="quick-grid"><Quick icon={UsersRound} text="Add teacher" onClick={() => go("teachers")} /><Quick icon={School2} text="Add class" onClick={() => go("levels")} /><Quick icon={FileCheck2} text="Add assignment" onClick={() => go("assignments")} /><Quick icon={Sparkles} text="Generate timetable" onClick={() => go("generate")} /></div>
    </section>
    <section className="panel quick">
      <PanelTitle title="Recommended setup order" />
      <p className="setup-order-description">Each step depends on the one before it — assignments in particular need subjects configured per level first.</p>
      <SetupOrderItem n={1} title="Levels" text="Broad groupings like Form 1 or Primary" onClick={() => go("levels")} />
      <SetupOrderItem n={2} title="Subjects" text="Your school's subject catalog" onClick={() => go("subjects")} />
      <SetupOrderItem n={3} title="Subjects per level" text="Weekly periods and any parallel groups — Levels page, Manage subjects" onClick={() => go("levels")} />
      <SetupOrderItem n={4} title="Class sections" text="The actual classes, e.g. Form 1A" onClick={() => go("levels")} />
      <SetupOrderItem n={5} title="Teachers" text="Who teaches, and optionally which classes" onClick={() => go("teachers")} />
      <SetupOrderItem n={6} title="Teaching assignments" text="Confirms each teacher × subject × class combination" onClick={() => go("assignments")} />
    </section>
  </>;
}
