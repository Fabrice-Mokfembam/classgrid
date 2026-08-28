"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen, CalendarDays, ChevronDown, Clock3, FileCheck2,
  HelpCircle, LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen,
  School2, Settings, Sparkles, UsersRound, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSchool } from "@/lib/school-context";
import { APP_NAME, DEFAULT_LOGO_URL } from "@/lib/branding";
import { ErrorBoundary, ErrorState, Skel } from "@/components/shared";

function SchoolLogoMark({ logoUrl, name, className = "" }: { logoUrl: string | null; name: string | null; className?: string }) {
  return <span className={`school-logo-mark ${className}`}><img src={logoUrl ?? DEFAULT_LOGO_URL} alt={`${name ?? APP_NAME} logo`} /></span>;
}

const setupHelpSteps = [
  ["School schedule", "Set teaching days, lesson periods, and breaks first."],
  ["Levels & classes", "Create levels like Form 1, then real classes like Form 1A."],
  ["Subjects", "Add every subject once in the school catalog."],
  ["Subjects per level", "Choose what each level studies and how many periods per week."],
  ["Teachers", "Add staff and the subjects/classes they can teach."],
  ["Teaching assignments", "Connect teacher, subject, class, and weekly periods."],
  ["Availability", "Block only the times a teacher truly cannot teach."],
  ["Generate & validate", "Generate, check issues, repair or regenerate, then publish."],
];

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
  { id: "settings", label: "School profile", icon: Settings },
] as const;

const navGroups = [
  { label: "Workspace", ids: ["dashboard"] },
  { label: "Setup", ids: ["setup", "levels", "subjects", "teachers", "availability", "assignments"] },
  { label: "Timetable", ids: ["generate", "timetable"] },
  { label: "Administration", ids: ["settings"] },
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
  settings: ["School profile", "Manage the school identity and details printed on timetables."],
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
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [setupHelpOpen, setSetupHelpOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const page = pageFromPathname(pathname, schoolSlug);
  const go = (p: Page) => router.push(pagePath(schoolSlug, p));
  const { schoolId, schoolSlug: realSlug, schoolName, schoolLogoUrl, academicYearName, loading: schoolLoading, error: schoolError, retry: schoolRetry } = useSchool();

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

  async function signOut() {
    const supabase = createClient();
    if (!supabase) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/");
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
        <div className="school-switch sidebar-school-mobile">
          <SchoolLogoMark logoUrl={schoolLogoUrl} name={schoolName} />
          <div>
            <b>{schoolLoading ? <Skel w="80px" /> : schoolName ?? "Your school"}</b>
            <small>{schoolLoading ? <Skel w="50px" /> : academicYearName ?? ""}</small>
          </div>
          <ChevronDown />
        </div>
        <nav>
          {navGroups.map(group => (
            <div className="nav-group" key={group.label}>
              <span className="nav-group-label">{group.label}</span>
              {group.ids.map(id => {
                const n = nav.find(item => item.id === id)!;
                return <Link
                  key={n.id}
                  href={pagePath(schoolSlug, n.id)}
                  className={page === n.id ? "nav-item active" : "nav-item"}
                  title={sidebarCollapsed ? n.label : undefined}
                  aria-label={sidebarCollapsed ? n.label : undefined}
                  onClick={() => setMobile(false)}
                >
                  <n.icon />
                  <span className="nav-label">{n.label}</span>
                </Link>;
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item sidebar-signout" title={sidebarCollapsed ? "Sign out" : undefined} aria-label={sidebarCollapsed ? "Sign out" : undefined} onClick={() => setSignOutOpen(true)}>
            <LogOut /> <span className="nav-label">Sign out</span>
          </button>
        </div>
      </aside>

      {mobile && <div className="scrim" onClick={() => setMobile(false)} />}

      <div className="app-main">
        <header className="topbar">
          <button className="menu-btn" aria-label="Open navigation" onClick={() => setMobile(true)}><Menu /></button>
          <div className="crumb">School workspace <span>/</span> {nav.find(n => n.id === page)?.label}</div>
          <div className="top-actions">
            <div className="top-school">
              <SchoolLogoMark logoUrl={schoolLogoUrl} name={schoolName} className="small" />
              <div><b>{schoolLoading ? <Skel w="70px" /> : schoolName ?? "Your school"}</b><small>{schoolLoading ? <Skel w="40px" /> : academicYearName ?? ""}</small></div>
            </div>
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
      <button className="setup-help-fab" type="button" aria-label="Open setup help" onClick={() => setSetupHelpOpen(true)}><HelpCircle /><span>Setup help</span></button>
      {setupHelpOpen && <div className="modal-backdrop setup-help-backdrop" onClick={() => setSetupHelpOpen(false)}>
        <section className="modal setup-help-modal" role="dialog" aria-modal="true" aria-labelledby="setup-help-title" onClick={event => event.stopPropagation()}>
          <div className="modal-head">
            <div><h2 id="setup-help-title">Build your timetable in this order</h2><p>Follow the steps from the school grid to the final published timetable.</p></div>
            <button className="icon-btn" type="button" aria-label="Close setup help" onClick={() => setSetupHelpOpen(false)}><X /></button>
          </div>
          <div className="setup-help-steps">
            {setupHelpSteps.map((step, index) => <button type="button" key={step[0]} onClick={() => { setSetupHelpOpen(false); go(index === 0 ? "setup" : index === 1 || index === 3 ? "levels" : index === 2 ? "subjects" : index === 4 ? "teachers" : index === 5 ? "assignments" : index === 6 ? "availability" : "generate"); }}>
              <span>{index + 1}</span>
              <div><b>{step[0]}</b><small>{step[1]}</small></div>
            </button>)}
          </div>
          <footer><button type="button" className="btn" onClick={() => router.push("/guide")}>Open full guide <HelpCircle /></button><button type="button" className="btn primary" onClick={() => setSetupHelpOpen(false)}>Got it</button></footer>
        </section>
      </div>}
      {signOutOpen && <div className="modal-backdrop" onClick={() => { if (!signingOut) setSignOutOpen(false); }}>
        <section className="modal signout-modal" role="dialog" aria-modal="true" aria-labelledby="signout-title" onClick={event => event.stopPropagation()}>
          <div className="signout-modal-icon"><LogOut /></div>
          <h2 id="signout-title">Sign out of {APP_NAME}?</h2>
          <p>Your work is already saved. You will need to sign in again to return to this school workspace.</p>
          <footer><button type="button" className="btn" disabled={signingOut} onClick={() => setSignOutOpen(false)}>Cancel</button><button type="button" className="btn signout-confirm" disabled={signingOut} onClick={signOut}><LogOut /> {signingOut ? "Signing out…" : "Sign out"}</button></footer>
        </section>
      </div>}
    </div>
  );
}
