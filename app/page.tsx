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

const TRUSTED_SCHOOLS = ["Cambridge College", "St Agnes School", "Marist College", "Sacred Heart College", "Bishop Rogan College"];

const BUILT_DIFFERENT = [
  { icon: ShieldCheck, title: "Auto conflict detection", text: "Find teacher, class and availability clashes before they become school-day problems." },
  { icon: Sparkles, title: "Smart repair tools", text: "Regenerate unlocked lessons and repair class gaps without losing fixed lessons." },
  { icon: CalendarDays, title: "Real-time updates", text: "Change availability, periods or assignments and generate from the latest inputs." },
  { icon: UsersRound, title: "Role-based access", text: "Keep timetable work in the hands of the right administrators." },
];

const FEATURE_GROUPS = [
  { icon: Clock3, title: "Academic schedules", text: "Flexible teaching days, periods, breaks and academic-year structure." },
  { icon: UsersRound, title: "Teacher management", text: "Manage availability, workloads and assignments from one workspace." },
  { icon: School2, title: "Classes and resources", text: "Organize levels, class sections, subjects and parallel groups." },
  { icon: FileCheck2, title: "Reports and exports", text: "Export class, teacher and master timetable PDFs." },
  { icon: ShieldCheck, title: "Audit and validation", text: "Track issues, quality score, locked lessons and publish status." },
  { icon: BookOpen, title: "Guided setup", text: "A built-in order helps schools enter the right data first." },
];

const PROOF_POINTS = [
  { icon: ShieldCheck, title: "Always accurate", text: "Validation keeps class and teacher conflicts visible." },
  { icon: LockKeyhole, title: "Locked lessons safe", text: "Keep important manual edits during regeneration." },
  { icon: Layers, title: "Scalable", text: "Works from small schools to larger institutions." },
  { icon: CheckCircle2, title: "Private by design", text: "School data stays inside its own workspace." },
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

      <section className="trust-strip">
        <span>Trusted by schools planning cleaner weeks</span>
        <div>
          {TRUSTED_SCHOOLS.map(name => <b key={name}><ShieldCheck />{name}</b>)}
        </div>
      </section>

      <section className="different-section" id="capabilities">
        <Reveal className="different-copy">
          <span className="kicker">Built different</span>
          <h2>Timetabling should never be a headache.</h2>
          <p>ClassGrid removes the complexity from scheduling so your staff can focus on what matters: teaching.</p>
        </Reveal>
        <div className="different-grid">
          {BUILT_DIFFERENT.map((item, index) => (
            <MotionCard className="different-card" key={item.title}>
              <span><item.icon /></span>
              <b>{item.title}</b>
              <p>{item.text}</p>
            </MotionCard>
          ))}
        </div>
      </section>

      <section className="timeline-section" id="how">
        <Reveal className="timeline-head">
          <span className="kicker">How it works</span>
          <h2>From blank slate to published in minutes.</h2>
        </Reveal>
        <div className="timeline-steps">
          {STEPS.map((s, index) => (
            <Reveal className="timeline-step" key={s.n} delay={index * 0.05}>
              <span><b>{index + 1}</b></span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="feature-showcase">
        <div className="feature-showcase-main">
          <Reveal className="feature-showcase-copy" direction="left">
            <span className="kicker">Powerful by design</span>
            <h2>Everything a modern timetable office needs.</h2>
            <p>From scheduling to reporting, ClassGrid brings everything together in one focused platform.</p>
            <button className="btn showcase-btn" onClick={() => goToAuth()}>Explore all features <ArrowRight size={16} /></button>
          </Reveal>
          <div className="feature-showcase-grid">
            {FEATURE_GROUPS.map((feature, index) => (
              <Reveal key={feature.title} delay={index * 0.04}>
                <span><feature.icon /></span>
                <div><b>{feature.title}</b><small>{feature.text}</small></div>
              </Reveal>
            ))}
          </div>
        </div>
        <div className="proof-strip">
          {PROOF_POINTS.map(point => (
            <div key={point.title}><span><point.icon /></span><b>{point.title}</b><small>{point.text}</small></div>
          ))}
        </div>
      </section>

      <section className="faq section" id="faq">
        <Reveal className="section-head faq-copy">
          <span className="kicker">FAQ</span>
          <h2>We've got answers.</h2>
          <p>These are the questions school administrators usually ask before building their first timetable.</p>
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
