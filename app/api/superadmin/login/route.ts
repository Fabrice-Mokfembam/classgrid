import { NextResponse } from "next/server";
import { createSuperadminSession, isValidSuperadminLogin } from "@/lib/superadmin-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "");
  const password = String(body?.password ?? "");

  if (!isValidSuperadminLogin(email, password)) {
    return NextResponse.json({ error: "Invalid superadmin email or password." }, { status: 401 });
  }

  await createSuperadminSession();
  return NextResponse.json({ ok: true });
}
