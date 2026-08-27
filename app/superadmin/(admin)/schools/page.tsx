import Link from "next/link";
import { AlertTriangle, Building2, ExternalLink } from "lucide-react";
import { listPlatformSchools } from "@/lib/superadmin-data";

export default async function SuperadminSchoolsPage() {
  const schools = await listPlatformSchools();
  if (!schools) return <div className="superadmin-empty"><AlertTriangle /><h1>Could not load schools</h1><p>Check the service role key in your environment.</p></div>;

  return (
    <div className="superadmin-page">
      <div className="superadmin-title"><span>Schools</span><h1>School workspaces</h1><p>Every school registered on ClassGrid.</p></div>
      <section className="superadmin-panel">
        <div className="superadmin-table">
          <div className="superadmin-table-head"><span>School</span><span>Owner</span><span>Setup</span><span>Status</span><span></span></div>
          {schools.length === 0 ? <div className="superadmin-empty-row">No schools yet.</div> : schools.map(school => (
            <div className="superadmin-table-row" key={school.id}>
              <span className="superadmin-school-cell">
                <i><Building2 /></i>
                <span><b>{school.name}</b><small>{school.current_academic_year ?? "No academic year"} · {school.city ?? school.country ?? "No location"}</small></span>
              </span>
              <span><b>{school.owner_name ?? "No owner name"}</b><small>{school.owner_email ?? "No owner email"}</small></span>
              <span><b>{school.teachers_count} teachers · {school.classes_count} classes</b><small>{school.subjects_count} subjects · {school.timetables_count} timetables</small></span>
              <span><i className={`superadmin-pill ${school.account_status}`}>{school.account_status}</i></span>
              <span className="superadmin-row-actions"><Link className="btn" href={`/superadmin/schools/${school.id}`}>Inspect</Link><Link className="icon-btn" title="Open school workspace" href={`/${school.slug}`}><ExternalLink /></Link></span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
