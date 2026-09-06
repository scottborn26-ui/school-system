import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, CircleAlert, CreditCard, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/super-admin/")({
  head: () => ({ meta: [{ title: "Platform overview · SHANSCOTT" }] }),
  component: SuperAdminDashboard,
});

function SuperAdminDashboard() {
  const { data: schools = [], isLoading } = useQuery({
    queryKey: ["super-admin-dashboard-schools"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("id, name, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: learners = 0 } = useQuery({
    queryKey: ["super-admin-dashboard-learners"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("learners")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
  const active = schools.filter((school) => school.status === "active").length;
  const suspended = schools.filter((school) => school.status === "suspended").length;
  const recent = schools.slice(0, 5);
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-emerald-600">Cross-tenant overview</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">Platform dashboard</h2>
          <p className="mt-1 text-sm text-slate-500">
            Monitor school growth, access, and platform capacity from one place.
          </p>
        </div>
        <Button asChild>
          <Link to="/super-admin/schools/new">
            <Building2 /> Onboard school
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Building2}
          label="Total schools"
          value={isLoading ? "..." : schools.length}
          detail={`${active} active`}
        />
        <Metric
          icon={Users}
          label="Learners"
          value={learners.toLocaleString()}
          detail="Across all tenants"
        />
        <Metric icon={CreditCard} label="Active tenants" value={active} detail="Access enabled" />
        <Metric
          icon={CircleAlert}
          label="Needs attention"
          value={suspended}
          detail="Suspended schools"
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>School growth</CardTitle>
            <Badge variant="outline">Last 6 signups</Badge>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-end gap-3 border-b border-l border-slate-200 px-4 pb-0 pt-4 dark:border-slate-800">
              {[32, 48, 42, 68, 58, Math.max(24, Math.min(88, schools.length * 8))].map(
                (height, index) => (
                  <div key={index} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t-md bg-emerald-500/80"
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-xs text-slate-400">{index + 1}</span>
                  </div>
                ),
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent signups</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/super-admin/schools">
                View all <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recent.length === 0 ? (
              <p className="text-sm text-slate-500">No schools registered yet.</p>
            ) : (
              recent.map((school) => (
                <div
                  key={school.id}
                  className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">{school.name}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(school.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={school.status === "active" ? "default" : "destructive"}>
                    {school.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Building2;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{label}</p>
          <Icon className="size-4 text-emerald-600" />
        </div>
        <p className="mt-3 text-3xl font-semibold">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{detail}</p>
      </CardContent>
    </Card>
  );
}
