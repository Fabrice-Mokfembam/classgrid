import { NextResponse } from "next/server";
import { clearSuperadminSession } from "@/lib/superadmin-auth";

export async function POST(request: Request) {
  await clearSuperadminSession();
  return NextResponse.redirect(new URL("/superadmin/login", request.url));
}
