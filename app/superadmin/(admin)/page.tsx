import Link from "next/link";
import { AlertTriangle, Building2, CalendarCheck2, GraduationCap, UsersRound } from "lucide-react";
import { getPlatformOverview } from "@/lib/superadmin-data";

export default async function SuperadminPage() {
  const overview = await getPlatformOverview();
  if (!overview) return <div className="superadmin-empty"><AlertTriangle /><h1>Could not load platform overview</h1><p>Check the service role key in your environment.</p></div>;

  const stats = [
    { label: "Schools", value: overview.schools, detail: `${overview.active_schools} active`, icon: Building2 },
    { label: "Platform users", value: overview.users, detail: "Across all schools", icon: UsersRound },
    { label: "Timetables", value: overview.timetables, detail: `${overview.published_timetables} published`, icon: CalendarCheck2 },
    { label: "School resources", value: overview.teachers + overview.classes + overview.subjects, detail: `${overview.teachers} teachers · ${overview.classes} classes · ${overview.subjects} subjects`, icon: GraduationCap },
  ];

  return (
    <div className="superadmin-page">
      <section className="superadmin-hero">
        <div>
          <span>Platform overview</span>
          <h1>Watch every ClassGrid school from one place.</h1>
          <p>Track schools, users, generated timetables and recent generator activity without entering each workspace.</p>
        </div>
        <Link className="btn primary" href="/superadmin/schools">View schools</Link>
      </section>

      <section className="superadmin-stats">
        {stats.map(item => <article key={item.label}><span><item.icon /></span><b>{item.value}</b><strong>{item.label}</strong><small>{item.detail}</small></article>)}
      </section>

      <section className="superadmin-panel">
        <div className="superadmin-panel-head"><div><h2>Latest generation runs</h2><p>Recent timetable activity across the platform.</p></div></div>
        <div className="superadmin-list">
          {overview.latest_generation_runs.length === 0 ? <p className="superadmin-muted">No generation runs yet.</p> : overview.latest_generation_runs.map(run => (
            <div className="superadmin-list-row" key={run.id}>
              <span><b>{run.school_name}</b><small>{new Date(run.created_at).toLocaleString()}</small></span>
              <i className={`superadmin-pill ${run.status}`}>{run.status}</i>
              <small>{run.error_message ?? `${run.progress}% progress`}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
