"use client";

import { useState } from "react";
import {
  ArrowRight, BookOpen, CalendarDays, CheckCircle2, ChevronDown, Clock3,
  FileCheck2, Grip, GripVertical, Layers, LockKeyhole, Menu, School2, ShieldCheck,
  Sparkles, UsersRound, X,
} from "lucide-react";
import { AuthScreen } from "@/components/auth-screen";
import { AppShell } from "@/components/app-shell";

const CAPABILITIES = [
  { icon: Clock3, title: "Academic schedule", text: "Define teaching days, lesson periods and breaks once — every other screen builds on it." },
  { icon: Layers, title: "Levels & class sections", text: "Separate broad levels like Form 1 from the exact classes, such as Form 1A, that receive a timetable." },
  { icon: BookOpen, title: "Subjects", text: "Manage every subject your school offers, each with its own colour for fast scanning." },
  { icon: UsersRound, title: "Teacher profiles", text: "Contact details, subjects taught and weekly workload in one record per teacher." },
  { icon: CalendarDays, title: "Availability grid", text: "Mark exactly when each teacher can be scheduled, period by period." },
  { icon: FileCheck2, title: "Teaching assignments", text: "Connect every teacher, subject and class with its weekly lesson requirement." },
  { icon: ShieldCheck, title: "Conflict-free generation", text: "Hard conflicts between teachers and classes are structurally impossible, not just flagged." },
  { icon: GripVertical, title: "Drag-and-drop editor", text: "Move, lock and inspect individual lessons by hand without breaking a single rule." },
];

const STEPS = [
  { n: "01", title: "Set up your school", text: "Register your school and define the academic year, teaching days, periods and breaks." },
  { n: "02", title: "Add your staff and classes", text: "Build your levels, class sections, subjects and teacher profiles." },
  { n: "03", title: "Enter availability and load", text: "Mark when each teacher can teach and how many periods every class needs." },
  { n: "04", title: "Generate and publish", text: "Run the generator, resolve any warnings, adjust by hand, then publish." },
];

const WITHOUT = [
  "Hours rebuilding the grid in a spreadsheet every term",
  "Teacher clashes discovered after the timetable is printed",
  "One availability change means checking every class by hand",
  "Class, teacher and master copies drift out of sync",
];
const WITH = [
  "A full timetable generated from data you already entered",
  "Hard conflicts are structurally impossible, not just flagged",
  "Update availability once, regenerate only what's unlocked",
  "Class, teacher and master views are the same underlying data",
];

const FAQS = [
  { q: "Will this work with our academic calendar and curriculum?", a: "Yes. Teaching days, periods, breaks and levels are fully configurable per school and academic year, so the schedule matches your calendar rather than the other way around." },
  { q: "What happens to lessons already scheduled if a teacher becomes unavailable?", a: "Update their availability and re-run generation for the unlocked lessons only. Anything you've manually locked stays exactly where you put it." },
  { q: "Can more than one administrator work on the timetable?", a: "Yes. Every administrator you add works inside the same school workspace with role-based permissions for who can edit versus just view." },
  { q: "Is our school's data visible to other schools on the platform?", a: "No. Every record is scoped to your school and enforced with row-level security at the database layer, not just hidden in the interface." },
];

export default function Home() {
  const [screen, setScreen] = useState<"landing" | "auth" | "app">("landing");
  const [navOpen, setNavOpen] = useState(false);
  if (screen === "auth") return <AuthScreen onComplete={() => setScreen("app")} onBack={() => setScreen("landing")} />;
  if (screen === "app") return <AppShell onLogout={() => setScreen("landing")} />;

  return (
    <main className="landing">
      <nav className="landing-nav">
        <div className="brand"><span className="brand-mark"><CalendarDays size={20} /></span>TimetableFlow</div>
        <div className="nav-links">
          <a href="#capabilities">Capabilities</a>
          <a href="#how">How it works</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="nav-actions">
          <button className="btn ghost" onClick={() => setScreen("auth")}>Sign in</button>
          <button className="btn primary" onClick={() => setScreen("auth")}>Create school account <ArrowRight size={16} /></button>
        </div>
        <button className="nav-toggle" aria-label={navOpen ? "Close menu" : "Open menu"} aria-expanded={navOpen} onClick={() => setNavOpen(v => !v)}>
          {navOpen ? <X /> : <Menu />}
        </button>
      </nav>
      {navOpen && (
        <div className="nav-mobile">
          <a href="#capabilities" onClick={() => setNavOpen(false)}>Capabilities</a>
          <a href="#how" onClick={() => setNavOpen(false)}>How it works</a>
          <a href="#faq" onClick={() => setNavOpen(false)}>FAQ</a>
          <hr />
          <button className="btn ghost" onClick={() => setScreen("auth")}>Sign in</button>
          <button className="btn primary" onClick={() => setScreen("auth")}>Create school account <ArrowRight size={16} /></button>
        </div>
      )}

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={15} /> Timetables without the weekly struggle</div>
          <h1>Build a conflict-free school timetable in minutes.</h1>
          <p>Configure your school, add teacher availability and teaching loads, then generate, adjust and publish every class timetable from one place.</p>
          <div className="hero-actions">
            <button className="btn primary large" onClick={() => setScreen("auth")}>Start your school setup <ArrowRight size={18} /></button>
            <span>No credit card required</span>
          </div>
          <div className="trust-row">
            <span><CheckCircle2 /> Multi-school data isolation</span>
            <span><CheckCircle2 /> Manual drag-and-drop corrections</span>
          </div>
        </div>
        <div className="hero-product">
          <div className="product-top"><span className="mini-logo"><School2 /> Excellence Bilingual Academy</span><span className="status-pill success">Ready to publish</span></div>
          <div className="mini-stats"><div><b>24</b><span>Teachers</span></div><div><b>12</b><span>Classes</span></div><div><b>186</b><span>Lessons</span></div></div>
          <div className="mini-grid">
            <div className="mini-head"></div>
            {["Mon", "Tue", "Wed", "Thu", "Fri"].map(x => <div className="mini-head" key={x}>{x}</div>)}
            {[1, 2, 3, 4].flatMap(p => [
              <div className="mini-period" key={`p${p}`}>P{p}</div>,
              ...["math", "english", "science", "french", "tech"].map((c, i) => (
                <div className={`mini-lesson ${c}`} key={`${p}-${i}`}><span>{["Mathematics", "English", "Physics", "French", "Computer"][i]}</span><LockKeyhole size={10} /></div>
              )),
            ])}
          </div>
          <div className="drag-hint"><Grip /> Drag to adjust <span>0 hard conflicts</span></div>
        </div>
      </section>

      <section className="compare section alt-bg">
        <div className="section-head">
          <span className="kicker">The problem</span>
          <h2>Timetabling shouldn't take a week every term.</h2>
          <p>Most schools still build their timetable by hand, then spend the first few weeks of term fixing the clashes nobody caught.</p>
        </div>
        <div className="compare-grid">
          <div className="compare-card without">
            <h3>Without TimetableFlow</h3>
            <ul>{WITHOUT.map(t => <li key={t}><X /> {t}</li>)}</ul>
          </div>
          <div className="compare-card with">
            <h3>With TimetableFlow</h3>
            <ul>{WITH.map(t => <li key={t}><CheckCircle2 /> {t}</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="how section" id="how">
        <div className="section-head">
          <span className="kicker">How it works</span>
          <h2>From a blank workspace to a published timetable.</h2>
        </div>
        <div className="steps">
          {STEPS.map(s => (
            <div className="step-card" key={s.n}>
              <span>{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="capabilities section alt-bg" id="capabilities">
        <div className="section-head">
          <span className="kicker">Capabilities</span>
          <h2>Everything the timetable office actually needs.</h2>
        </div>
        <div className="cap-grid">
          {CAPABILITIES.map(c => (
            <div className="cap-card" key={c.title}>
              <span><c.icon /></span>
              <b>{c.title}</b>
              <p>{c.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="guarantee">
        <div className="section guarantee-layout">
          <div className="guarantee-copy">
            <span className="kicker">Guaranteed, not just checked</span>
            <h2>Four rules every generated timetable follows.</h2>
            <p>These aren't validation warnings you can dismiss — they're enforced at generation time, and enforced again at the database level.</p>
          </div>
          <div className="guarantee-grid">
            <div><LockKeyhole /><div><b>No teacher clashes</b><small>A teacher is only ever in one class at a time.</small></div></div>
            <div><LockKeyhole /><div><b>No class clashes</b><small>A class receives one lesson per period, no exceptions.</small></div></div>
            <div><ShieldCheck /><div><b>Availability respected</b><small>Unavailable slots are never used when generating.</small></div></div>
            <div><Sparkles /><div><b>Balanced distribution</b><small>Lessons are spread through the week instead of stacked.</small></div></div>
          </div>
        </div>
      </section>

      <section className="faq section" id="faq">
        <div className="section-head center">
          <span className="kicker">FAQ</span>
          <h2>Questions administrators ask first.</h2>
        </div>
        <div className="faq-list">
          {FAQS.map(f => (
            <details key={f.q}>
              <summary>{f.q}<ChevronDown /></summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="cta-banner">
        <h2>Stop rebuilding your timetable by hand.</h2>
        <p>Set up your school and see a generated timetable the same day.</p>
        <button className="btn primary large" onClick={() => setScreen("auth")}>Start your school setup <ArrowRight size={18} /></button>
      </section>

      <footer className="site-footer">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="brand"><span className="brand-mark"><CalendarDays size={20} /></span>TimetableFlow</div>
            <p>Conflict-free school timetabling for multi-school administrators.</p>
          </div>
          <div className="footer-cols">
            <div><b>Product</b><a href="#capabilities">Capabilities</a><a href="#how">How it works</a><a href="#faq">FAQ</a></div>
            <div><b>Company</b><a href="#">About</a><a href="#">Contact</a></div>
            <div><b>Legal</b><a href="#">Privacy</a><a href="#">Terms</a></div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 TimetableFlow.</span>
          <span>Built for the people who actually build the timetable.</span>
        </div>
      </footer>
    </main>
  );
}
