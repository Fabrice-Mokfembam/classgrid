"use client";

import { useRouter } from "next/navigation";
import { AuthScreen } from "@/components/auth-screen";

export default function AuthPage() {
  const router = useRouter();
  return <AuthScreen onBack={() => router.push("/")} />;
}
