// This file is intentionally minimal.
// Its mere existence tells Next.js App Router it is safe to commit the
// navigation immediately (change the URL, keep the sidebar/topbar) and
// show this skeleton in the content area while the real page streams in.
// Without it, Next.js holds the old page frozen until the new one is fully ready.

export default function Loading() {
  return (
    <div className="page-loading-skeleton">
      {/* Mimics the card/panel shape most pages open with */}
      <div className="skeleton-panel">
        <div className="skeleton-panel-head">
          <span className="skeleton sk-title" />
          <span className="skeleton sk-badge" />
          <span className="skeleton sk-btn" />
        </div>
        <div className="skeleton-rows">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="skeleton-row" key={i}>
              <span className="skeleton sk-cell wide" />
              <span className="skeleton sk-cell" />
              <span className="skeleton sk-cell" />
              <span className="skeleton sk-cell narrow" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
