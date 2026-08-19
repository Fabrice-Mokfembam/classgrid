import { Suspense } from "react";
import type { ReactNode } from "react";
import { CalendarDays } from "lucide-react";
import { SchoolGate } from "./school-gate";

// Synchronous on purpose: everything that needs a network round trip (SchoolGate,
// below) is pushed behind Suspense so the route transition itself is never blocked
// on it. Without this, clicking a sidebar link would sit frozen — URL and all —
// until the server-side auth check finished; a slow Supabase response used to mean
// a slow click. Now the URL/shell commit immediately and the real content streams in.
export default function SchoolLayout({ children, params }: { children: ReactNode; params: Promise<{ school: string }> }) {
  return (
    <Suspense fallback={<div className="app-loading"><CalendarDays /></div>}>
      <SchoolGate params={params}>{children}</SchoolGate>
    </Suspense>
  );
}
