import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { SchoolProvider } from "@/lib/school-context";
import { AppShellChrome } from "@/components/app-shell";

// The one thing worth blocking the whole /<school>/* tree on: is there a session at all?
// Deliberately does NOT also re-verify the school_memberships/slug match here — every
// screen scopes its actual data queries by the schoolId that lib/school-context.tsx
// fetches client-side (never by this URL param), so a stale/wrong slug in the address bar
// is cosmetic, not a security boundary. AppShellChrome corrects it via router.replace
// once that client fetch resolves, instead of adding a second server round trip that
// every navigation would otherwise have to wait on.
export async function SchoolGate({ params, children }: { params: Promise<{ school: string }>; children: ReactNode }) {
  const { school } = await params;
  const supabase = await createClient();
  if (!supabase) redirect("/auth");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  return (
    <SchoolProvider>
      <AppShellChrome schoolSlug={school}>{children}</AppShellChrome>
    </SchoolProvider>
  );
}
