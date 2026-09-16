import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Archive, Database, Download, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MetricStrip,
  PlatformPage,
  StatusBadge,
  fetchPlatformRows,
} from "@/components/platform-page";

export const Route = createFileRoute("/_authenticated/super-admin/data")({
  component: DataManagementPage,
});
type School = { id: string; name: string; storage_used_mb: number };
type Feature = { school_id: string; feature_key: string; is_enabled: boolean };

function DataManagementPage() {
  const schools = useQuery({
    queryKey: ["platform-data-schools"],
    queryFn: () => fetchPlatformRows<School>("schools", "id,name,storage_used_mb"),
  });
  const features = useQuery({
    queryKey: ["platform-data-features"],
    queryFn: () =>
      fetchPlatformRows<Feature>("platform_features", "school_id,feature_key,is_enabled"),
  });
  const storage = (schools.data ?? []).reduce(
    (sum, school) => sum + (school.storage_used_mb ?? 0),
    0,
  );
  return (
    <PlatformPage
      eyebrow="Data management"
      title="Data, exports, and backups"
      description="Govern controlled exports, imports, archived records, feature flags, and tenant storage from the platform level."
      action={
        <Button variant="outline" disabled>
          <Download className="mr-2 size-4" /> Export center
        </Button>
      }
    >
      <MetricStrip
        items={[
          { label: "Tenant records", value: schools.data?.length ?? "-", icon: Database },
          {
            label: "Storage used",
            value: `${storage.toLocaleString()} MB`,
            icon: HardDrive,
            tone: "blue",
          },
          {
            label: "Feature controls",
            value: features.data?.length ?? "-",
            icon: Archive,
            tone: "amber",
          },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Tenant storage and controls</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border/60">
          {schools.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading data inventory...
            </p>
          ) : schools.error ? (
            <p className="py-8 text-center text-sm text-rose-600">
              Data inventory could not be loaded.
            </p>
          ) : (
            (schools.data ?? []).map((school) => (
              <div
                key={school.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">{school.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {school.storage_used_mb.toLocaleString()} MB used · soft-delete and archive
                    preferred
                  </p>
                </div>
                <StatusBadge value="protected" />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </PlatformPage>
  );
}
