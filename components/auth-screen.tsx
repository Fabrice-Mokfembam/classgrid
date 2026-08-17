"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Eye, EyeOff, Mail, School2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { SchoolProfile } from "@/lib/types";

const initial: SchoolProfile = {
  name: "", legalName: "", type: "Secondary School", country: "Cameroon", region: "", city: "", address: "",
  phone: "", email: "", website: "", timezone: "Africa/Douala", curriculum: "Cameroon National Curriculum",
  levels: [], studentCount: "", adminName: "", adminRole: "Principal / School Administrator",
  adminEmail: "", adminPhone: "", academicYear: "2026/2027", teachingDays: "Monday – Friday",
};

const STEP_LABELS = ["Account", "School profile", "Academic setup", "Review"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateStep(step: number, profile: SchoolProfile, password: string, confirmPassword: string) {
  const e: Record<string, string> = {};
  if (step === 1) {
    if (!profile.adminName.trim()) e.adminName = "Enter the administrator's full name.";
    if (!profile.adminEmail.trim()) e.adminEmail = "Enter a work email address.";
    else if (!EMAIL_RE.test(profile.adminEmail)) e.adminEmail = "Enter a valid email address.";
    if (!password) e.password = "Choose a password.";
    else if (password.length < 8) e.password = "Use at least 8 characters.";
    if (confirmPassword !== password) e.confirmPassword = "Passwords do not match.";
  }
  if (step === 2) {
    if (!profile.name.trim()) e.name = "Enter your school's display name.";
    if (!profile.country.trim()) e.country = "Enter a country.";
  }
  if (step === 3) {
    if (!profile.studentCount) e.studentCount = "Select an estimated student count.";
    if (profile.levels.length === 0) e.levels = "Select at least one level.";
  }
  return e;
}

// Everything create_school_workspace() needs, attached to the not-yet-confirmed
// auth user as metadata. Read back out of the session in app/auth/callback/route.ts
// once the confirmation link is clicked, since there's no session to call the RPC with before then.
function buildPendingSchool(profile: SchoolProfile) {
  return {
    school_name: profile.name,
    school_type: profile.type,
    country: profile.country,
    region: profile.region,
    city: profile.city,
    address: profile.address,
    school_phone: profile.phone,
    school_email: profile.email,
    school_website: profile.website,
    timezone: profile.timezone,
    curriculum: profile.curriculum,
    estimated_students: profile.studentCount,
    admin_full_name: profile.adminName,
    admin_phone: profile.adminPhone,
    admin_job_title: profile.adminRole,
    academic_year_name: profile.academicYear,
    working_days_count: profile.teachingDays === "Monday – Saturday" ? 6 : 5,
    levels: profile.levels,
  };
}

function Field({ label, required, error, hint, wide, children }: { label: string; required?: boolean; error?: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={[error && "invalid", wide && "span-2"].filter(Boolean).join(" ") || undefined}>
      <span>{label}{required && <i className="req">*</i>}</span>
      {children}
      {error ? <small className="field-error">{error}</small> : hint ? <small className="field-hint">{hint}</small> : null}
    </label>
  );
}

export function AuthScreen({ onComplete, onBack }: { onComplete: () => void; onBack: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState(initial);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
  const [signinError, setSigninError] = useState("");

  const update = (k: keyof SchoolProfile, v: string | string[]) => setProfile(p => ({ ...p, [k]: v }));

  const goToStep = (n: number) => { setErrors({}); setStep(n); };

  const next = async () => {
    const stepErrors = validateStep(step, profile, password, confirmPassword);
    if (Object.keys(stepErrors).length) { setErrors(stepErrors); return; }
    setErrors({});
    if (step < 4) { setStep(step + 1); return; }

    const supabase = createClient();
    if (!supabase) { toast.error("Supabase isn't configured — check .env.local"); return; }

    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: profile.adminEmail,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        data: { full_name: profile.adminName, pending_school: buildPendingSchool(profile) },
      },
    });
    setSubmitting(false);

    if (error) { toast.error(error.message); return; }
    setAwaitingConfirmation(true);
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    if (!supabase) { toast.error("Supabase isn't configured — check .env.local"); return; }
    setSigninError("");
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: signinEmail, password: signinPassword });
    setSubmitting(false);
    if (error) { setSigninError(error.message); return; }
    onComplete();
  };

  if (mode === "signin") return (
    <div className="auth-layout">
      <div className="auth-brand">
        <div className="brand light"><span className="brand-mark"><CalendarDays /></span>ClassGrid</div>
        <div><span className="auth-kicker">WELCOME BACK</span><h1>Your whole school week, under control.</h1><p>Sign in to continue configuring, generating and publishing your timetables.</p></div>
        <small>Conflict-free by design.</small>
      </div>
      <div className="auth-form-wrap">
        <button className="back-link" onClick={onBack}><ArrowLeft /> Back to home</button>
        <form className="auth-form" onSubmit={signIn}>
          <h2>Sign in</h2>
          <p>Enter your school administrator account.</p>
          <label>Email address<input type="email" value={signinEmail} onChange={e => setSigninEmail(e.target.value)} placeholder="admin@school.com" required /></label>
          <label>Password<div className="password"><input type={show ? "text" : "password"} value={signinPassword} onChange={e => setSigninPassword(e.target.value)} placeholder="••••••••" required /><button type="button" onClick={() => setShow(!show)}>{show ? <EyeOff /> : <Eye />}</button></div></label>
          {signinError && <small className="field-error">{signinError}</small>}
          <div className="form-row"><label className="check"><input type="checkbox" /> Remember me</label><button type="button" className="text-btn">Forgot password?</button></div>
          <button className="btn primary full" disabled={submitting}>{submitting ? "Signing in…" : <>Sign in <ArrowRight /></>}</button>
          <p className="center">New school? <button type="button" className="text-btn" onClick={() => setMode("signup")}>Create an account</button></p>
        </form>
      </div>
    </div>
  );

  if (awaitingConfirmation) return (
    <div className="onboarding">
      <header>
        <div className="brand"><span className="brand-mark"><CalendarDays /></span>ClassGrid</div>
      </header>
      <section className="setup-card confirm-card">
        <div className="setup-icon success"><Mail /></div>
        <h1>Check your email</h1>
        <p>We sent a confirmation link to <b>{profile.adminEmail}</b>. Click it to activate your account — your school workspace gets created the moment you confirm.</p>
        <div className="success-box review-note"><Check /><div><b>Didn't get it?</b><p>Check spam, or go back and try signing up again in a minute.</p></div></div>
        <footer><button className="btn ghost" onClick={onBack}><ArrowLeft /> Back to home</button></footer>
      </section>
    </div>
  );

  return (
    <div className="onboarding">
      <header>
        <div className="brand"><span className="brand-mark"><CalendarDays /></span>ClassGrid</div>
        <button className="btn ghost" onClick={() => setMode("signin")}>Already registered? Sign in</button>
      </header>
      <div className="stepper">
        {STEP_LABELS.map((x, i) => {
          const n = i + 1;
          const done = n < step;
          return (
            <div className={["step", n <= step && "active", done && "clickable"].filter(Boolean).join(" ")} key={x} onClick={() => done && goToStep(n)}>
              <span>{done ? <Check /> : n}</span><b>{x}</b>
            </div>
          );
        })}
      </div>
      <p className="step-progress">Step {step} of 4 — {STEP_LABELS[step - 1]}</p>
      <section className="setup-card">
        {step === 1 && <>
          <div className="setup-icon"><School2 /></div>
          <h1>Create your school workspace</h1>
          <p>Start with the account responsible for managing your school timetable.</p>
          <div className="form-grid">
            <div className="form-section span-2"><b>Your details</b></div>
            <Field label="Administrator full name" required error={errors.adminName}>
              <input value={profile.adminName} onChange={e => update("adminName", e.target.value)} placeholder="e.g. Grace Manka" />
            </Field>
            <Field label="Role">
              <select value={profile.adminRole} onChange={e => update("adminRole", e.target.value)}>
                <option>Principal / School Administrator</option><option>Discipline Master</option><option>Timetable Officer</option><option>Proprietor</option>
              </select>
            </Field>
            <div className="form-section span-2"><b>Login credentials</b></div>
            <Field label="Work email" required error={errors.adminEmail}>
              <input type="email" value={profile.adminEmail} onChange={e => update("adminEmail", e.target.value)} placeholder="admin@school.com" />
            </Field>
            <Field label="Phone number">
              <input value={profile.adminPhone} onChange={e => update("adminPhone", e.target.value)} placeholder="+237 6XX XXX XXX" />
            </Field>
            <Field label="Password" required error={errors.password} hint="Minimum 8 characters">
              <div className="password"><input type={show ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" /><button type="button" onClick={() => setShow(!show)}>{show ? <EyeOff /> : <Eye />}</button></div>
            </Field>
            <Field label="Confirm password" required error={errors.confirmPassword}>
              <div className="password"><input type={show ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" /></div>
            </Field>
          </div>
        </>}
        {step === 2 && <>
          <h1>Tell us about your school</h1>
          <p>This information appears on timetables and keeps your workspace correctly configured.</p>
          <div className="form-grid">
            <div className="form-section span-2"><b>About your school</b></div>
            <Field label="School display name" required error={errors.name}>
              <input value={profile.name} onChange={e => update("name", e.target.value)} placeholder="Excellence Bilingual Academy" />
            </Field>
            <Field label="Registered/legal name">
              <input value={profile.legalName} onChange={e => update("legalName", e.target.value)} placeholder="Official school name" />
            </Field>
            <Field label="School type">
              <select value={profile.type} onChange={e => update("type", e.target.value)}>
                <option>Primary School</option><option>Secondary School</option><option>Primary & Secondary School</option><option>Technical School</option><option>Commercial School</option>
              </select>
            </Field>
            <Field label="Curriculum">
              <input value={profile.curriculum} onChange={e => update("curriculum", e.target.value)} />
            </Field>
            <div className="form-section span-2"><b>Location</b></div>
            <Field label="Country" required error={errors.country}>
              <input value={profile.country} onChange={e => update("country", e.target.value)} />
            </Field>
            <Field label="Region / State">
              <input value={profile.region} onChange={e => update("region", e.target.value)} placeholder="Littoral" />
            </Field>
            <Field label="City">
              <input value={profile.city} onChange={e => update("city", e.target.value)} placeholder="Douala" />
            </Field>
            <Field label="Physical address" wide>
              <input value={profile.address} onChange={e => update("address", e.target.value)} placeholder="Street or neighbourhood" />
            </Field>
            <div className="form-section span-2"><b>Contact</b></div>
            <Field label="School email">
              <input value={profile.email} onChange={e => update("email", e.target.value)} />
            </Field>
            <Field label="School phone">
              <input value={profile.phone} onChange={e => update("phone", e.target.value)} />
            </Field>
            <Field label="Website (optional)" wide>
              <input value={profile.website} onChange={e => update("website", e.target.value)} placeholder="https://..." />
            </Field>
          </div>
        </>}
        {step === 3 && <>
          <h1>Set your academic starting point</h1>
          <p>You can adjust all these details later in School Settings.</p>
          <div className="form-grid">
            <div className="form-section span-2"><b>Calendar &amp; scale</b></div>
            <Field label="Academic year">
              <select value={profile.academicYear} onChange={e => update("academicYear", e.target.value)}>
                <option>2026/2027</option><option>2025/2026</option>
              </select>
            </Field>
            <Field label="Timezone">
              <select value={profile.timezone} onChange={e => update("timezone", e.target.value)}>
                <option>Africa/Douala</option><option>Africa/Lagos</option><option>Africa/Accra</option>
              </select>
            </Field>
            <Field label="Teaching days">
              <select value={profile.teachingDays} onChange={e => update("teachingDays", e.target.value)}>
                <option>Monday – Friday</option><option>Monday – Saturday</option>
              </select>
            </Field>
            <Field label="Estimated student count" required error={errors.studentCount}>
              <select value={profile.studentCount} onChange={e => update("studentCount", e.target.value)}>
                <option value="">Select a range</option><option>Below 200</option><option>200 – 499</option><option>500 – 999</option><option>1,000+</option>
              </select>
            </Field>
            <fieldset className="span-2">
              <legend>Levels offered{errors.levels && <span className="field-error inline">{errors.levels}</span>}</legend>
              <div className="choice-grid">
                {["Primary", "Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "Lower Sixth", "Upper Sixth"].map(x => (
                  <button type="button" className={profile.levels.includes(x) ? "choice selected" : "choice"} onClick={() => update("levels", profile.levels.includes(x) ? profile.levels.filter(y => y !== x) : [...profile.levels, x])} key={x}>
                    {profile.levels.includes(x) && <Check />}{x}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </>}
        {step === 4 && <>
          <div className="setup-icon success"><Check /></div>
          <h1>Your workspace is ready to create</h1>
          <p>Review the starting details. You'll continue with periods, classes, subjects and teachers inside the setup guide.</p>
          <div className="review-groups">
            <div className="review-block">
              <div className="review-block-head"><b>Account</b><button type="button" onClick={() => goToStep(1)}>Edit</button></div>
              <div className="review">
                <div><span>Administrator</span><b>{profile.adminName || "—"}</b></div>
                <div><span>Role</span><b>{profile.adminRole}</b></div>
                <div><span>Work email</span><b>{profile.adminEmail || "—"}</b></div>
              </div>
            </div>
            <div className="review-block">
              <div className="review-block-head"><b>School profile</b><button type="button" onClick={() => goToStep(2)}>Edit</button></div>
              <div className="review">
                <div><span>School</span><b>{profile.name || "Untitled school"}</b></div>
                <div><span>Type</span><b>{profile.type}</b></div>
                <div><span>Location</span><b>{[profile.city, profile.country].filter(Boolean).join(", ") || "—"}</b></div>
              </div>
            </div>
            <div className="review-block">
              <div className="review-block-head"><b>Academic setup</b><button type="button" onClick={() => goToStep(3)}>Edit</button></div>
              <div className="review">
                <div><span>Academic year</span><b>{profile.academicYear}</b></div>
                <div><span>Teaching days</span><b>{profile.teachingDays}</b></div>
                <div><span>Levels</span><b>{profile.levels.join(", ") || "To be configured"}</b></div>
              </div>
            </div>
          </div>
          <div className="success-box review-note"><Check /><div><b>Your school's data is isolated</b><p>Only administrators you invite to this workspace can see these records.</p></div></div>
        </>}
        <footer>
          <button className="btn ghost" onClick={() => { setErrors({}); step === 1 ? onBack() : setStep(step - 1); }}><ArrowLeft /> {step === 1 ? "Cancel" : "Back"}</button>
          <button className="btn primary" onClick={next} disabled={submitting}>{submitting ? "Creating workspace…" : <>{step === 4 ? "Create school workspace" : "Continue"}<ArrowRight /></>}</button>
        </footer>
      </section>
    </div>
  );
}
