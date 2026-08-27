"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { APP_NAME, DEFAULT_LOGO_URL } from "@/lib/branding";
import { SUPERADMIN_EMAIL } from "@/lib/superadmin-config";

export function SuperadminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState(SUPERADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const response = await fetch("/api/superadmin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = await response.json().catch(() => ({}));
    setSubmitting(false);
    if (!response.ok) {
      setError(payload.error || "Could not sign in.");
      return;
    }
    router.replace("/superadmin");
    router.refresh();
  }

  return (
    <main className="superadmin-login-page">
      <section className="superadmin-login-brand">
        <img src={DEFAULT_LOGO_URL} alt={`${APP_NAME} logo`} />
        <span>Platform owner</span>
        <h1>Control the whole ClassGrid platform.</h1>
        <p>Review schools, users, timetable activity and platform health from one private console.</p>
      </section>
      <section className="superadmin-login-card">
        <div className="superadmin-login-icon"><ShieldCheck /></div>
        <span>Superadmin access</span>
        <h2>Sign in to continue</h2>
        <p>This area is separate from school administrator accounts.</p>
        <form onSubmit={submit}>
          <label>Email address<input type="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>
          <label>Password<div className="password"><input type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter superadmin password" required /><button type="button" onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
          {error ? <small className="field-error">{error}</small> : null}
          <button className="btn primary full" disabled={submitting}>{submitting ? "Signing in..." : <>Open dashboard <ArrowRight /></>}</button>
        </form>
      </section>
    </main>
  );
}
