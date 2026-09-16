import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Mail, PlugZap, Server, ShieldCheck, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MetricStrip,
  PlatformPage,
  StatusBadge,
  fetchPlatformRows,
} from "@/components/platform-page";

export const Route = createFileRoute("/_authenticated/super-admin/integrations")({
  component: IntegrationsPage,
});
type Service = {
  id: string;
  service_name: string;
  status: string;
  uptime_percent: number;
  response_ms: number;
};
const EXPECTED = [
  { name: "M-Pesa", icon: Smartphone },
  { name: "Email delivery", icon: Mail },
  { name: "SMS provider", icon: Smartphone },
  { name: "Storage", icon: Server },
  { name: "Authentication", icon: ShieldCheck },
  { name: "Platform API", icon: PlugZap },
];

function IntegrationsPage() {
  const query = useQuery({
    queryKey: ["platform-integrations"],
    queryFn: () =>
      fetchPlatformRows<Service>(
        "platform_service_health",
        "id,service_name,status,uptime_percent,response_ms",
      ),
  });
  const serviceByName = new Map(
    (query.data ?? []).map((service) => [service.service_name.toLowerCase(), service]),
  );
  return (
    <PlatformPage
      eyebrow="Platform connectivity"
      title="Integrations"
      description="Monitor payment, communication, storage, identity, and API connections used by every school."
      action={<StatusBadge value={query.error ? "degraded" : "operational"} />}
    >
      <MetricStrip
        items={[
          {
            label: "Connected services",
            value: query.data?.filter((s) => s.status === "operational").length ?? "-",
            icon: Activity,
          },
          {
            label: "Tracked services",
            value: query.data?.length ?? "-",
            icon: Server,
            tone: "blue",
          },
          { label: "Integration scope", value: "Global", icon: PlugZap, tone: "amber" },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Connection status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {EXPECTED.map(({ name, icon: Icon }) => {
            const service = serviceByName.get(name.toLowerCase());
            return (
              <div
                key={name}
                className="flex items-center justify-between rounded-xl border border-border/70 p-4"
              >
                <div className="flex items-center gap-3">
                  <Icon className="size-5 text-emerald-600" />
                  <div>
                    <p className="font-semibold">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {service
                        ? `${service.response_ms}ms · ${service.uptime_percent}% uptime`
                        : "Awaiting health check"}
                    </p>
                  </div>
                </div>
                <StatusBadge value={service?.status ?? "not configured"} />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </PlatformPage>
  );
}
