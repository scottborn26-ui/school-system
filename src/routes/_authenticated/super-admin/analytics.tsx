import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Building2, GraduationCap, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricStrip, PlatformPage, fetchPlatformRows } from "@/components/platform-page";

export const Route = createFileRoute("/_authenticated/super-admin/analytics")({
  component: AnalyticsPage,
});
type School = {
  id: string;
  name: string;
  county: string | null;
  status: string;
  storage_used_mb: number;
};

function AnalyticsPage() {
  const schools = useQuery({
    queryKey: ["platform-analytics-schools"],
    queryFn: () => fetchPlatformRows<School>("schools", "id,name,county,status,storage_used_mb"),
  });
  const learners = useQuery({
    queryKey: ["platform-analytics-learners"],
    queryFn: () => fetchPlatformRows<{ id: string; school_id: string }>("learners", "id,school_id"),
  });
  const staff = useQuery({
    queryKey: ["platform-analytics-staff"],
    queryFn: () => fetchPlatformRows<{ id: string; school_id: string }>("staff", "id,school_id"),
  });
  const schoolRows = schools.data ?? [];
  const learnerRows = learners.data ?? [];
  const staffRows = staff.data ?? [];
  return (
    <PlatformPage
      eyebrow="Insights & platform"
      title="Reports and analytics"
      description="Track adoption, enrollment, staffing, storage, school activity, and tenant health from one global view."
    >
      <MetricStrip
        items={[
          {
            label: "Active schools",
            value: schoolRows.filter((s) => s.status === "active").length,
            icon: Building2,
          },
          {
            label: "Learners",
            value: learnerRows.length.toLocaleString(),
            icon: GraduationCap,
            tone: "blue",
          },
          { label: "Staff", value: staffRows.length.toLocaleString(), icon: Users, tone: "amber" },
          {
            label: "Storage used",
            value: `${schoolRows.reduce((sum, s) => sum + (s.storage_used_mb ?? 0), 0).toLocaleString()} MB`,
            icon: BarChart3,
            tone: "rose",
          },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>School usage snapshot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {schools.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading analytics...</p>
          ) : schools.error ? (
            <p className="py-8 text-center text-sm text-rose-600">
              Analytics data could not be loaded.
            </p>
          ) : schoolRows.length ? (
            schoolRows.map((school) => {
              const learnerCount = learnerRows.filter(
                (learner) => learner.school_id === school.id,
              ).length;
              const staffCount = staffRows.filter(
                (member) => member.school_id === school.id,
              ).length;
              return (
                <div
                  key={school.id}
                  className="flex flex-col gap-2 rounded-xl border border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold">{school.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {school.county ?? "County not set"} · {school.status}
                    </p>
                  </div>
                  <div className="flex gap-5 text-sm">
                    <span>
                      <b>{learnerCount}</b> learners
                    </span>
                    <span>
                      <b>{staffCount}</b> staff
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No schools available.</p>
          )}
        </CardContent>
      </Card>
    </PlatformPage>
  );
}
