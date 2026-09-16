import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Activity,
  ArrowRight,
  BellRing,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CreditCard,
  ExternalLink,
  Layers,
  LifeBuoy,
  Megaphone,
  Plus,
  Radio,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/super-admin/")({
  head: () => ({ meta: [{ title: "Platform Command Overview · SHANSCOTT" }] }),
  component: SuperAdminDashboard,
});

type GrowthRange = "recent" | "30d" | "90d" | "all";
type Subscription = { school_id: string; plan: string; status: string; max_students: number };
type ServiceHealth = { service_name: string; status: string; uptime_percent: number };

const GROWTH_OPTIONS: { value: GrowthRange; label: string }[] = [
  { value: "recent", label: "Recent Signups" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "all", label: "All Time" },
];

function SuperAdminDashboard() {
  const queryClient = useQueryClient();
  const [growthRange, setGrowthRange] = useState<GrowthRange>("recent");

  const {
    data: schools = [],
    isLoading: schoolsLoading,
    isError: schoolsError,
  } = useQuery({
    queryKey: ["super-admin-dashboard-schools"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("id, name, slug, county, curriculum_type, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const {
    data: services = [],
    isLoading: servicesLoading,
    error: servicesQueryError,
  } = useQuery({
    queryKey: ["super-admin-dashboard-service-health"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_service_health" as never)
        .select("service_name,status,uptime_percent");
      if (error) throw error;
      return (data ?? []) as ServiceHealth[];
    },
  });

  const {
    data: learners = 0,
    isLoading: learnersLoading,
    isError: learnersError,
  } = useQuery({
    queryKey: ["super-admin-dashboard-learners"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("learners")
        .select("id", { count: "exact", head: true })
        .eq("is_archived", false);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: subscriptions = [], error: subscriptionsQueryError } = useQuery({
    queryKey: ["super-admin-dashboard-subscriptions"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_subscriptions" as never)
        .select("school_id, plan, status, max_students");
      if (error) throw error;
      return (data ?? []) as Subscription[];
    },
  });

  const {
    data: activity = [],
    isLoading: activityLoading,
    error: activityQueryError,
  } = useQuery({
    queryKey: ["super-admin-dashboard-activity"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_audit_logs")
        .select("id, action, entity, school_id, created_at")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: schoolMetrics = {}, isLoading: metricsLoading } = useQuery({
    queryKey: ["super-admin-dashboard-school-metrics", schools.map((school) => school.id)],
    enabled: schools.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        schools.map(async (school) => {
          const { count, error } = await supabase
            .from("learners")
            .select("id", { count: "exact", head: true })
            .eq("school_id", school.id)
            .eq("is_archived", false);
          if (error) throw error;
          return [school.id, count ?? 0] as const;
        }),
      );
      return Object.fromEntries(results) as Record<string, number>;
    },
  });

  const active = schools.filter((school) => school.status === "active").length;
  const activeSubscriptions = subscriptions.filter((item) => item.status === "active").length;
  const suspended = schools.filter((school) => school.status === "suspended").length;
  const needsAttention =
    schools.filter((school) => school.status === "suspended").length +
    subscriptions.filter((item) => item.status === "past_due" || item.status === "trialing").length;
  const recent = schools.slice(0, 5);
  const growthData = buildGrowthData(schools, growthRange);

  const planMix = ["basic", "standard", "premium"].map((plan) => ({
    plan,
    count: subscriptions.filter((sub) => sub.plan === plan).length,
  }));

  const topTenants = [...schools]
    .sort((a, b) => (schoolMetrics[b.id] ?? 0) - (schoolMetrics[a.id] ?? 0))
    .slice(0, 4);

  const todayDateFormatted = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const platformDataError = schoolsError || learnersError;
  const optionalDataErrors = [
    subscriptionsQueryError,
    activityQueryError,
    servicesQueryError,
  ].filter((error): error is Error => error instanceof Error);

  return (
    <div className="mx-auto max-w-[1540px] space-y-8 pb-12">
      {platformDataError && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            Core platform data could not be loaded. Refresh this page after applying the latest
            Supabase migrations.
          </p>
        </div>
      )}
      {optionalDataErrors.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            Some optional platform panels are unavailable:{" "}
            {optionalDataErrors.map((error) => error.message).join(" ")}
          </p>
        </div>
      )}
      {/* Executive Command Hero Banner */}
      <div className="relative overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-[linear-gradient(135deg,#0c2822_0%,#091e19_45%,#04100d_100%)] p-6 text-white shadow-[0_20px_50px_rgba(4,20,16,0.35)] md:p-8">
        <div className="pointer-events-none absolute -right-12 -top-20 size-80 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-40 size-72 rounded-full bg-teal-400/5 blur-2xl" />
        <div className="pointer-events-none absolute left-1/3 top-0 h-full w-px bg-gradient-to-b from-transparent via-emerald-500/15 to-transparent" />

        <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-300">
                <Radio className="size-3 animate-pulse text-emerald-400" /> Platform Command Center
              </span>
              <span className="text-xs text-emerald-200/60 font-medium">{todayDateFormatted}</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl md:text-4xl">
              Cross-Tenant Operations
            </h2>
            <p className="max-w-2xl text-xs sm:text-sm text-emerald-100/70">
              Manage school tenants, curriculum delivery, capacity allocation, and system governance
              across all Kenyan CBE partner institutions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void queryClient.invalidateQueries({ queryKey: ["super-admin-dashboard"] })
              }
              className="gap-2 rounded-xl border-emerald-500/30 bg-white/5 text-emerald-100 backdrop-blur hover:bg-white/10 hover:text-white"
            >
              <RefreshCw className="size-4" /> Refresh
            </Button>
            <Button
              asChild
              className="gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 font-bold text-[#071914] shadow-[0_4px_20px_rgba(52,211,153,0.35)] hover:from-emerald-300 hover:to-teal-300"
            >
              <Link to="/super-admin/schools/new">
                <Plus className="size-4" /> Onboard School
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="gap-2 rounded-xl border-emerald-500/30 bg-white/5 text-emerald-100 backdrop-blur hover:bg-white/10 hover:text-white"
            >
              <Link to="/super-admin/announcements">
                <Megaphone className="size-4" /> Broadcast
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          to="/super-admin/schools"
          icon={Building2}
          label="Total School Tenants"
          value={schoolsLoading ? "..." : schools.length}
          detail={`${active} active · ${suspended} suspended`}
          trend={schools.length > 0 ? "+100% active" : "No schools"}
          tone="emerald"
          spark={[1, 2, 3, 4, schools.length || 1]}
        />
        <MetricCard
          to="/super-admin/schools"
          icon={Users}
          label="Total Enrolled Learners"
          value={learnersLoading ? "..." : learners.toLocaleString()}
          detail="Across all registered tenants"
          trend="Live database count"
          tone="blue"
          spark={[10, 25, 40, 80, learners || 1]}
        />
        <MetricCard
          to="/super-admin/billing"
          icon={CreditCard}
          label="Active Subscriptions"
          value={activeSubscriptions}
          detail="Enabled platform access"
          trend={`${Math.round((activeSubscriptions / Math.max(schools.length, 1)) * 100)}% coverage`}
          tone="violet"
          spark={[1, 1, 2, 3, active || 1]}
        />
        <MetricCard
          to="/super-admin/schools"
          icon={CircleAlert}
          label="Needs Attention"
          value={needsAttention}
          detail={needsAttention > 0 ? "Payment, trial, or access issues" : "All schools clear"}
          trend={needsAttention > 0 ? "Action required" : "Zero blockages"}
          tone={needsAttention > 0 ? "rose" : "emerald"}
          spark={[0, 0, 0, needsAttention]}
          alert={needsAttention > 0}
        />
      </div>

      {/* School Growth & Recent Activity Section */}
      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
        {/* Growth Analytics Chart */}
        <Card className="border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900/90">
          <CardHeader className="flex-col gap-4 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
            <div>
              <CardTitle className="text-base font-bold sm:text-lg">
                School Registration Velocity
              </CardTitle>
              <CardDescription className="text-xs">
                Timeline of new school tenant onboardings over time
              </CardDescription>
            </div>
            <div className="flex flex-wrap rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {GROWTH_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setGrowthRange(option.value)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                    growthRange === option.value
                      ? "bg-white text-emerald-800 shadow-sm dark:bg-slate-700 dark:text-emerald-300"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {schoolsLoading ? (
              <Skeleton className="h-[290px] w-full rounded-2xl" />
            ) : schoolsError ? (
              <WidgetError text="Registration data could not be loaded." />
            ) : growthData.length === 0 ? (
              <EmptyState icon={Building2} text="No school tenant registration records yet." />
            ) : (
              <div className="h-[290px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={growthData}
                    margin={{ top: 10, right: 12, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="emeraldGrowthFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      stroke="#f1f5f9"
                      strokeDasharray="4 4"
                      className="dark:stroke-slate-800"
                    />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                    />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 14,
                        border: "1px solid rgba(16,185,129,0.2)",
                        backgroundColor: "#0c2620",
                        color: "#fff",
                        boxShadow: "0 12px 35px rgba(0,0,0,0.3)",
                      }}
                      labelStyle={{ color: "#34d399", fontWeight: 800, fontSize: "12px" }}
                      formatter={(val: number) => [`${val} Total`, "Registrations"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#10b981"
                      strokeWidth={3}
                      fill="url(#emeraldGrowthFill)"
                      dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
                      activeDot={{ r: 6, fill: "#059669" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Onboardings List */}
        <Card className="border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900/90">
          <CardHeader className="flex-row items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <CardTitle className="text-base font-bold">Recent Signups</CardTitle>
              <CardDescription className="text-xs">Latest registered schools</CardDescription>
            </div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="gap-1 text-xs text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
            >
              <Link to="/super-admin/schools">
                View All <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {schoolsError ? (
              <WidgetError text="Recent signups could not be loaded." />
            ) : recent.length === 0 ? (
              <EmptyState icon={Building2} text="No schools registered yet." />
            ) : (
              recent.map((school) => {
                const subPlan =
                  subscriptions.find((s) => s.school_id === school.id)?.plan ?? "basic";
                return (
                  <Link
                    key={school.id}
                    to="/super-admin/schools/$schoolId"
                    params={{ schoolId: school.id }}
                    className="group flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-2.5 transition-all hover:border-emerald-200 hover:bg-emerald-50/40 dark:border-slate-800 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <SchoolAvatar name={school.name} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-800 group-hover:text-emerald-700 dark:text-slate-100 dark:group-hover:text-emerald-400">
                          {school.name}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {school.slug
                            ? `${school.slug}.shanscott.com`
                            : (school.county ?? "Subdomain pending")}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        variant="outline"
                        className="hidden text-[10px] font-semibold capitalize sm:inline-flex"
                      >
                        {subPlan}
                      </Badge>
                      <Badge
                        className={
                          school.status === "active"
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-800 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-300"
                        }
                      >
                        {school.status}
                      </Badge>
                      <ChevronRight className="size-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Subscription Distribution Grid */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Quick Actions Panel */}
        <Card className="border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900/90">
          <CardHeader className="border-b border-slate-100 pb-4 dark:border-slate-800">
            <CardTitle className="text-base font-bold">Platform Quick Actions</CardTitle>
            <CardDescription className="text-xs">
              Direct shortcuts to high-frequency administrative workflows
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 pt-4 sm:grid-cols-2">
            <ActionShortcut
              to="/super-admin/schools/new"
              icon={Building2}
              title="Onboard New School"
              description="Register new partner tenant & admin"
              tone="emerald"
            />
            <ActionShortcut
              to="/super-admin/admins"
              icon={UserPlus}
              title="Invite Platform Admin"
              description="Grant support or super-admin role"
              tone="blue"
            />
            <ActionShortcut
              to="/super-admin/announcements"
              icon={Megaphone}
              title="Broadcast Announcement"
              description="Publish notification to school leaders"
              tone="violet"
            />
            <ActionShortcut
              to="/super-admin/support"
              icon={LifeBuoy}
              title="View Support Queue"
              description="Resolve incoming tenant inquiries"
              tone="amber"
            />
          </CardContent>
        </Card>

        {/* Subscription Plan Distribution */}
        <Card className="border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900/90">
          <CardHeader className="flex-row items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <CardTitle className="text-base font-bold">Subscription Plan Mix</CardTitle>
              <CardDescription className="text-xs">
                Active tier distribution across schools
              </CardDescription>
            </div>
            <CreditCard className="size-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            {planMix.every((item) => item.count === 0) ? (
              <EmptyState
                icon={CreditCard}
                text="Subscription plans will populate here as schools activate."
              />
            ) : (
              planMix.map((item) => {
                const total = subscriptions.length || 1;
                const percentage = Math.round((item.count / total) * 100);
                const color =
                  item.plan === "premium"
                    ? "bg-violet-500"
                    : item.plan === "standard"
                      ? "bg-blue-500"
                      : "bg-emerald-500";
                return (
                  <div key={item.plan} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="capitalize text-slate-800 dark:text-slate-200">
                        {item.plan} Plan
                      </span>
                      <span className="tabular-nums text-slate-500 dark:text-slate-400">
                        {item.count} tenants ({percentage}%)
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${color}`}
                        style={{ width: `${Math.max(4, percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tenant Capacity & Platform Audit Stream */}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        {/* Tenant Capacity Utilization */}
        <Card className="border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900/90">
          <CardHeader className="flex-row items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <CardTitle className="text-base font-bold">Tenant Capacity Health</CardTitle>
              <CardDescription className="text-xs">
                Active student enrollment vs provisioned quota limit
              </CardDescription>
            </div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="gap-1 text-xs text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
            >
              <Link to="/super-admin/schools">
                View All <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3.5 pt-4">
            {metricsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            ) : topTenants.length === 0 ? (
              <EmptyState
                icon={Users}
                text="Capacity statistics will display as schools enrol students."
              />
            ) : (
              topTenants.map((school) => {
                const maxCap =
                  subscriptions.find((item) => item.school_id === school.id)?.max_students ?? 250;
                const count = schoolMetrics[school.id] ?? 0;
                const percentage = Math.min(100, Math.round((count / maxCap) * 100));
                const isHigh = percentage >= 85;
                return (
                  <Link
                    key={school.id}
                    to="/super-admin/schools/$schoolId"
                    params={{ schoolId: school.id }}
                    className="group block rounded-xl border border-slate-100 p-3 transition-all hover:border-emerald-200 hover:bg-emerald-50/30 dark:border-slate-800 dark:hover:border-emerald-900/60 dark:hover:bg-emerald-950/20"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 group-hover:text-emerald-700 dark:text-slate-200 dark:group-hover:text-emerald-400">
                        {school.name}
                      </span>
                      <span className="tabular-nums font-semibold text-slate-500 dark:text-slate-400">
                        {count.toLocaleString()} / {maxCap.toLocaleString()} students ({percentage}
                        %)
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isHigh ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.max(2, percentage)}%` }}
                      />
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Live Platform Activity & System Telemetry Card */}
        <div className="space-y-6">
          <Card className="border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900/90">
            <CardHeader className="flex-row items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <CardTitle className="text-base font-bold">Platform Activity Stream</CardTitle>
                <CardDescription className="text-xs">
                  Real-time administrative events
                </CardDescription>
              </div>
              <Activity className="size-4 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {activityLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-9 w-full rounded-lg" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
              ) : activity.length === 0 ? (
                <EmptyState icon={Activity} text="No administrative events recorded recently." />
              ) : (
                activity.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 rounded-lg p-1.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                      <Activity className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {event.action}{" "}
                        <span className="font-normal text-slate-500 dark:text-slate-400">
                          {event.entity}
                        </span>
                      </p>
                      <p className="text-[10px] text-slate-400">{relativeTime(event.created_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* System Telemetry Link Card */}
          <Link
            to="/super-admin/system"
            className="group flex items-center gap-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-50 to-teal-50/50 p-5 transition-all hover:border-emerald-400 hover:shadow-md dark:from-emerald-950/40 dark:to-teal-950/20 dark:hover:border-emerald-500/60"
          >
            <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
              {servicesLoading ? (
                <RefreshCw className="size-6 animate-spin" />
              ) : (
                <CheckCircle2 className="size-6" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-emerald-950 dark:text-emerald-100">
                  System Health:{" "}
                  {services.length
                    ? `${(services.reduce((sum, item) => sum + item.uptime_percent, 0) / services.length).toFixed(2)}%`
                    : "Unavailable"}
                </span>
                <span
                  className={`size-2 rounded-full animate-pulse ${services.some((item) => item.status !== "operational") ? "bg-amber-500" : "bg-emerald-500"}`}
                />
              </div>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
                {services.length
                  ? services
                      .slice(0, 3)
                      .map((item) => `${item.service_name}: ${item.status}`)
                      .join(" · ")
                  : "Health records are not available."}
              </p>
            </div>
            <ArrowRight className="size-4 text-emerald-700 transition-transform group-hover:translate-x-1 dark:text-emerald-400" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  trend,
  spark,
  tone,
  to,
  alert,
}: {
  icon: typeof Building2;
  label: string;
  value: string | number;
  detail: string;
  trend: string;
  spark: number[];
  tone: "emerald" | "blue" | "violet" | "rose";
  to: string;
  alert?: boolean;
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300",
    violet: "bg-violet-50 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300",
  };

  return (
    <Link
      to={to}
      className={`group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.03)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)] dark:bg-slate-900/90 ${
        alert
          ? "border-rose-300 dark:border-rose-800"
          : "border-slate-200/80 hover:border-emerald-300 dark:border-slate-800 dark:hover:border-emerald-800"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <div
          className={`grid size-10 place-items-center rounded-xl transition-transform group-hover:scale-105 ${tones[tone]}`}
        >
          <Icon className="size-5" />
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-black tracking-tight text-slate-900 dark:text-white tabular-nums">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">{detail}</p>
        </div>
        <Sparkline values={spark} tone={tone} />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
        <span
          className={`font-bold ${
            tone === "rose"
              ? "text-rose-600 dark:text-rose-400"
              : "text-emerald-700 dark:text-emerald-400"
          }`}
        >
          {trend}
        </span>
        <span className="flex items-center gap-1 font-semibold text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-500">
          Inspect <ArrowRight className="size-3" />
        </span>
      </div>
    </Link>
  );
}

function Sparkline({ values, tone }: { values: number[]; tone: string }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const points = values
    .map(
      (value, index) =>
        `${(index / Math.max(values.length - 1, 1)) * 64},${22 - ((value - min) / Math.max(max - min, 1)) * 18}`,
    )
    .join(" ");

  const color =
    tone === "rose" ? "text-rose-500" : tone === "blue" ? "text-blue-500" : "text-emerald-500";

  return (
    <svg viewBox="0 0 64 24" className={`h-8 w-20 ${color}`} aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SchoolAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#0c2620] to-[#071612] text-xs font-black text-emerald-300 shadow-sm ring-1 ring-emerald-500/30">
      {initials}
    </div>
  );
}

function ActionShortcut({
  to,
  icon: Icon,
  title,
  description,
  tone,
}: {
  to: string;
  icon: typeof Building2;
  title: string;
  description: string;
  tone: "emerald" | "blue" | "violet" | "amber";
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
    violet: "bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  };

  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-2xl border border-slate-200/80 p-3.5 transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50/20 hover:shadow-sm dark:border-slate-800 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20"
    >
      <div
        className={`grid size-10 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-105 ${tones[tone]}`}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400">
          {title}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <ArrowRight className="size-3.5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof Building2; text: string }) {
  return (
    <div className="grid min-h-32 place-items-center rounded-2xl border border-dashed border-slate-200 p-6 text-center dark:border-slate-800">
      <Icon className="size-7 text-slate-300 dark:text-slate-600" />
      <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{text}</p>
    </div>
  );
}

function WidgetError({ text }: { text: string }) {
  return (
    <div className="grid min-h-32 place-items-center rounded-2xl border border-dashed border-rose-200 p-6 text-center dark:border-rose-900">
      <CircleAlert className="size-6 text-rose-500" />
      <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">{text}</p>
    </div>
  );
}

function relativeTime(value: string) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  return minutes < 60
    ? `${minutes}m ago`
    : minutes < 1440
      ? `${Math.floor(minutes / 60)}h ago`
      : `${Math.floor(minutes / 1440)}d ago`;
}

function buildGrowthData(schools: { created_at: string }[], range: GrowthRange) {
  const sorted = [...schools].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  if (range === "recent") {
    return sorted.slice(-6).map((school, index, list) => ({
      label: new Date(school.created_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      count: sorted.length - list.length + index + 1,
    }));
  }

  const days = range === "30d" ? 30 : range === "90d" ? 90 : null;
  const cutoff = days ? Date.now() - days * 86400000 : 0;
  const filtered = sorted.filter((school) => new Date(school.created_at).getTime() >= cutoff);
  const groups = new Map<string, number>();

  for (const school of filtered) {
    const date = new Date(school.created_at);
    const key =
      days && days <= 90
        ? date.toISOString().slice(0, 10)
        : `${date.getFullYear()}-${date.getMonth() + 1}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }

  return [...groups.entries()].map(([key, count]) => ({
    label:
      days && days <= 90
        ? new Date(`${key}T12:00:00`).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })
        : key,
    count,
  }));
}
