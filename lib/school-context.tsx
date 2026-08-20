"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SchoolContextValue = {
  schoolId: string | null;
  schoolSlug: string | null;
  academicYearId: string | null;
  schoolName: string | null;
  schoolLogoUrl: string | null;
  academicYearName: string | null;
  role: string | null;
  fullName: string | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
};

const initial: Omit<SchoolContextValue, "retry"> = {
  schoolId: null, schoolSlug: null, academicYearId: null, schoolName: null, schoolLogoUrl: null, academicYearName: null, role: null, fullName: null, loading: true, error: null,
};

const SchoolContext = createContext<SchoolContextValue>({ ...initial, retry: () => {} });

// Shared by the landing page, the auth screen and the callback route (client-side
// call sites only — the callback route re-derives this server-side) whenever they
// need to know which school workspace to send a signed-in admin to.
export async function fetchMySchoolSlug(supabase: SupabaseClient): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: membership } = await supabase
    .from("school_memberships")
    .select("schools(slug)")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return null;
  const schoolRow = Array.isArray(membership.schools) ? membership.schools[0] : membership.schools;
  return (schoolRow as { slug: string } | null)?.slug ?? null;
}

// Loads the signed-in admin's school/membership/current-academic-year once,
// so screens can stop hardcoding "Excellence Bilingual Academy" / "2026/2027".
export function SchoolProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState(initial);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    if (!supabase) { setValue(v => ({ ...v, loading: false })); return; }

    setValue(v => ({ ...v, loading: true, error: null }));

    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if (!cancelled) setValue(v => ({ ...v, loading: false })); return; }

        const { data: membership, error: membershipError } = await supabase
          .from("school_memberships")
          .select("role, school_id, schools(name, slug, logo_url)")
          .eq("user_id", user.id)
          .maybeSingle();

        if (membershipError) { if (!cancelled) setValue(v => ({ ...v, loading: false, error: membershipError.message })); return; }
        if (!membership) { if (!cancelled) setValue(v => ({ ...v, loading: false })); return; }

        const [{ data: year, error: yearError }, { data: profile, error: profileError }] = await Promise.all([
          supabase.from("academic_years").select("id, name").eq("school_id", membership.school_id).eq("is_current", true).maybeSingle(),
          supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        ]);

        if (yearError) { if (!cancelled) setValue(v => ({ ...v, loading: false, error: yearError.message })); return; }
        if (profileError) { if (!cancelled) setValue(v => ({ ...v, loading: false, error: profileError.message })); return; }

        if (!cancelled) {
          const schoolRow = Array.isArray(membership.schools) ? membership.schools[0] : membership.schools;
          setValue({
            schoolId: membership.school_id,
            schoolSlug: (schoolRow as { slug: string } | null)?.slug ?? null,
            academicYearId: year?.id ?? null,
            schoolName: (schoolRow as { name: string } | null)?.name ?? null,
            schoolLogoUrl: (schoolRow as { logo_url: string | null } | null)?.logo_url ?? null,
            academicYearName: year?.name ?? null,
            role: membership.role,
            fullName: profile?.full_name ?? null,
            loading: false,
            error: null,
          });
        }
      } catch (error) {
        console.error("Failed to load school context:", error);
        if (!cancelled) setValue(v => ({ ...v, loading: false, error: error instanceof Error ? error.message : "Couldn't reach the server." }));
      }
    })();

    return () => { cancelled = true; };
  }, [attempt]);

  return <SchoolContext.Provider value={{ ...value, retry: () => setAttempt(a => a + 1) }}>{children}</SchoolContext.Provider>;
}

export function useSchool() {
  return useContext(SchoolContext);
}
