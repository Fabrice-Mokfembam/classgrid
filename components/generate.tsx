"use client";
import { useCallback, useEffect, useState } from "react";
import { LockKeyhole, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSchool } from "@/lib/school-context";
import type { GenerationSummary } from "@/lib/types";
import { ErrorState, firstError, Skel } from "@/components/shared";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

type Page = "dashboard" | "setup" | "levels" | "subjects" | "teachers" | "availability" | "assignments" | "generate" | "timetable" | "settings";
function pagePath(schoolSlug: string, id: Page) { return id === "dashboard" ? `/${schoolSlug}` : `/${schoolSlug}/${id}`; }

function ValidationItem({ good, title, text }: { good: boolean; title: string; text: string }) {
  return <div className="validation-item">{good ? <CheckCircle2 className="good" /> : <AlertTriangle className="warn" />}<div><b>{title}</b><small>{text}</small></div></div>;
}

export function Generate() {
  const router = useRouter();
  const { school } = useParams<{ school: string }>();
  const { schoolId, academicYearId, loading: schoolLoading } = useSchool();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
    setLoading(true); setLoadError(null);
    const [classesRes, teachersRes, assignmentsRes, daysRes, periodsRes] = await Promise.all([
      supabase.from("class_sections").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("status", "active"),
      supabase.from("teachers").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("status", "active"),
      supabase.from("teaching_assignments").select("periods_per_week").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("status", "active"),
      supabase.from("working_days").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("is_active", true),
      supabase.from("period_slots").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("kind", "lesson"),
    ]);
    const err = firstError(classesRes, teachersRes, assignmentsRes, daysRes, periodsRes);
    if (err) { setLoadError(err); setLoading(false); return; }
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
    if (!window.confirm("Generate a new conflict-free timetable now?")) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schoolId, academicYearId }) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Generation failed"); return; }
      const summary = data as GenerationSummary;
      toast.success(summary.hardConflicts > 0
        ? `${summary.scheduled} of ${summary.totalRequired} lessons scheduled — ${summary.hardConflicts} assignment(s) could not be fully placed`
        : `${summary.scheduled} lessons scheduled with no hard conflicts`);
      router.push(pagePath(school, "timetable"));
    } catch {
      toast.error("Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  if (loadError) return <ErrorState message={loadError} onRetry={load} />;

  return <div className="generate-layout">
    <section className="panel generate-card">
      <div className="generate-title"><span><Sparkles /></span><div><h2>Ready to generate</h2><p>{loading ? <Skel w="220px" /> : `We checked the active configuration across all ${classCount} classes.`}</p></div></div>
      {loading ? <div className="generation-summary">{Array.from({ length: 4 }).map((_, i) => <div key={i}><span><Skel w="60%" sm /></span><Skel w="30%" /></div>)}</div> : <div className="generation-summary">
        <div><span>Classes</span><b>{classCount}</b></div>
        <div><span>Teaching assignments</span><b>{assignmentCount}</b></div>
        <div><span>Weekly lessons</span><b>{weeklyLessons}</b></div>
        <div><span>Available slots</span><b>{availableSlots}</b></div>
      </div>}
      {loading ? <div className="check-list">{Array.from({ length: 4 }).map((_, i) => <div className="validation-item" key={i}><span className="skeleton" style={{ width: 18, height: 18, borderRadius: "50%" }} /><div><Skel w="140px" /></div></div>)}</div> : <div className="check-list">
        <ValidationItem good={scheduleReady} title="School structure" text={scheduleReady ? `${dayCount} teaching days and ${lessonPeriodCount} lesson periods configured` : "Set up teaching days and lesson periods on School schedule first"} />
        <ValidationItem good={teacherCount > 0} title="Teachers" text={teacherCount > 0 ? `${teacherCount} active teachers` : "No active teachers yet"} />
        <ValidationItem good={assignmentsReady} title="Teaching assignments" text={assignmentsReady ? `${assignmentCount} active assignments` : "No teaching assignments yet"} />
        <ValidationItem good={capacityReady} title="Capacity" text={capacityReady ? "Enough weekly slots for the required lessons" : `Only ${availableSlots} slots available for ${weeklyLessons} required lessons`} />
      </div>}
      <button className="btn primary huge" onClick={run} disabled={!canGenerate || loading}><Sparkles /> {generating ? "Generating…" : "Generate conflict-free timetable"}</button>
      <p className="center muted">Generation runs on the server. You can safely leave this page and return later.</p>
    </section>
    <aside className="panel rules-card">
      <h3>Rules being enforced</h3>
      <div><LockKeyhole /><span><b>No teacher clashes</b><small>A teacher is only in one class at a time.</small></span></div>
      <div><LockKeyhole /><span><b>No class clashes</b><small>A class receives one lesson per period.</small></span></div>
      <div><LockKeyhole /><span><b>Availability respected</b><small>Unavailable slots are never used.</small></span></div>
      <div><Sparkles /><span><b>Balanced distribution</b><small>Lessons are spread through the week.</small></span></div>
    </aside>
  </div>;
}
