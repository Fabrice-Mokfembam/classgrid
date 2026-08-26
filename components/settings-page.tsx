"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, ImageUp, Info, Mail, MapPin, Save, School2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useSchool } from "@/lib/school-context";
import { ErrorState, Skel } from "@/components/shared";

const SCHOOL_TYPES = ["Primary School", "Secondary School", "Primary & Secondary School", "Technical School", "Commercial School"];

type SchoolProfileForm = {
  name: string; legalName: string; schoolType: string; curriculum: string;
  country: string; region: string; city: string; timezone: string;
  address: string; email: string; phone: string; logoUrl: string;
};

const LOGO_BUCKET = "school-logos";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const LOGO_PATHS = ["logo.png", "logo.jpg", "logo.webp"];

export function SettingsPage() {
  const { schoolId, loading: schoolLoading, retry: refreshSchool } = useSchool();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [form, setForm] = useState<SchoolProfileForm | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !schoolId) { setLoading(false); return; }
    setLoading(true); setLoadError(null);
    const { data, error } = await supabase.from("schools")
      .select("name, legal_name, school_type, curriculum, country, region, city, timezone, address, email, phone, logo_url")
      .eq("id", schoolId).single();
    if (error) { setLoadError(error.message); setLoading(false); return; }
    setForm({
      name: data.name ?? "", legalName: data.legal_name ?? "", schoolType: data.school_type || SCHOOL_TYPES[0],
      curriculum: data.curriculum ?? "", country: data.country ?? "", region: data.region ?? "", city: data.city ?? "",
      timezone: data.timezone ?? "", address: data.address ?? "", email: data.email ?? "", phone: data.phone ?? "",
      logoUrl: data.logo_url ?? "",
    });
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { if (!schoolLoading) load(); }, [schoolLoading, load]);

  function set<K extends keyof SchoolProfileForm>(key: K, value: string) {
    setForm(f => f ? { ...f, [key]: value } : f);
  }

  async function uploadLogo(file: File) {
    if (!schoolId) return;
    if (!LOGO_TYPES.includes(file.type)) { toast.error("Use a PNG, JPG, or WebP logo"); return; }
    if (file.size > MAX_LOGO_BYTES) { toast.error("Logo must be 2 MB or smaller"); return; }
    const supabase = createClient();
    if (!supabase) return;

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${schoolId}/logo.${ext}`;
    setUploadingLogo(true);
    const { error: uploadError } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });
    if (uploadError) { setUploadingLogo(false); toast.error(uploadError.message); return; }

    const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
    const publicUrl = `${data.publicUrl}?v=${Date.now()}`;
    const { error: updateError } = await supabase.from("schools").update({ logo_url: publicUrl }).eq("id", schoolId);
    setUploadingLogo(false);
    if (updateError) { toast.error(updateError.message); return; }
    const oldPaths = LOGO_PATHS.filter(p => p !== `logo.${ext}`).map(p => `${schoolId}/${p}`);
    if (oldPaths.length > 0) await supabase.storage.from(LOGO_BUCKET).remove(oldPaths);
    set("logoUrl", publicUrl);
    refreshSchool();
    toast.success("School logo uploaded");
  }

  async function removeLogo() {
    if (!schoolId) return;
    const supabase = createClient();
    if (!supabase) return;
    setUploadingLogo(true);
    const { error } = await supabase.from("schools").update({ logo_url: null }).eq("id", schoolId);
    setUploadingLogo(false);
    if (error) { toast.error(error.message); return; }
    await supabase.storage.from(LOGO_BUCKET).remove(LOGO_PATHS.map(path => `${schoolId}/${path}`));
    set("logoUrl", "");
    refreshSchool();
    toast.success("School logo removed");
  }

  async function save() {
    if (!form || !schoolId) return;
    if (!form.name.trim()) { toast.error("School display name is required"); return; }
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true);
    const { error } = await supabase.from("schools").update({
      name: form.name.trim(), legal_name: form.legalName.trim() || null, school_type: form.schoolType,
      curriculum: form.curriculum.trim() || null, country: form.country.trim(), region: form.region.trim() || null,
      city: form.city.trim() || null, timezone: form.timezone.trim() || "Africa/Douala",
      address: form.address.trim() || null, email: form.email.trim() || null, phone: form.phone.trim() || null,
    }).eq("id", schoolId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    refreshSchool();
    toast.success("School profile saved");
  }

  if (loadError) return <ErrorState message={loadError} onRetry={load} />;

  if (loading || !form) return <section className="panel form-panel">
    <div className="section-heading"><div><h3>School profile</h3><p>This information is kept inside your school workspace.</p></div></div>
    <div className="form-grid wide">{Array.from({ length: 11 }).map((_, i) => <label key={i}><Skel w="50%" /><br /><Skel w="100%" /></label>)}</div>
  </section>;

  return <section className="panel settings-profile">
    <header className="settings-profile-header"><div><span><School2 /></span><div><h3>School profile</h3><p>Manage the official details used across this workspace.</p></div></div></header>

    <div className="settings-profile-body">
      <div className="settings-note"><Info /><div><b>Where this information appears</b><p>Your display name and logo are shown in the workspace header and on exported timetables. Registered and contact details remain part of the school profile.</p></div></div>

      <section className="settings-section">
        <div className="settings-section-title"><Building2 /><div><h4>Identity and branding</h4><p>How the school is named and represented throughout ClassGrid.</p></div></div>
        <div className="settings-logo-card">
          <span>{form.logoUrl ? <img src={form.logoUrl} alt={`${form.name} logo`} /> : <School2 />}</span>
          <div><b>School logo</b><p>PNG, JPG, or WebP. Maximum file size: 2 MB.</p><div className="logo-actions"><input ref={fileInputRef} className="file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const file = e.target.files?.[0]; if (file) uploadLogo(file); e.currentTarget.value = ""; }} /><button type="button" className="btn" onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}><ImageUp /> {uploadingLogo ? "Uploading…" : form.logoUrl ? "Replace logo" : "Upload logo"}</button>{form.logoUrl && <button type="button" className="icon-btn settings-remove-logo" aria-label="Remove school logo" title="Remove school logo" onClick={removeLogo} disabled={uploadingLogo}><Trash2 /></button>}</div></div>
        </div>
        <div className="settings-field-grid">
          <label>School display name<input required value={form.name} onChange={e => set("name", e.target.value)} placeholder="Name shown in ClassGrid" /></label>
          <label>Registered name <small>Optional</small><input value={form.legalName} onChange={e => set("legalName", e.target.value)} placeholder="Official registered name" /></label>
          <label>School type<select value={form.schoolType} onChange={e => set("schoolType", e.target.value)}>{SCHOOL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
          <label>Curriculum<input value={form.curriculum} onChange={e => set("curriculum", e.target.value)} placeholder="e.g. Cameroon National Curriculum" /></label>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-title"><MapPin /><div><h4>Location and time</h4><p>Used for regional context and timetable dates.</p></div></div>
        <div className="settings-field-grid location">
          <label>Country<input value={form.country} onChange={e => set("country", e.target.value)} placeholder="Country" /></label>
          <label>Region<input value={form.region} onChange={e => set("region", e.target.value)} placeholder="Region or state" /></label>
          <label>City<input value={form.city} onChange={e => set("city", e.target.value)} placeholder="City" /></label>
          <label>Timezone<input value={form.timezone} onChange={e => set("timezone", e.target.value)} placeholder="e.g. Africa/Douala" /></label>
          <label className="settings-span-all">Physical address <small>Optional</small><input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Street or campus address" /></label>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-title"><Mail /><div><h4>Contact details</h4><p>General contact information for the school.</p></div></div>
        <div className="settings-field-grid">
          <label>School email <small>Optional</small><input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="school@example.com" /></label>
          <label>School phone <small>Optional</small><input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="Phone number" /></label>
        </div>
      </section>
    </div>

    <footer className="settings-save-bar"><span>Changes to the school name update the workspace after saving.</span><button className="btn primary" onClick={save} disabled={saving}><Save /> {saving ? "Saving…" : "Save changes"}</button></footer>
  </section>;
}
