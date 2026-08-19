"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen, CalendarDays, ChevronDown, Clock3, FileCheck2,
  LayoutDashboard, LogOut, Menu, School2, Search, Settings,
  Sparkles, UsersRound, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSchool } from "@/lib/school-context";
import { ErrorBoundary, ErrorState, Skel } from "@/components/shared";

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
  const router = useRouter();
  const pathname = usePathname();
  const page = pageFromPathname(pathname, schoolSlug);
  const { schoolId, schoolSlug: realSlug, schoolName, academicYearName, loading: schoolLoading, error: schoolError, retry: schoolRetry } = useSchool();

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
    <div className="app-shell">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <span className="brand-mark"><CalendarDays /></span>
          ClassGrid
          <button className="mobile-close" onClick={() => setMobile(false)}><X /></button>
        </div>
        <div className="school-switch">
          <span><School2 /></span>
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
              onClick={() => setMobile(false)}
            >
              <n.icon />
              {n.label}
              {n.id === "generate" && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="setup-mini">
            <b>Setup progress <span>82%</span></b>
            <div className="progress"><i style={{ width: "82%" }} /></div>
            <small>6 of 7 steps completed</small>
          </div>
          <button className="nav-item" onClick={async () => {
            if (!window.confirm("Sign out of ClassGrid?")) return;
            const supabase = createClient();
            if (supabase) await supabase.auth.signOut();
            router.push("/");
          }}>
            <LogOut /> Sign out
          </button>
        </div>
      </aside>

      {mobile && <div className="scrim" onClick={() => setMobile(false)} />}

      <div className="app-main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setMobile(true)}><Menu /></button>
          <div className="crumb">School workspace <span>/</span> {titles[page][0]}</div>
          <div className="top-actions">
            <button className="icon-btn"><Search /></button>
            <div className="avatar">GA</div>
            <div className="admin-name"><b>Grace Admin</b><small>School Administrator</small></div>
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
