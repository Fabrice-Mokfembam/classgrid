"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthScreen } from "@/components/auth-screen";

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "signin" ? "signin" : "signup";
  return <AuthScreen initialMode={initialMode} onBack={() => router.push("/")} />;
}

export default function AuthPage() {
  return <Suspense fallback={null}>
    <AuthPageContent />
  </Suspense>;
}
