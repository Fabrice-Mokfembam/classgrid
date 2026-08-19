import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Supabase redirects here after email confirmation, with a one-time code that
// gets exchanged for a real session cookie. If this user just signed up, the
// school details they entered are attached as metadata (see buildPendingSchool
// in components/auth-screen.tsx) — there was no session to call the
// create_school_workspace RPC with until right now, so that happens here.
// Either way, we land the admin straight on their school's own URL
// (/<slug>) instead of the marketing page.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const pendingSchool = data.user?.user_metadata?.pending_school;
        let schoolId: string | null = null;
        if (pendingSchool) {
          const { data: newSchoolId, error: rpcError } = await supabase.rpc("create_school_workspace", pendingSchool);
          if (rpcError) return NextResponse.redirect(`${origin}/?authError=${encodeURIComponent(rpcError.message)}`);
          schoolId = newSchoolId;
        }

        const schoolQuery = schoolId
          ? supabase.from("schools").select("slug").eq("id", schoolId).maybeSingle()
          : supabase.from("school_memberships").select("schools(slug)").eq("user_id", data.user!.id).maybeSingle();
        const { data: schoolRow } = await schoolQuery;
        const slug = schoolId
          ? (schoolRow as { slug: string } | null)?.slug
          : (() => {
              const row = (schoolRow as { schools: { slug: string } | { slug: string }[] | null } | null)?.schools;
              return (Array.isArray(row) ? row[0] : row)?.slug;
            })();

        return NextResponse.redirect(`${origin}${slug ? `/${slug}` : "/"}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/?authError=1`);
}
