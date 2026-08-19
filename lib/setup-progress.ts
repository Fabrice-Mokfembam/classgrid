import type { SupabaseClient } from "@supabase/supabase-js";
import type { SetupStep } from "@/lib/types";

export const SETUP_STEP_KEYS: SetupStep[] = ["school", "year", "schedule", "levels", "subjects", "teachers", "assignments"];

export type SetupProgress = {
  stepsDone: Record<SetupStep, boolean>;
  completedCount: number;
  totalSteps: number;
  percent: number;
};

// Shared by the Dashboard's setup banner and the sidebar's mini progress widget so
// both ever show the same real number instead of two different (or fake) ones.
export async function loadSetupProgress(supabase: SupabaseClient, schoolId: string, academicYearId: string): Promise<SetupProgress> {
  const [levelsRes, subjectsRes, teachersRes, assignmentsRes, daysRes, slotsRes] = await Promise.all([
    supabase.from("levels").select("id").eq("school_id", schoolId).eq("academic_year_id", academicYearId),
    supabase.from("subjects").select("id").eq("school_id", schoolId),
    supabase.from("teachers").select("id").eq("school_id", schoolId),
    supabase.from("teaching_assignments").select("id").eq("school_id", schoolId).eq("academic_year_id", academicYearId),
    supabase.from("working_days").select("id").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("is_active", true),
    supabase.from("period_slots").select("id").eq("school_id", schoolId).eq("academic_year_id", academicYearId).eq("kind", "lesson"),
  ]);
  const stepsDone: Record<SetupStep, boolean> = {
    school: true,
    year: true,
    schedule: (daysRes.data?.length ?? 0) > 0 && (slotsRes.data?.length ?? 0) > 0,
    levels: (levelsRes.data?.length ?? 0) > 0,
    subjects: (subjectsRes.data?.length ?? 0) > 0,
    teachers: (teachersRes.data?.length ?? 0) > 0,
    assignments: (assignmentsRes.data?.length ?? 0) > 0,
  };
  const completedCount = SETUP_STEP_KEYS.filter(k => stepsDone[k]).length;
  return { stepsDone, completedCount, totalSteps: SETUP_STEP_KEYS.length, percent: Math.round((completedCount / SETUP_STEP_KEYS.length) * 100) };
}
