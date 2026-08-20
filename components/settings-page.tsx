"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImageUp, School2, Trash2 } from "lucide-react";
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

  return <section className="panel form-panel">
    <div className="section-heading">
      <div><h3>School profile</h3><p>This information is kept inside your school workspace.</p></div>
      <button className="btn primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
    </div>
    <div className="logo-upload">
      <span>{form.logoUrl ? <img src={form.logoUrl} alt={`${form.name} logo`} /> : <School2 />}</span>
      <div>
        <b>School logo</b>
        <p>PNG, JPG, or WebP, maximum 2 MB</p>
        <div className="logo-actions">
          <input ref={fileInputRef} className="file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const file = e.target.files?.[0]; if (file) uploadLogo(file); e.currentTarget.value = ""; }} />
          <button type="button" className="btn" onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}><ImageUp /> {uploadingLogo ? "Uploading…" : "Upload logo"}</button>
          {form.logoUrl && <button type="button" className="btn danger" onClick={removeLogo} disabled={uploadingLogo}><Trash2 /> Remove</button>}
        </div>
      </div>
    </div>
    <div className="form-grid wide">
      <label>School display name<input value={form.name} onChange={e => set("name", e.target.value)} /></label>
      <label>Registered name<input value={form.legalName} onChange={e => set("legalName", e.target.value)} /></label>
      <label>School type<select value={form.schoolType} onChange={e => set("schoolType", e.target.value)}>{SCHOOL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
      <label>Curriculum<input value={form.curriculum} onChange={e => set("curriculum", e.target.value)} /></label>
      <label>Country<input value={form.country} onChange={e => set("country", e.target.value)} /></label>
      <label>Region<input value={form.region} onChange={e => set("region", e.target.value)} /></label>
      <label>City<input value={form.city} onChange={e => set("city", e.target.value)} /></label>
      <label>Timezone<input value={form.timezone} onChange={e => set("timezone", e.target.value)} placeholder="e.g. Africa/Douala" /></label>
      <label className="span-2">Physical address<input value={form.address} onChange={e => set("address", e.target.value)} /></label>
      <label>School email<input type="email" value={form.email} onChange={e => set("email", e.target.value)} /></label>
      <label>School phone<input value={form.phone} onChange={e => set("phone", e.target.value)} /></label>
    </div>
  </section>;
}
