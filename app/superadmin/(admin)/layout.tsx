import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Building2, LogOut, UsersRound } from "lucide-react";
import { APP_NAME, DEFAULT_LOGO_URL } from "@/lib/branding";
import { getSuperadminSession } from "@/lib/superadmin-auth";

export default async function ProtectedSuperadminLayout({ children }: { children: ReactNode }) {
  const session = await getSuperadminSession();
  if (!session) redirect("/superadmin/login");

  return (
    <div className="superadmin-shell">
      <aside className="superadmin-sidebar">
        <Link href="/superadmin" className="superadmin-brand">
          <img src={DEFAULT_LOGO_URL} alt={`${APP_NAME} logo`} />
          <span><b>{APP_NAME}</b><small>Platform owner</small></span>
        </Link>
        <nav>
          <Link href="/superadmin"><BarChart3 /> Overview</Link>
          <Link href="/superadmin/schools"><Building2 /> Schools</Link>
          <Link href="/superadmin/users"><UsersRound /> Users</Link>
        </nav>
      </aside>
      <div className="superadmin-main">
        <header className="superadmin-topbar">
          <div><b>Superadmin</b><small>{session.email}</small></div>
          <form action="/api/superadmin/logout" method="post"><button className="btn" type="submit"><LogOut /> Sign out</button></form>
        </header>
        <main className="superadmin-workspace">{children}</main>
      </div>
    </div>
  );
}
