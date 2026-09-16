import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Database, Gauge, RefreshCw, Server, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MetricStrip,
  PlatformPage,
  StatusBadge,
  fetchPlatformRows,
} from "@/components/platform-page";

export const Route = createFileRoute("/_authenticated/super-admin/system")({
  component: SystemHealthPage,
});
type Service = {
  id: string;
  service_name: string;
  status: string;
  uptime_percent: number;
  response_ms: number;
  last_incident_at: string | null;
};

function SystemHealthPage() {
  const query = useQuery({
    queryKey: ["platform-telemetry"],
    queryFn: () =>
      fetchPlatformRows<Service>(
        "platform_service_health",
        "id,service_name,status,uptime_percent,response_ms,last_incident_at",
      ),
  });
  const data = query.data ?? [];
  const average = data.length
    ? Math.round(data.reduce((sum, item) => sum + item.response_ms, 0) / data.length)
    : 0;
  const uptime = data.length
    ? (data.reduce((sum, item) => sum + item.uptime_percent, 0) / data.length).toFixed(2)
    : "-";
  return (
    <PlatformPage
      eyebrow="Observability & system"
      title="System telemetry"
      description="Monitor platform services, response health, and recent operational incidents."
      action={
        <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
          <RefreshCw className={query.isFetching ? "mr-2 size-4 animate-spin" : "mr-2 size-4"} />
          {query.isFetching ? "Refreshing..." : "Refresh telemetry"}
        </Button>
      }
    >
      <MetricStrip
        items={[
          { label: "API uptime", value: data.length ? `${uptime}%` : "-", icon: Gauge },
          {
            label: "Average response",
            value: data.length ? `${average}ms` : "-",
            icon: Activity,
            tone: "blue",
          },
          {
            label: "Healthy services",
            value: data.filter((item) => item.status === "operational").length,
            icon: ShieldCheck,
          },
          { label: "Services tracked", value: data.length, icon: Server, tone: "amber" },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-4 text-emerald-600" /> Service status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading telemetry...</p>
          ) : query.error ? (
            <div className="space-y-2 py-8 text-center">
              <p className="text-sm font-semibold text-rose-600">
                Telemetry data is not available.
              </p>
              <p className="text-xs text-muted-foreground">
                {query.error instanceof Error
                  ? query.error.message
                  : "Apply the platform health migration."}
              </p>
            </div>
          ) : data.length ? (
            <div className="divide-y divide-border/60">
              {data.map((service) => (
                <div
                  key={service.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold">{service.service_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {service.response_ms}ms response ·{" "}
                      {service.last_incident_at
                        ? `Last incident ${new Date(service.last_incident_at).toLocaleDateString()}`
                        : "No incidents recorded"}
                    </p>
                  </div>
                  <StatusBadge value={service.status} />
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No service health records yet.
            </p>
          )}
        </CardContent>
      </Card>
    </PlatformPage>
  );
}
