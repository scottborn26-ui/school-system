import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Building2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlatformPage } from "@/components/platform-page";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/super-admin/schools/new")({ component: NewSchoolPage });
function NewSchoolPage() { const navigate = useNavigate(); const [name, setName] = useState(""); const [slug, setSlug] = useState(""); const [county, setCounty] = useState(""); const [saving, setSaving] = useState(false); async function submit(event: React.FormEvent) { event.preventDefault(); if (!name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { toast.error("Enter a school name and lowercase slug."); return; } setSaving(true); const { data, error } = await supabase.from("schools").insert({ name: name.trim(), slug, county: county || null, curriculum_type: "cbc_cbe", status: "active" }).select("id").single(); setSaving(false); if (error) { toast.error(error.message); return; } toast.success("School tenant created."); if (data) void navigate({ to: "/super-admin/schools/$schoolId", params: { schoolId: data.id } }); }
  return <PlatformPage eyebrow="Core operations" title="Add school tenant" description="Provision a new school with its platform identity and curriculum settings." action={<Button asChild variant="outline" className="rounded-xl"><Link to="/super-admin/schools"><ArrowLeft /> Back to tenants</Link></Button>}><Card><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="size-5 text-emerald-600" /> Tenant identity</CardTitle></CardHeader><CardContent><form onSubmit={submit} className="grid max-w-2xl gap-5"><div className="grid gap-2"><Label htmlFor="school-name">School name</Label><Input id="school-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Shanscott Academy" /></div><div className="grid gap-2"><Label htmlFor="school-slug">Subdomain slug</Label><Input id="school-slug" value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="shanscott-academy" /><p className="text-xs text-muted-foreground">The tenant will use {slug || "your-school"}.shanscott.com</p></div><div className="grid gap-2"><Label htmlFor="school-county">County / region</Label><Input id="school-county" value={county} onChange={(event) => setCounty(event.target.value)} placeholder="Nairobi" /></div><Button disabled={saving} className="w-fit rounded-xl bg-emerald-600 hover:bg-emerald-700"><Save /> {saving ? "Creating..." : "Create tenant"}</Button></form></CardContent></Card></PlatformPage>;
}
