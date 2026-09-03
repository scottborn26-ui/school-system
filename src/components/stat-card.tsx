import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "info" | "destructive";
  className?: string;
}

const TONES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning-foreground",
  info: "bg-info/15 text-info",
  destructive: "bg-destructive/10 text-destructive",
};

/** Compact metric tile used across dashboards and register headers. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "surface-soft card-accent-academic flex items-start justify-between gap-3 p-4",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-2xl font-semibold tracking-tight">{value}</p>
        {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
      {Icon && (
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", TONES[tone])}>
          <Icon className="size-4" />
        </span>
      )}
    </div>
  );
}
