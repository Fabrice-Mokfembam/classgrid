"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, AlertTriangle, FileCheck2, School2, Sparkles, UsersRound } from "lucide-react";

type Page = "dashboard" | "setup" | "levels" | "subjects" | "teachers" | "availability" | "assignments" | "generate" | "timetable" | "settings";
function pagePath(schoolSlug: string, id: Page) { return id === "dashboard" ? `/${schoolSlug}` : `/${schoolSlug}/${id}`; }

function Stat({ icon: Icon, n, label, note }: { icon: any; n: string; label: string; note: string }) {
  return <article className="stat-card"><span><Icon /></span><div><b>{n}</b><strong>{label}</strong><small>{note}</small></div></article>;
}
function PanelTitle({ title, action }: { title: string; action?: string }) {
  return <div className="panel-title"><h3>{title}</h3>{action && <button>{action}<ArrowRight /></button>}</div>;
}
function ValidationItem({ good, title, text }: { good: boolean; title: string; text: string }) {
  return <div className="validation-item">{good ? <CheckCircle2 className="good" /> : <AlertTriangle className="warn" />}<div><b>{title}</b><small>{text}</small></div><ArrowRight /></div>;
}
function Quick({ icon: Icon, text, onClick }: { icon: any; text: string; onClick: () => void }) {
  return <button onClick={onClick}><Icon /><b>{text}</b><ArrowRight /></button>;
}
function SetupOrderItem({ n, title, text, onClick }: { n: number; title: string; text: string; onClick: () => void }) {
  return <button type="button" className="validation-item setup-order-item" onClick={onClick}><span className="setup-order-badge">{n}</span><div><b>{title}</b><small>{text}</small></div><ArrowRight /></button>;
}

export function Dashboard() {
  const router = useRouter();
  const { school } = useParams<{ school: string }>();
  const go = (p: Page) => router.push(pagePath(school, p));
  return <><section className="setup-banner"><div className="ring"><span>82%</span></div><div><b>Complete your school setup</b><p>Add the remaining teaching assignments to get the best generation results.</p><div className="progress"><i style={{ width: "82%" }} /></div><small>6 of 7 steps completed</small></div><button className="btn primary" onClick={() => go("assignments")}>Continue setup <ArrowRight /></button></section><section className="stats-grid"><Stat icon={UsersRound} n="24" label="Teachers" note="All active" /><Stat icon={School2} n="12" label="Classes" note="Across 5 levels" /><Stat icon={BookOpen} n="18" label="Subjects" note="2 practical subjects" /><Stat icon={CalendarDays} n="186" label="Weekly lessons" note="All assigned" /></section><section className="dashboard-grid"><article className="panel workload"><PanelTitle title="Weekly workload" action="View report" /><div className="bars">{[32, 45, 48, 42, 38].map((n, i) => <div key={n}><span style={{ height: `${n * 2.4}px` }}><b>{n}</b></span><small>{["Mon", "Tue", "Wed", "Thu", "Fri"][i]}</small></div>)}</div></article><article className="panel status-card"><PanelTitle title="Timetable status" /><div className="status-content"><div className="ring small"><span>92</span></div><div><span className="status-pill">Draft · Version 3</span><h3>Ready for review</h3><p>186 of 186 lessons scheduled.</p></div></div><button className="btn full" onClick={() => go("timetable")}>Open timetable editor <ArrowRight /></button></article><article className="panel validation"><PanelTitle title="Validation summary" action="View details" /><p className="validation-head"><span className="status-pill warning">3 items need attention</span></p><ValidationItem good={false} title="Soft preferences" text="3 distribution warnings" /><ValidationItem good title="Hard conflicts" text="No blocking conflicts" /><ValidationItem good title="Availability" text="Every workload is feasible" /></article></section><section className="panel quick"><PanelTitle title="Quick actions" /><div className="quick-grid"><Quick icon={UsersRound} text="Add teacher" onClick={() => go("teachers")} /><Quick icon={School2} text="Add class" onClick={() => go("levels")} /><Quick icon={FileCheck2} text="Add assignment" onClick={() => go("assignments")} /><Quick icon={Sparkles} text="Generate timetable" onClick={() => go("generate")} /></div></section><section className="panel quick"><PanelTitle title="Recommended setup order" /><p style={{ fontSize: 11, color: "var(--muted)", margin: "-6px 0 4px" }}>Each step depends on the one before it — assignments in particular need subjects configured per level first.</p><SetupOrderItem n={1} title="Levels" text="Broad groupings like Form 1 or Primary" onClick={() => go("levels")} /><SetupOrderItem n={2} title="Subjects" text="Your school's subject catalog" onClick={() => go("subjects")} /><SetupOrderItem n={3} title="Subjects per level" text="Weekly periods and any parallel groups — Levels page, Manage subjects" onClick={() => go("levels")} /><SetupOrderItem n={4} title="Class sections" text="The actual classes, e.g. Form 1A" onClick={() => go("levels")} /><SetupOrderItem n={5} title="Teachers" text="Who teaches, and optionally which classes" onClick={() => go("teachers")} /><SetupOrderItem n={6} title="Teaching assignments" text="Confirms each teacher × subject × class combination" onClick={() => go("assignments")} /></section></>;
}
