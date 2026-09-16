import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Database, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricStrip, PlatformPage, StatusBadge, fetchPlatformRows } from "@/components/platform-page";

export const Route = createFileRoute("/_authenticated/super-admin/schools/$schoolId")({ component: SchoolDetailPage });
type School = { id: string; name: string; slug: string | null; county: string | null; curriculum_type: string | null; status: string; storage_used_mb: number | null; created_at: string };
type Subscription = { school_id: string; plan: string; status: string; max_students: number; storage_limit_mb: number };
function SchoolDetailPage() {
  const { schoolId } = Route.useParams();
  const { data: schools = [], isLoading } = useQuery({ queryKey: ["platform-school", schoolId], queryFn: () => fetchPlatformRows<School>("schools", "id,name,slug,county,curriculum_type,status,storage_used_mb,created_at") });
  const { data: subscriptions = [] } = useQuery({ queryKey: ["platform-school-subscription", schoolId], queryFn: () => fetchPlatformRows<Subscription>("platform_subscriptions", "school_id,plan,status,max_students,storage_limit_mb") });
  const school = schools.find((item) => item.id === schoolId); const subscription = subscriptions.find((item) => item.school_id === schoolId);
  return <PlatformPage eyebrow="Tenant registry" title={school?.name ?? (isLoading ? "Loading tenant..." : "Tenant not found")} description="Tenant profile, capacity, subscription, and platform access." action={<Button asChild variant="outline" className="rounded-xl"><Link to="/super-admin/schools"><ArrowLeft /> Back to tenants</Link></Button>}>
    {!school && !isLoading ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">This tenant could not be found.</CardContent></Card> : <><MetricStrip items={[{ label: "Status", value: <StatusBadge value={school?.status} />, icon: Building2 }, { label: "Learner capacity", value: subscription?.max_students ?? "-", detail: subscription?.plan ?? "No plan", icon: Users, tone: "blue" }, { label: "Storage used", value: `${school?.storage_used_mb ?? 0} MB`, detail: `of ${subscription?.storage_limit_mb ?? 0} MB`, icon: Database, tone: "amber" }]} /><Card><CardHeader><CardTitle>Tenant profile</CardTitle></CardHeader><CardContent className="grid gap-4 text-sm sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Region</p><p className="font-semibold">{school?.county ?? "Not configured"}</p></div><div><p className="text-xs text-muted-foreground">Curriculum</p><p className="font-semibold">{school?.curriculum_type?.replaceAll("_", " / ") ?? "CBC / CBE"}</p></div><div><p className="text-xs text-muted-foreground">Subscription</p><p className="font-semibold capitalize">{subscription?.plan ?? "Not provisioned"}</p></div><div><p className="text-xs text-muted-foreground">Joined</p><p className="font-semibold">{school && new Date(school.created_at).toLocaleDateString()}</p></div></CardContent></Card></>}
  </PlatformPage>;
}
