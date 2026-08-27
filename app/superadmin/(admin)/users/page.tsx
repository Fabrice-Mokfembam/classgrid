import Link from "next/link";
import { AlertTriangle, UsersRound } from "lucide-react";
import { listPlatformSchools } from "@/lib/superadmin-data";

export default async function SuperadminUsersPage() {
  const schools = await listPlatformSchools();
  if (!schools) return <div className="superadmin-empty"><AlertTriangle /><h1>Could not load users</h1><p>Check the service role key in your environment.</p></div>;
  const totalMembers = schools.reduce((sum, school) => sum + Number(school.members_count ?? 0), 0);

  return (
    <div className="superadmin-page">
      <div className="superadmin-title"><span>Users</span><h1>Platform users</h1><p>MVP view: users are grouped by school owner and member counts.</p></div>
      <section className="superadmin-stats single"><article><span><UsersRound /></span><b>{totalMembers}</b><strong>Total memberships</strong><small>Across {schools.length} school workspaces</small></article></section>
      <section className="superadmin-panel">
        <div className="superadmin-table">
          <div className="superadmin-table-head"><span>School</span><span>Owner</span><span>Members</span><span></span></div>
          {schools.map(school => <div className="superadmin-table-row users" key={school.id}><span><b>{school.name}</b></span><span><b>{school.owner_name ?? "No owner name"}</b><small>{school.owner_email ?? "No owner email"}</small></span><span>{school.members_count}</span><span><Link className="btn" href={`/superadmin/schools/${school.id}`}>Inspect</Link></span></div>)}
        </div>
      </section>
    </div>
  );
}
