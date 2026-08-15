import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Supabase redirects here after email confirmation, with a one-time code that
// gets exchanged for a real session cookie. If this user just signed up, the
// school details they entered are attached as metadata (see buildPendingSchool
// in components/auth-screen.tsx) — there was no session to call the
// create_school_workspace RPC with until right now, so that happens here.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const pendingSchool = data.user?.user_metadata?.pending_school;
        if (pendingSchool) {
          const { error: rpcError } = await supabase.rpc("create_school_workspace", pendingSchool);
          if (rpcError) return NextResponse.redirect(`${origin}/?authError=${encodeURIComponent(rpcError.message)}`);
        }
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/?authError=1`);
}
