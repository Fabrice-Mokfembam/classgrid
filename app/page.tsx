"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, BookOpen, CalendarDays, CheckCircle2, ChevronDown, Clock3,
  FileCheck2, GripVertical, Layers, LockKeyhole, Menu, School2, ShieldCheck,
  Sparkles, UsersRound, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchMySchoolSlug } from "@/lib/school-context";
import { APP_NAME, DEFAULT_LOGO_URL, WORDMARK_LOGO_URL } from "@/lib/branding";
import { HeroPreviewMotion, HeroReveal, MotionCard, Reveal } from "@/components/landing-motion";

const LANDING_LOGO_URL = WORDMARK_LOGO_URL;
const LANDING_MARK_URL = DEFAULT_LOGO_URL;

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

const HERO_SCHEDULE = [
  [
    { subject: "Mathematics", teacher: "A. Ngwa", tone: "blue" },
    { subject: "English", teacher: "T. Ashu", tone: "purple" },
    { subject: "Physics", teacher: "D. Lum", tone: "green" },
    { subject: "Computer Science", teacher: "P. Bih", tone: "coral" },
    { subject: "History", teacher: "M. Yong", tone: "violet" },
  ],
  [
    { subject: "Biology", teacher: "C. Bih", tone: "green" },
    { subject: "Mathematics", teacher: "A. Ngwa", tone: "blue" },
    { subject: "French", teacher: "G. Nde", tone: "coral" },
    { subject: "English", teacher: "T. Ashu", tone: "purple" },
    { subject: "Chemistry", teacher: "D. Lum", tone: "green" },
  ],
  [
    { subject: "Geography", teacher: "M. Yong", tone: "violet" },
    { subject: "Physics", teacher: "D. Lum", tone: "green" },
    { subject: "Mathematics", teacher: "A. Ngwa", tone: "blue" },
    { subject: "Commerce", teacher: "P. Bih", tone: "coral" },
    { subject: "English", teacher: "T. Ashu", tone: "purple" },
  ],
  [
    { subject: "English", teacher: "T. Ashu", tone: "purple" },
    { subject: "Computer Science", teacher: "P. Bih", tone: "coral" },
    { subject: "History", teacher: "M. Yong", tone: "violet" },
    { subject: "Mathematics", teacher: "A. Ngwa", tone: "blue" },
    { subject: "Biology", teacher: "C. Bih", tone: "green" },
  ],
];

export default function Home() {
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const goToAuth = (mode: "signin" | "signup" = "signup") => router.push(mode === "signin" ? "/auth?mode=signin" : "/auth");

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    if (!supabase) { setCheckingSession(false); return; }
    (async () => {
      try {
        const slug = await fetchMySchoolSlug(supabase);
        if (cancelled) return;
        if (slug) { router.replace(`/${slug}`); return; }
      } catch (error) {
        console.error("Failed to check session:", error);
      }
      if (!cancelled) setCheckingSession(false);
    })();
    return () => { cancelled = true; };
  }, [router]);

  if (checkingSession) return <div className="app-loading"><img className="app-loading-logo" src={LANDING_MARK_URL} alt={`${APP_NAME} logo`} /></div>;

  return (
    <main className="landing">
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-brand"><img src={LANDING_LOGO_URL} alt={`${APP_NAME} logo`} /></div>
          <div className="nav-links">
            <a href="#how">How it works</a>
            <a href="#capabilities">Product</a>
            <a href="/guide">Setup guide</a>
            <a href="#faq">Questions</a>
          </div>
          <div className="nav-actions">
            <button className="btn ghost" onClick={() => goToAuth("signin")}>Sign in</button>
            <button className="btn primary" onClick={() => goToAuth()}>Create workspace <ArrowRight size={16} /></button>
          </div>
          <button className="nav-toggle" aria-label={navOpen ? "Close menu" : "Open menu"} aria-expanded={navOpen} onClick={() => setNavOpen(v => !v)}>
            {navOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>
      {navOpen && (
        <div className="nav-mobile">
          <a href="#how" onClick={() => setNavOpen(false)}>How it works</a>
          <a href="#capabilities" onClick={() => setNavOpen(false)}>Product</a>
          <a href="/guide" onClick={() => setNavOpen(false)}>Setup guide</a>
          <a href="#faq" onClick={() => setNavOpen(false)}>Questions</a>
          <hr />
          <button className="btn ghost" onClick={() => goToAuth("signin")}>Sign in</button>
          <button className="btn primary" onClick={() => goToAuth()}>Create workspace <ArrowRight size={16} /></button>
        </div>
      )}

      <section className="hero">
        <div className="hero-intro">
          <div className="hero-copy">
            <HeroReveal className="hero-tags">
              <span>Now built for</span>
              <b>Class views</b>
              <b>Teacher views</b>
              <b>PDF exports</b>
            </HeroReveal>
            <HeroReveal delay={0.08} className="hero-title-wrap">
              <span className="hero-label"><i /> Timetable platform for schools</span>
              <h1>Build school timetables as clearly as a class register.</h1>
            </HeroReveal>
            <HeroReveal delay={0.18} className="hero-lede">ClassGrid brings teacher availability, teaching loads and every class timetable into one dependable workspace.</HeroReveal>
            <HeroReveal delay={0.28} className="hero-decision">
              <button className="btn primary large" onClick={() => goToAuth()}>Create your school workspace <ArrowRight size={18} /></button>
              <button className="btn hero-secondary" onClick={() => goToAuth("signin")}>Sign in</button>
              <small><LockKeyhole /> No credit card. Your school data stays private.</small>
            </HeroReveal>
          </div>
          <HeroPreviewMotion className="hero-visual">
            <div className="hero-product" aria-label="ClassGrid timetable editor preview">
              <div className="browser-dots"><i /><i /><i /></div>
              <div className="product-top">
                <span className="mini-logo"><img src={LANDING_MARK_URL} alt="" /><span><b>Excellence Bilingual Academy</b><small>2026 / 2027 - Term 1</small></span></span>
                <span className="status-pill success"><CheckCircle2 /> Validated</span>
              </div>
              <div className="product-toolbar">
                <div className="product-view-tabs"><b>Class</b><span>Teacher</span><span>Master</span></div>
                <strong>Form 5</strong>
                <span className="product-validate"><ShieldCheck /> Ready</span>
              </div>
              <div className="mini-grid">
                <div className="mini-head">Period</div>
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(day => <div className="mini-head" key={day}>{day}</div>)}
                {HERO_SCHEDULE.flatMap((row, rowIndex) => [
                  <div className="mini-period" key={`p${rowIndex}`}><b>Period {rowIndex + 1}</b><small>{["07:45 - 08:30", "08:30 - 09:15", "09:35 - 10:20", "10:20 - 11:05"][rowIndex]}</small></div>,
                  ...row.map((lesson, columnIndex) => (
                    <div className={`mini-lesson ${lesson.tone}`} key={`${rowIndex}-${columnIndex}`}><span><b>{lesson.subject}</b><small>{lesson.teacher}</small></span>{rowIndex === 0 && columnIndex === 0 ? <LockKeyhole /> : null}</div>
                  )),
                ])}
              </div>
              <div className="product-summary"><span><CheckCircle2 /> 164 lessons scheduled</span><span><ShieldCheck /> 0 clashes</span><small>Draft v8</small></div>
            </div>
            <p>Every class, teacher, and master copy stays connected to the same timetable.</p>
          </HeroPreviewMotion>
        </div>
      </section>

      <section className="compare section alt-bg">
        <Reveal className="section-head">
          <span className="kicker">The problem</span>
          <h2>Timetabling shouldn't take a week every term.</h2>
          <p>Most schools still build their timetable by hand, then spend the first few weeks of term fixing the clashes nobody caught.</p>
        </Reveal>
        <div className="compare-grid">
          <MotionCard className="compare-card without">
            <h3>Without ClassGrid</h3>
            <ul>{WITHOUT.map(t => <li key={t}><X /> {t}</li>)}</ul>
          </MotionCard>
          <MotionCard className="compare-card with">
            <h3>With ClassGrid</h3>
            <ul>{WITH.map(t => <li key={t}><CheckCircle2 /> {t}</li>)}</ul>
          </MotionCard>
        </div>
      </section>

      <section className="how section" id="how">
        <Reveal className="section-head">
          <span className="kicker">How it works</span>
          <h2>From a blank workspace to a published timetable.</h2>
        </Reveal>
        <div className="steps">
          {STEPS.map(s => (
            <Reveal className="step-card" key={s.n} delay={Number(s.n) * 0.04}>
              <span>{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="capabilities section alt-bg" id="capabilities">
        <Reveal className="section-head">
          <span className="kicker">Capabilities</span>
          <h2>Everything the timetable office actually needs.</h2>
        </Reveal>
        <div className="cap-grid">
          {CAPABILITIES.map(c => (
            <MotionCard className="cap-card" key={c.title}>
              <span><c.icon /></span>
              <b>{c.title}</b>
              <p>{c.text}</p>
            </MotionCard>
          ))}
        </div>
      </section>

      <section className="guarantee">
        <div className="section guarantee-layout">
          <Reveal className="guarantee-copy" direction="left">
            <span className="kicker">Guaranteed, not just checked</span>
            <h2>Four rules every generated timetable follows.</h2>
            <p>These aren't validation warnings you can dismiss — they're enforced at generation time, and enforced again at the database level.</p>
          </Reveal>
          <div className="guarantee-grid">
            <Reveal delay={0.03}><LockKeyhole /><div><b>No teacher clashes</b><small>A teacher is only ever in one class at a time.</small></div></Reveal>
            <Reveal delay={0.08}><LockKeyhole /><div><b>No class clashes</b><small>A class receives one lesson per period, no exceptions.</small></div></Reveal>
            <Reveal delay={0.13}><ShieldCheck /><div><b>Availability respected</b><small>Unavailable slots are never used when generating.</small></div></Reveal>
            <Reveal delay={0.18}><Sparkles /><div><b>Balanced distribution</b><small>Lessons are spread through the week instead of stacked.</small></div></Reveal>
          </div>
        </div>
      </section>

      <section className="faq section" id="faq">
        <Reveal className="section-head center">
          <span className="kicker">FAQ</span>
          <h2>Questions administrators ask first.</h2>
        </Reveal>
        <Reveal className="faq-list">
          {FAQS.map(f => (
            <details key={f.q}>
              <summary>{f.q}<ChevronDown /></summary>
              <p>{f.a}</p>
            </details>
          ))}
        </Reveal>
      </section>

      <Reveal className="cta-banner">
        <h2>Stop rebuilding your timetable by hand.</h2>
        <p>Set up your school and see a generated timetable the same day.</p>
        <button className="btn primary large" onClick={() => goToAuth()}>Start your school setup <ArrowRight size={18} /></button>
      </Reveal>

      <footer className="site-footer">
        <Reveal className="footer-top">
          <div className="footer-brand">
            <div className="landing-brand footer-logo"><img src={LANDING_LOGO_URL} alt={`${APP_NAME} logo`} /></div>
            <p>Conflict-free school timetabling for multi-school administrators.</p>
          </div>
          <div className="footer-cols">
            <div><b>Product</b><a href="/guide">Guide</a><a href="#capabilities">Capabilities</a><a href="#how">How it works</a><a href="#faq">FAQ</a></div>
            <div><b>Company</b><a href="#">About</a><a href="#">Contact</a></div>
            <div><b>Legal</b><a href="#">Privacy</a><a href="#">Terms</a></div>
          </div>
        </Reveal>
        <div className="footer-bottom">
          <span>© 2026 {APP_NAME}.</span>
          <span>Built for the people who actually build the timetable.</span>
        </div>
      </footer>
    </main>
  );
}
