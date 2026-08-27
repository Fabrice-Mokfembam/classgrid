import { createAdminClient } from "@/lib/supabase/admin";

export type PlatformOverview = {
  schools: number;
  active_schools: number;
  suspended_schools: number;
  users: number;
  teachers: number;
  classes: number;
  subjects: number;
  timetables: number;
  published_timetables: number;
  latest_generation_runs: Array<{
    id: string;
    status: string;
    progress: number;
    error_message: string | null;
    created_at: string;
    completed_at: string | null;
    school_name: string;
    school_slug: string;
  }>;
};

export type PlatformSchool = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  account_status: string;
  school_type: string;
  curriculum: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  created_at: string;
  updated_at: string;
  current_academic_year: string | null;
  owner_name: string | null;
  owner_email: string | null;
  members_count: number;
  teachers_count: number;
  classes_count: number;
  subjects_count: number;
  timetables_count: number;
  last_generation_at: string | null;
};

export type SchoolDetail = {
  school: { id: string; name: string; slug: string; account_status: string; school_type: string; curriculum: string | null; created_at: string; logo_url: string | null };
  counts: { teachers: number; classes: number; levels: number; subjects: number; assignments: number; timetables: number; published_timetables: number };
  members: Array<{ id: string; role: string; job_title: string | null; full_name: string | null; email: string | null; email_confirmed_at: string | null; last_sign_in_at: string | null }>;
  latest_timetables: Array<{ id: string; name: string; version: number; status: string; quality_score: number | null; published_at: string | null; created_at: string }>;
  latest_runs: Array<{ id: string; status: string; progress: number; error_message: string | null; created_at: string; completed_at: string | null }>;
};

function emptyToNull(value: string | null | undefined) {
  return value && value.trim() ? value : null;
}

async function exactCount(table: string, filters: Record<string, string> = {}) {
  const supabase = createAdminClient();
  if (!supabase) return 0;
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  Object.entries(filters).forEach(([key, value]) => {
    query = query.eq(key, value);
  });
  const { count } = await query;
  return count ?? 0;
}

export async function getPlatformOverview(): Promise<PlatformOverview | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const [schoolsRes, activeSchoolsRes, suspendedSchoolsRes, usersRes, teachersRes, classesRes, subjectsRes, timetablesRes, publishedRes, runsRes] = await Promise.all([
    supabase.from("schools").select("id", { count: "exact", head: true }),
    supabase.from("schools").select("id", { count: "exact", head: true }).eq("account_status", "active"),
    supabase.from("schools").select("id", { count: "exact", head: true }).eq("account_status", "suspended"),
    supabase.from("school_memberships").select("user_id", { count: "exact", head: true }),
    supabase.from("teachers").select("id", { count: "exact", head: true }),
    supabase.from("class_sections").select("id", { count: "exact", head: true }),
    supabase.from("subjects").select("id", { count: "exact", head: true }),
    supabase.from("timetables").select("id", { count: "exact", head: true }),
    supabase.from("timetables").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("generation_runs").select("id,status,progress,error_message,created_at,completed_at,schools(name,slug)").order("created_at", { ascending: false }).limit(8),
  ]);

  if (schoolsRes.error || activeSchoolsRes.error || suspendedSchoolsRes.error || usersRes.error || teachersRes.error || classesRes.error || subjectsRes.error || timetablesRes.error || publishedRes.error || runsRes.error) return null;

  return {
    schools: schoolsRes.count ?? 0,
    active_schools: activeSchoolsRes.count ?? 0,
    suspended_schools: suspendedSchoolsRes.count ?? 0,
    users: usersRes.count ?? 0,
    teachers: teachersRes.count ?? 0,
    classes: classesRes.count ?? 0,
    subjects: subjectsRes.count ?? 0,
    timetables: timetablesRes.count ?? 0,
    published_timetables: publishedRes.count ?? 0,
    latest_generation_runs: (runsRes.data ?? []).map((run: any) => {
      const school = Array.isArray(run.schools) ? run.schools[0] : run.schools;
      return {
        id: run.id,
        status: run.status,
        progress: run.progress,
        error_message: run.error_message,
        created_at: run.created_at,
        completed_at: run.completed_at,
        school_name: school?.name ?? "Unknown school",
        school_slug: school?.slug ?? "",
      };
    }),
  };
}

export async function listPlatformSchools(): Promise<PlatformSchool[] | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const { data: schools, error } = await supabase.from("schools").select("id,name,slug,logo_url,account_status,school_type,curriculum,country,region,city,created_at,updated_at").order("created_at", { ascending: false });
  if (error) return null;

  const { data: memberships } = await supabase.from("school_memberships").select("id,school_id,user_id,role").eq("role", "owner");
  const ownerIds = Array.from(new Set((memberships ?? []).map(row => row.user_id)));
  const { data: profiles } = ownerIds.length ? await supabase.from("profiles").select("id,full_name").in("id", ownerIds) : { data: [] };
  const users = ownerIds.length ? await supabase.auth.admin.listUsers({ perPage: 1000 }) : { data: { users: [] } };
  const userById = new Map((users.data.users ?? []).map(user => [user.id, user]));
  const profileById = new Map((profiles ?? []).map(profile => [profile.id, profile]));

  return Promise.all((schools ?? []).map(async school => {
    const owner = (memberships ?? []).find(row => row.school_id === school.id);
    const [yearRes, membersCount, teachersCount, classesCount, subjectsCount, timetablesCount, runRes] = await Promise.all([
      supabase.from("academic_years").select("name").eq("school_id", school.id).eq("is_current", true).maybeSingle(),
      exactCount("school_memberships", { school_id: school.id }),
      exactCount("teachers", { school_id: school.id }),
      exactCount("class_sections", { school_id: school.id }),
      exactCount("subjects", { school_id: school.id }),
      exactCount("timetables", { school_id: school.id }),
      supabase.from("generation_runs").select("created_at").eq("school_id", school.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const ownerUser = owner ? userById.get(owner.user_id) : null;
    const ownerProfile = owner ? profileById.get(owner.user_id) : null;
    return {
      ...school,
      current_academic_year: yearRes.data?.name ?? null,
      owner_name: ownerProfile?.full_name ?? null,
      owner_email: emptyToNull(ownerUser?.email),
      members_count: membersCount,
      teachers_count: teachersCount,
      classes_count: classesCount,
      subjects_count: subjectsCount,
      timetables_count: timetablesCount,
      last_generation_at: runRes.data?.created_at ?? null,
    };
  }));
}

export async function getPlatformSchoolDetail(schoolId: string): Promise<SchoolDetail | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const { data: school, error } = await supabase.from("schools").select("id,name,slug,account_status,school_type,curriculum,created_at,logo_url").eq("id", schoolId).maybeSingle();
  if (error || !school) return null;

  const [membershipsRes, profilesRes, teachers, classes, levels, subjects, assignments, timetables, published, latestTimetablesRes, latestRunsRes] = await Promise.all([
    supabase.from("school_memberships").select("id,user_id,role,job_title").eq("school_id", schoolId).order("created_at"),
    supabase.from("profiles").select("id,full_name"),
    exactCount("teachers", { school_id: schoolId }),
    exactCount("class_sections", { school_id: schoolId }),
    exactCount("levels", { school_id: schoolId }),
    exactCount("subjects", { school_id: schoolId }),
    exactCount("teaching_assignments", { school_id: schoolId }),
    exactCount("timetables", { school_id: schoolId }),
    supabase.from("timetables").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("status", "published"),
    supabase.from("timetables").select("id,name,version,status,quality_score,published_at,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(8),
    supabase.from("generation_runs").select("id,status,progress,error_message,created_at,completed_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(8),
  ]);

  if (membershipsRes.error || profilesRes.error || latestTimetablesRes.error || latestRunsRes.error) return null;

  const userIds = (membershipsRes.data ?? []).map(row => row.user_id);
  const users = userIds.length ? await supabase.auth.admin.listUsers({ perPage: 1000 }) : { data: { users: [] } };
  const profileById = new Map((profilesRes.data ?? []).map(profile => [profile.id, profile]));
  const userById = new Map((users.data.users ?? []).map(user => [user.id, user]));

  return {
    school,
    counts: { teachers, classes, levels, subjects, assignments, timetables, published_timetables: published.count ?? 0 },
    members: (membershipsRes.data ?? []).map(member => {
      const user = userById.get(member.user_id);
      const profile = profileById.get(member.user_id);
      return {
        id: member.id,
        role: member.role,
        job_title: member.job_title,
        full_name: profile?.full_name ?? null,
        email: emptyToNull(user?.email),
        email_confirmed_at: user?.email_confirmed_at ?? null,
        last_sign_in_at: user?.last_sign_in_at ?? null,
      };
    }),
    latest_timetables: latestTimetablesRes.data ?? [],
    latest_runs: latestRunsRes.data ?? [],
  };
}
