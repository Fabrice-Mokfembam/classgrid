import { redirect } from "next/navigation";
import { getSuperadminSession } from "@/lib/superadmin-auth";
import { SuperadminLoginForm } from "./superadmin-login-form";

export default async function SuperadminLoginPage() {
  const session = await getSuperadminSession();
  if (session) redirect("/superadmin");
  return <SuperadminLoginForm />;
}
