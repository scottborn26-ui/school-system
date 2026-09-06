import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Check, ShieldAlert, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlatformConfirmDialog } from "@/components/platform-confirm-dialog";
import { supabase } from "@/lib/supabase";

const MODULES = [
  "registrar",
  "accountant",
  "library",
  "attendance",
  "exams",
  "messaging",
  "transport",
];
export const Route = createFileRoute("/_authenticated/super-admin/schools/$schoolId")({
  component: SchoolDetailPage,
});

function SchoolDetailPage() {
  const { schoolId } = Route.useParams();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { data: school, isLoading } = useQuery({
    queryKey: ["super-admin-school", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select(
          "id, name, slug, county, curriculum_type, status, storage_used_mb, brand_colors, created_at, onboarding_completed",
        )
        .eq("id", schoolId)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const { data: modules = [] } = useQuery({
    queryKey: ["super-admin-modules", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_modules" as never)
        .select("module_name, enabled, config")
        .eq("tenant_id", schoolId);
      if (error) throw error;
      return data as { module_name: string; enabled: boolean; config: Record<string, unknown> }[];
    },
  });
  const { data: subscription } = useQuery({
    queryKey: ["super-admin-subscription", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_subscriptions" as never)
        .select(
          "id, status, payment_status, start_date, renewal_date, subscription_plans(name, max_students, storage_limit_mb)",
        )
        .eq("tenant_id", schoolId)
        .in("status", ["trialing", "active", "past_due"])
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        status: string;
        payment_status: string;
        start_date: string;
        renewal_date: string | null;
        subscription_plans: { name: string; max_students: number; storage_limit_mb: number } | null;
      } | null;
    },
  });
  const { data: audit = [] } = useQuery({
    queryKey: ["super-admin-school-audit", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_audit_logs")
        .select("id, action, entity, created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function toggleModule(moduleName: string) {
    const current = modules.find((module) => module.module_name === moduleName)?.enabled ?? false;
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("tenant_modules" as never).upsert({
      tenant_id: schoolId,
      module_name: moduleName,
      enabled: !current,
      updated_by: user.user?.id,
    } as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["super-admin-modules", schoolId] });
    toast.success(`${moduleName} ${current ? "disabled" : "enabled"}.`);
  }
  async function suspendSchool() {
    if (!school) return;
    const { error } = await supabase
      .from("schools")
      .update({ status: "suspended" })
      .eq("id", schoolId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setConfirmOpen(false);
    await queryClient.invalidateQueries({ queryKey: ["super-admin-school", schoolId] });
    toast.success(`${school.name} was suspended.`);
  }
  if (isLoading) return <p className="text-sm text-slate-500">Loading school...</p>;
  if (!school) return <p className="text-sm text-slate-500">School not found.</p>;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/super-admin/schools" aria-label="Back to schools">
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <p className="text-sm font-medium text-emerald-600">School tenant</p>
            <h2 className="text-3xl font-semibold tracking-tight">{school.name}</h2>
            <p className="text-sm text-slate-500">
              {school.slug
                ? `${school.slug}.shanscott.com`
                : (school.county ?? "No subdomain configured")}
            </p>
          </div>
        </div>
        <Badge variant={school.status === "active" ? "default" : "destructive"}>
          {school.status}
        </Badge>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Info label="Curriculum" value={school.curriculum_type.replaceAll("_", " / ")} />
            <Info label="Created" value={new Date(school.created_at).toLocaleDateString()} />
            <Info label="Storage used" value={`${school.storage_used_mb ?? 0} MB`} />
            <Info
              label="Onboarding"
              value={school.onboarding_completed ? "Complete" : "In progress"}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {subscription ? (
              <>
                <Info label="Plan" value={subscription.subscription_plans?.name ?? "Unknown"} />
                <Info
                  label="Status"
                  value={`${subscription.status} · ${subscription.payment_status}`}
                />
                <Info label="Renewal" value={subscription.renewal_date ?? "Not set"} />
              </>
            ) : (
              <p className="text-sm text-slate-500">No active subscription.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Modules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {MODULES.map((moduleName) => {
              const enabled =
                modules.find((module) => module.module_name === moduleName)?.enabled ?? false;
              return (
                <button
                  type="button"
                  key={moduleName}
                  onClick={() => void toggleModule(moduleName)}
                  className="flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <span className="capitalize">{moduleName}</span>
                  {enabled ? (
                    <ToggleRight className="size-5 text-emerald-600" />
                  ) : (
                    <ToggleLeft className="size-5 text-slate-400" />
                  )}
                </button>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tenant audit log</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {audit.length === 0 ? (
              <p className="text-sm text-slate-500">No platform events for this school.</p>
            ) : (
              audit.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between border-b py-2 last:border-0"
                >
                  <span className="text-sm">
                    {entry.action} {entry.entity}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <ShieldAlert className="size-4" /> Danger zone
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Suspension blocks tenant access without deleting school data.
          </p>
          <Button
            variant="destructive"
            disabled={school.status === "suspended"}
            onClick={() => setConfirmOpen(true)}
          >
            <ShieldAlert /> Suspend school
          </Button>
        </CardContent>
      </Card>
      <PlatformConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Suspend school?"
        description="This will block access for the tenant while preserving its data."
        confirmation={school.name}
        confirmLabel="Suspend school"
        onConfirm={suspendSchool}
      />
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
