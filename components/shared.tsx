"use client";
import { Component, type ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";

// ─── Skeleton / loading primitives ────────────────────────────────────────────

export function Skel({ w, sm }: { w?: string; sm?: boolean }) {
  return <span className={sm ? "skeleton skeleton-line sm" : "skeleton skeleton-line"} style={w ? { width: w } : undefined} />;
}

export function RowsSkeleton({ className, cols, rows = 5 }: { className: string; cols: number; rows?: number }) {
  return <>{Array.from({ length: rows }).map((_, r) => <div className={className} key={r}>{Array.from({ length: cols }).map((_, c) => <span key={c}><Skel w={c === 0 ? "65%" : "45%"} /></span>)}</div>)}</>;
}

export function GridSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return <>{Array.from({ length: rows }).flatMap((_, r) => [
    <div className="skeleton" key={`p-${r}`} style={{ minHeight: 57 }} />,
    ...Array.from({ length: cols }).map((_, c) => <div className="skeleton" key={`${r}-${c}`} style={{ minHeight: 57 }} />),
  ])}</>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="empty-inspector error-inspector"><AlertTriangle /><h3>Couldn't load this page</h3><p>{message}</p><button className="btn" onClick={onRetry}>Try again</button></div>;
}

export function firstError(...results: { error: { message: string } | null }[]) {
  return results.find(r => r.error)?.error?.message ?? null;
}

export function Explainer({ title, children }: { title: string; children: ReactNode }) {
  return <aside className="page-explainer"><Info /><div><b>{title}</b><p>{children}</p></div></aside>;
}

// ─── TableShell ───────────────────────────────────────────────────────────────
import { Search, Plus } from "lucide-react";

export function TableShell({ children, title, count, button, onAdd, searchValue, onSearchChange, searchPlaceholder = "Search…", toolbarExtra }: { children: React.ReactNode; title: string; count: number; button: string; onAdd: () => void; searchValue?: string; onSearchChange?: (value: string) => void; searchPlaceholder?: string; toolbarExtra?: React.ReactNode }) {
  return <section className="panel table-panel"><div className="table-tools"><div><h3>{title}</h3><span>{count} records</span></div><div>{toolbarExtra}<div className="search"><Search /><input aria-label={searchPlaceholder} placeholder={searchPlaceholder} value={searchValue ?? ""} onChange={e => onSearchChange?.(e.target.value)} /></div><button className="btn primary" onClick={onAdd}><Plus /> {button}</button></div></div>{children}</section>;
}

// ─── ErrorBoundary ────────────────────────────────────────────────────────────

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error(error); }
  render() {
    if (this.state.error) return <ErrorState message={this.state.error.message || "This page hit an unexpected error."} onRetry={() => this.setState({ error: null })} />;
    return this.props.children;
  }
}
