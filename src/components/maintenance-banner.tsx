import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { fetchPlatformRows } from "@/components/platform-page";

type MaintenanceSettings = {
  maintenance_enabled: boolean;
  maintenance_message: string;
  maintenance_starts_at: string | null;
  maintenance_ends_at: string | null;
};

export function MaintenanceBanner() {
  const { data } = useQuery({
    queryKey: ["platform-maintenance-banner"],
    queryFn: () =>
      fetchPlatformRows<MaintenanceSettings>(
        "platform_settings",
        "maintenance_enabled,maintenance_message,maintenance_starts_at,maintenance_ends_at",
      ),
    staleTime: 30_000,
    retry: false,
  });
  const settings = data?.[0];
  const now = Date.now();
  const startsAt = settings?.maintenance_starts_at
    ? new Date(settings.maintenance_starts_at).getTime()
    : null;
  const endsAt = settings?.maintenance_ends_at
    ? new Date(settings.maintenance_ends_at).getTime()
    : null;
  const active = Boolean(
    settings?.maintenance_enabled &&
    (startsAt === null || startsAt <= now) &&
    (endsAt === null || endsAt > now),
  );

  if (!active) return null;

  return (
    <div
      className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-7xl items-start gap-3 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p>
          <span className="font-semibold">Scheduled maintenance:</span>{" "}
          {settings.maintenance_message || "Some school services may be temporarily unavailable."}
        </p>
      </div>
    </div>
  );
}
