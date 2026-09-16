import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Plus } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, FilterBar, PlatformPage, RowMenu, StatusBadge, fetchPlatformRows } from "@/components/platform-page";

export const Route = createFileRoute("/_authenticated/super-admin/schools")({ component: SchoolsPage });
type School = { id: string; name: string; slug: string | null; county: string | null; curriculum_type: string | null; status: string; created_at: string };

function SchoolsPage() {
  const [search, setSearch] = useState("");
  const { data = [], isLoading, error } = useQuery({ queryKey: ["platform-schools"], queryFn: () => fetchPlatformRows<School>("schools", "id,name,slug,county,curriculum_type,status,created_at") });
  const schools = data.filter((school) => `${school.name} ${school.slug ?? ""} ${school.county ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <PlatformPage eyebrow="Core operations" title="School tenants" description="Manage every school connected to the SHANSCOTT platform." action={<Button asChild className="rounded-xl bg-emerald-600 hover:bg-emerald-700"><Link to="/super-admin/schools/new"><Plus /> Add school</Link></Button>}>
    <DataTable columns={["School tenant", "Region", "Curriculum", "Status", "Joined", "Actions"]} loading={isLoading} error={error ? "School data could not be loaded. Check platform RLS." : undefined} empty="No school tenants match this search.">
      {schools.length ? schools.map((school) => <tr key={school.id} className="border-b border-border/60"><td className="px-4 py-4"><Link className="flex items-center gap-3 font-semibold hover:text-emerald-700" to="/super-admin/schools/$schoolId" params={{ schoolId: school.id }}><span className="grid size-9 place-items-center rounded-xl bg-emerald-100 text-xs font-black text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"><Building2 className="size-4" /></span><span><span className="block">{school.name}</span><span className="text-xs font-normal text-muted-foreground">{school.slug ? `${school.slug}.shanscott.com` : "Subdomain pending"}</span></span></Link></td><td className="px-4 py-4 text-sm text-muted-foreground">{school.county ?? "Not set"}</td><td className="px-4 py-4"><Badge variant="outline" className="capitalize">{school.curriculum_type?.replaceAll("_", " / ") ?? "CBC / CBE"}</Badge></td><td className="px-4 py-4"><StatusBadge value={school.status} /></td><td className="px-4 py-4 text-sm text-muted-foreground">{new Date(school.created_at).toLocaleDateString()}</td><td className="px-4 py-4"><RowMenu items={[{ label: "View tenant", onSelect: () => {} }, { label: "Copy tenant ID", onSelect: () => void navigator.clipboard?.writeText(school.id) }]} /></td></tr>) : undefined}
    </DataTable>
    <Card className="border-emerald-900/10 bg-emerald-50/50 dark:border-emerald-500/10 dark:bg-emerald-950/20"><CardContent className="flex items-start gap-3 p-4 text-sm"><Building2 className="mt-0.5 size-4 text-emerald-700" /><p className="text-muted-foreground">Tenant actions are protected by the `is_super_admin()` policy and always operate against the selected school ID.</p></CardContent></Card>
  </PlatformPage>;
}
