import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  BellRing,
  Building2,
  Check,
  Database,
  Gauge,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { RequireSuperAdmin } from "@/components/require-super-admin";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/platform")({
  head: () => ({ meta: [{ title: "Platform control · SHANSCOTT CBE" }] }),
  component: () => (
    <RequireSuperAdmin>
      <PlatformPage />
    </RequireSuperAdmin>
  ),
});

const FEATURES = ["attendance", "billing", "exams", "library", "transport", "messaging"] as const;
type Feature = (typeof FEATURES)[number];
type School = {
  id: string;
  name: string;
  county: string | null;
  status: string;
  created_at: string;
};
type FeatureRow = { school_id: string; feature_key: Feature; is_enabled: boolean };
type Subscription = {
  school_id: string;
  plan: "basic" | "standard" | "premium";
  status: "trialing" | "active" | "past_due" | "cancelled";
  max_students: number;
  storage_limit_mb: number;
  renewal_date: string | null;
};
type AuditLog = {
  id: string;
  action: string;
  entity: string;
  created_at: string;
  school_id: string | null;
};

function PlatformPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: schools = [], isLoading } = useQuery({
    queryKey: ["platform-schools"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("id, name, county, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as School[];
    },
  });
  const { data: subscriptions = [] } = useQuery({
    queryKey: ["platform-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_subscriptions" as never)
        .select("school_id, plan, status, max_students, storage_limit_mb, renewal_date");
      if (error) throw error;
      return (data ?? []) as Subscription[];
    },
  });
  const { data: auditLogs = [] } = useQuery({
    queryKey: ["platform-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_audit_logs")
        .select("id, action, entity, created_at, school_id")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as AuditLog[];
    },
  });
  const { data: features = [] } = useQuery({
    queryKey: ["platform-features", selectedId],
    enabled: Boolean(selectedId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_features" as never)
        .select("school_id, feature_key, is_enabled")
        .eq("school_id", selectedId!);
      if (error) throw error;
      return (data ?? []) as FeatureRow[];
    },
  });

  const visibleSchools = schools.filter((school) =>
    `${school.name} ${school.county ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  const selected = schools.find((school) => school.id === selectedId) ?? null;
  const selectedSubscription = subscriptions.find((item) => item.school_id === selectedId);
  const activeSubscriptions = subscriptions.filter((item) => item.status === "active").length;
  const trialSubscriptions = subscriptions.filter((item) => item.status === "trialing").length;
  const visibleAuditLogs = useMemo(
    () =>
      auditLogs.map((log) => ({
        ...log,
        school: schools.find((school) => school.id === log.school_id)?.name,
      })),
    [auditLogs, schools],
  );
  const featureEnabled = (feature: Feature) =>
    features.find((row) => row.feature_key === feature)?.is_enabled ?? false;

  async function updateStatus(status: "active" | "suspended" | "archived") {
    if (!selected) return;
    const { error } = await supabase.from("schools").update({ status }).eq("id", selected.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${selected.name} marked ${status}.`);
    await queryClient.invalidateQueries({ queryKey: ["platform-schools"] });
  }

  async function toggleFeature(feature_key: Feature) {
    if (!selected) return;
    const is_enabled = !featureEnabled(feature_key);
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("platform_features" as never).upsert({
      school_id: selected.id,
      feature_key,
      is_enabled,
      updated_by: user.user?.id,
    } as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["platform-features", selected.id] });
  }

  async function updateSubscription(field: "plan" | "status", value: string) {
    if (!selected) return;
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("platform_subscriptions" as never).upsert({
      school_id: selected.id,
      [field]: value,
      updated_by: user.user?.id,
    } as never);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${selected.name} subscription updated.`);
    await queryClient.invalidateQueries({ queryKey: ["platform-subscriptions"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Platform operations</p>
          <h1 className="text-2xl font-semibold tracking-tight">Super Admin Console</h1>
          <p className="text-sm text-muted-foreground">
            Control tenant status, feature access, and platform accountability.
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <ShieldCheck className="size-3" /> Super Admin
        </Badge>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Registered schools</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{schools.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Gauge className="size-4" /> Paid plans
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{activeSubscriptions}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <BellRing className="size-4" /> Trials
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{trialSubscriptions}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="size-4" /> Audit events
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{auditLogs.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Active tenants</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {schools.filter((s) => s.status === "active").length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Suspended tenants</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {schools.filter((s) => s.status === "suspended").length}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-4" /> School accounts
            </CardTitle>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search schools or counties..."
              aria-label="Search schools"
            />
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading schools...</p>
            ) : (
              visibleSchools.map((school) => (
                <button
                  type="button"
                  key={school.id}
                  onClick={() => setSelectedId(school.id)}
                  className={`flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors ${selectedId === school.id ? "border-primary bg-primary/5" : "hover:bg-muted/60"}`}
                >
                  <span>
                    <span className="block font-medium">{school.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {school.county ?? "County not set"} ·{" "}
                      {subscriptions.find((item) => item.school_id === school.id)?.plan ??
                        "No plan"}
                    </span>
                  </span>
                  <Badge
                    variant={
                      school.status === "active"
                        ? "default"
                        : school.status === "suspended"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {school.status}
                  </Badge>
                </button>
              ))
            )}
            {!isLoading && visibleSchools.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No schools match this search.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{selected?.name ?? "Select a school"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {selected ? (
              <>
                <Select
                  value={selected.status}
                  onValueChange={(value) =>
                    void updateStatus(value as "active" | "suspended" | "archived")
                  }
                >
                  <SelectTrigger aria-label="School status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm font-medium">
                    Subscription plan
                    <Select
                      value={selectedSubscription?.plan ?? "basic"}
                      onValueChange={(value) => void updateSubscription("plan", value)}
                    >
                      <SelectTrigger aria-label="Subscription plan">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="space-y-1 text-sm font-medium">
                    Billing status
                    <Select
                      value={selectedSubscription?.status ?? "trialing"}
                      onValueChange={(value) => void updateSubscription("status", value)}
                    >
                      <SelectTrigger aria-label="Billing status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trialing">Trial</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="past_due">Past due</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Student limit</p>
                    <p className="font-semibold">
                      {selectedSubscription?.max_students ?? "Not configured"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Storage cap</p>
                    <p className="font-semibold">
                      {selectedSubscription
                        ? `${Math.round(selectedSubscription.storage_limit_mb / 1024)} GB`
                        : "Not configured"}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Feature access</p>
                  <div className="space-y-2">
                    {FEATURES.map((feature) => (
                      <button
                        type="button"
                        key={feature}
                        onClick={() => void toggleFeature(feature)}
                        className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm capitalize hover:bg-muted/60"
                      >
                        <span>{feature}</span>
                        {featureEnabled(feature) ? (
                          <Check className="size-4 text-emerald-600" />
                        ) : (
                          <X className="size-4 text-muted-foreground" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Choose a tenant to manage status and module access.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="size-4" /> Platform activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleAuditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No platform events recorded yet.</p>
            ) : (
              visibleAuditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between gap-3 border-b py-2 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {log.action} {log.entity}
                    </p>
                    <p className="text-xs text-muted-foreground">{log.school ?? "Platform-wide"}</p>
                  </div>
                  <time className="text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleDateString()}
                  </time>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4" /> Admin operations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Tenant access, subscriptions, modules, and audit accountability are managed from this
              console.
            </p>
            <p className="rounded-md bg-muted/50 p-3">
              User provisioning, impersonation, exports, and billing invoices require a server-side
              admin function before they can be enabled.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
