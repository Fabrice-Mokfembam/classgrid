"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

export type SchoolContextValue = {
  schoolId: string | null;
  academicYearId: string | null;
  schoolName: string | null;
  academicYearName: string | null;
  role: string | null;
  loading: boolean;
};

const initial: SchoolContextValue = {
  schoolId: null, academicYearId: null, schoolName: null, academicYearName: null, role: null, loading: true,
};

const SchoolContext = createContext<SchoolContextValue>(initial);

// Loads the signed-in admin's school/membership/current-academic-year once,
// so screens can stop hardcoding "Excellence Bilingual Academy" / "2026/2027".
export function SchoolProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<SchoolContextValue>(initial);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    if (!supabase) { setValue(v => ({ ...v, loading: false })); return; }

    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if (!cancelled) setValue(v => ({ ...v, loading: false })); return; }

        const { data: membership } = await supabase
          .from("school_memberships")
          .select("role, school_id, schools(name)")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!membership) { if (!cancelled) setValue(v => ({ ...v, loading: false })); return; }

        const { data: year } = await supabase
          .from("academic_years")
          .select("id, name")
          .eq("school_id", membership.school_id)
          .eq("is_current", true)
          .maybeSingle();

        if (!cancelled) {
          const schoolRow = Array.isArray(membership.schools) ? membership.schools[0] : membership.schools;
          setValue({
            schoolId: membership.school_id,
            academicYearId: year?.id ?? null,
            schoolName: (schoolRow as { name: string } | null)?.name ?? null,
            academicYearName: year?.name ?? null,
            role: membership.role,
            loading: false,
          });
        }
      } catch (error) {
        console.error("Failed to load school context:", error);
        if (!cancelled) setValue(v => ({ ...v, loading: false }));
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>;
}

export function useSchool() {
  return useContext(SchoolContext);
}
