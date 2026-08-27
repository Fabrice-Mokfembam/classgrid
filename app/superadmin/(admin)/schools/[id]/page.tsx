import Link from "next/link";
import { AlertTriangle, ArrowLeft, Building2, CalendarCheck2, UsersRound } from "lucide-react";
import { getPlatformSchoolDetail } from "@/lib/superadmin-data";

export default async function SuperadminSchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getPlatformSchoolDetail(id);
  if (!detail) return <div className="superadmin-empty"><AlertTriangle /><h1>School not found</h1><p>This school does not exist, or the service role key could not load it.</p><Link className="btn" href="/superadmin/schools">Back to schools</Link></div>;
  const school = detail.school;

  return (
    <div className="superadmin-page">
      <Link className="superadmin-back" href="/superadmin/schools"><ArrowLeft /> Back to schools</Link>
      <section className="superadmin-hero compact">
        <div>
          <span>School detail</span>
          <h1>{school.name}</h1>
          <p>{school.school_type} · {school.curriculum ?? "No curriculum"} · Created {new Date(school.created_at).toLocaleDateString()}</p>
        </div>
        <Link className="btn primary" href={`/${school.slug}`}>Open workspace</Link>
      </section>
      <section className="superadmin-stats">
        <article><span><UsersRound /></span><b>{detail.members.length}</b><strong>Members</strong><small>Users in this workspace</small></article>
        <article><span><Building2 /></span><b>{detail.counts.classes}</b><strong>Classes</strong><small>{detail.counts.levels} levels</small></article>
        <article><span><CalendarCheck2 /></span><b>{detail.counts.timetables}</b><strong>Timetables</strong><small>{detail.counts.published_timetables} published</small></article>
        <article><span><Building2 /></span><b>{detail.counts.assignments}</b><strong>Assignments</strong><small>{detail.counts.teachers} teachers · {detail.counts.subjects} subjects</small></article>
      </section>
      <div className="superadmin-two-col">
        <section className="superadmin-panel">
          <div className="superadmin-panel-head"><div><h2>Members</h2><p>People with access to this school.</p></div><i className={`superadmin-pill ${school.account_status}`}>{school.account_status}</i></div>
          <div className="superadmin-list">
            {detail.members.map(member => <div className="superadmin-list-row" key={member.id}><span><b>{member.full_name ?? "Unnamed user"}</b><small>{member.email ?? "No email"}</small></span><i className="superadmin-pill">{member.role}</i><small>{member.last_sign_in_at ? `Last login ${new Date(member.last_sign_in_at).toLocaleDateString()}` : "No login yet"}</small></div>)}
          </div>
        </section>
        <section className="superadmin-panel">
          <div className="superadmin-panel-head"><div><h2>Recent timetables</h2><p>Latest drafts and published versions.</p></div></div>
          <div className="superadmin-list">
            {detail.latest_timetables.length === 0 ? <p className="superadmin-muted">No timetables yet.</p> : detail.latest_timetables.map(tt => <div className="superadmin-list-row" key={tt.id}><span><b>{tt.name}</b><small>Version {tt.version} · Quality {tt.quality_score ?? "—"}</small></span><i className={`superadmin-pill ${tt.status}`}>{tt.status}</i><small>{new Date(tt.created_at).toLocaleDateString()}</small></div>)}
          </div>
        </section>
      </div>
    </div>
  );
}
