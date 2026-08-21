"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen, CalendarDays, ChevronDown, Clock3, FileCheck2,
  LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen,
  School2, Search, Settings, Sparkles, UsersRound, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSchool } from "@/lib/school-context";
import { APP_NAME, DEFAULT_LOGO_URL } from "@/lib/branding";
import { ErrorBoundary, ErrorState, Skel } from "@/components/shared";

function roleLabel(role: string | null): string {
  if (!role) return "";
  return role.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}
function initialsOf(name: string): string {
  return name.split(" ").filter(Boolean).map(x => x[0]).join("").slice(0, 2).toUpperCase();
}
function SchoolLogoMark({ logoUrl, name, className = "" }: { logoUrl: string | null; name: string | null; className?: string }) {
  return <span className={`school-logo-mark ${className}`}><img src={logoUrl ?? DEFAULT_LOGO_URL} alt={`${name ?? APP_NAME} logo`} /></span>;
}

// ─── Re-exports so existing page files keep working without changes ────────────
export { Dashboard } from "@/components/dashboard";
export { Schedule } from "@/components/schedule";
export { Levels } from "@/components/levels";
export { Subjects } from "@/components/subjects";
export { Teachers } from "@/components/teachers";
export { Availability } from "@/components/availability";
export { Assignments } from "@/components/assignments";
export { Generate } from "@/components/generate";
export { Timetable } from "@/components/timetable";
export { SettingsPage } from "@/components/settings-page";

// ─── Nav config ───────────────────────────────────────────────────────────────
type Page = "dashboard" | "setup" | "levels" | "subjects" | "teachers" | "availability" | "assignments" | "generate" | "timetable" | "settings";

const nav = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "setup", label: "School schedule", icon: Clock3 },
  { id: "levels", label: "Levels & classes", icon: School2 },
  { id: "subjects", label: "Subjects", icon: BookOpen },
  { id: "teachers", label: "Teachers", icon: UsersRound },
  { id: "availability", label: "Availability", icon: CalendarDays },
  { id: "assignments", label: "Teaching assignments", icon: FileCheck2 },
  { id: "generate", label: "Generate timetable", icon: Sparkles },
  { id: "timetable", label: "Timetables", icon: CalendarDays },
  { id: "settings", label: "School settings", icon: Settings },
] as const;

const titles: Record<Page, [string, string]> = {
  dashboard: ["Good morning, Administrator", "Here's what's happening with your timetable setup."],
  setup: ["School schedule", "Define your teaching days, lesson periods and breaks."],
  levels: ["Levels & classes", "Create broad levels and the actual class sections that receive timetables."],
  subjects: ["Subjects", "Manage the subjects offered by your school."],
  teachers: ["Teachers", "Manage teacher profiles and review their workloads."],
  availability: ["Teacher availability", "Set when each teacher can be scheduled for lessons."],
  assignments: ["Teaching assignments", "Connect each teacher, subject and class with its weekly lesson requirement."],
  generate: ["Generate timetable", "Validate your school data before creating a conflict-free timetable."],
  timetable: ["Timetable editor", "Review, move, lock and publish generated lessons."],
  settings: ["School settings", "Manage the profile and account details printed on school timetables."],
};

function pagePath(schoolSlug: string, id: Page) {
  return id === "dashboard" ? `/${schoolSlug}` : `/${schoolSlug}/${id}`;
}

function pageFromPathname(pathname: string, schoolSlug: string): Page {
  const rest = pathname.slice(`/${schoolSlug}`.length).replace(/^\//, "").split("/")[0];
  return (nav.some(n => n.id === rest) ? rest : "dashboard") as Page;
}

// ─── AppShellChrome ───────────────────────────────────────────────────────────
// Sidebar/topbar/error-boundary chrome, shared by every /[school]/* route.
// The active nav item and page heading are derived from the URL itself, not
// local state, so the address bar always matches what's on screen and a
// refresh lands back on the same page.
export function AppShellChrome({ schoolSlug, children }: { schoolSlug: string; children: ReactNode }) {
  const [mobile, setMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const page = pageFromPathname(pathname, schoolSlug);
  const { schoolId, schoolSlug: realSlug, schoolName, schoolLogoUrl, academicYearName, role, fullName, loading: schoolLoading, error: schoolError, retry: schoolRetry } = useSchool();

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem("classgrid-sidebar-collapsed") === "true");
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed(collapsed => {
      const next = !collapsed;
      window.localStorage.setItem("classgrid-sidebar-collapsed", String(next));
      return next;
    });
  }

  // The URL slug is taken on faith by the server guard; once the real membership
  // loads client-side, correct a stale/wrong one here.
  useEffect(() => {
    if (schoolLoading || schoolError) return;
    if (!schoolId) { router.replace("/auth"); return; }
    if (realSlug && realSlug !== schoolSlug) router.replace(pathname.replace(`/${schoolSlug}`, `/${realSlug}`));
  }, [schoolLoading, schoolError, schoolId, realSlug, schoolSlug, pathname, router]);

  if (schoolError) return (
    <div className="app-shell" style={{ display: "grid", placeItems: "center" }}>
      <ErrorState message={schoolError} onRetry={schoolRetry} />
    </div>
  );

  return (
    <div className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <span className="brand-mark logo"><img src={DEFAULT_LOGO_URL} alt={`${APP_NAME} logo`} /></span>
          <span className="brand-name">{APP_NAME}</span>
          <button
            className="sidebar-toggle"
            type="button"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!sidebarCollapsed}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggleSidebar}
          >
            {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </button>
          <button className="mobile-close" aria-label="Close navigation" onClick={() => setMobile(false)}><X /></button>
        </div>
        <div className="school-switch">
          <SchoolLogoMark logoUrl={schoolLogoUrl} name={schoolName} />
          <div>
            <b>{schoolLoading ? <Skel w="80px" /> : schoolName ?? "Your school"}</b>
            <small>{schoolLoading ? <Skel w="50px" /> : academicYearName ?? ""}</small>
          </div>
          <ChevronDown />
        </div>
        <nav>
          {nav.map(n => (
            <Link
              key={n.id}
              href={pagePath(schoolSlug, n.id)}
              className={page === n.id ? "nav-item active" : "nav-item"}
              title={sidebarCollapsed ? n.label : undefined}
              aria-label={sidebarCollapsed ? n.label : undefined}
              onClick={() => setMobile(false)}
            >
              <n.icon />
              <span className="nav-label">{n.label}</span>
              {n.id === "generate" && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item sidebar-signout" title={sidebarCollapsed ? "Sign out" : undefined} aria-label={sidebarCollapsed ? "Sign out" : undefined} onClick={async () => {
            if (!window.confirm(`Sign out of ${APP_NAME}?`)) return;
            const supabase = createClient();
            if (supabase) await supabase.auth.signOut();
            router.push("/");
          }}>
            <LogOut /> <span className="nav-label">Sign out</span>
          </button>
        </div>
      </aside>

      {mobile && <div className="scrim" onClick={() => setMobile(false)} />}

      <div className="app-main">
        <header className="topbar">
          <button className="menu-btn" aria-label="Open navigation" onClick={() => setMobile(true)}><Menu /></button>
          <div className="crumb">School workspace <span>/</span> {titles[page][0]}</div>
          <div className="top-actions">
            <button className="icon-btn"><Search /></button>
            <div className="top-school">
              <SchoolLogoMark logoUrl={schoolLogoUrl} name={schoolName} className="small" />
              <div><b>{schoolLoading ? <Skel w="70px" /> : schoolName ?? "Your school"}</b><small>{schoolLoading ? <Skel w="40px" /> : academicYearName ?? ""}</small></div>
            </div>
            <div className="avatar">{schoolLoading ? "" : fullName ? initialsOf(fullName) : "?"}</div>
            <div className="admin-name"><b>{schoolLoading ? <Skel w="70px" /> : fullName ?? "Unnamed admin"}</b><small>{schoolLoading ? <Skel w="90px" /> : roleLabel(role)}</small></div>
          </div>
        </header>
        <main className="workspace">
          <div className="page-heading">
            <div>
              <h1>{titles[page][0]}</h1>
              <p>{titles[page][1]}</p>
            </div>
          </div>
          <ErrorBoundary key={pathname}>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
