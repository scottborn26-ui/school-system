import type { LucideIcon } from "lucide-react";
import { MoreHorizontal, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

export async function fetchPlatformRows<T>(table: string, select = "*") {
  const result = await supabase.from(table as never).select(select).limit(200) as never as { data: T[] | null; error: Error | null };
  if (result.error) throw result.error;
  return result.data ?? [];
}

export function PlatformPage({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1540px] space-y-6 pb-10">
      <div className="flex flex-col gap-4 rounded-2xl border border-emerald-900/10 bg-white/80 p-5 shadow-sm backdrop-blur sm:flex-row sm:items-end sm:justify-between md:p-7 dark:border-emerald-500/10 dark:bg-slate-900/70">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function MetricStrip({ items }: { items: { label: string; value: ReactNode; detail?: string; icon: LucideIcon; tone?: string }[] }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{items.map(({ label, value, detail, icon: Icon, tone = "emerald" }) => <Card key={label} className="border-slate-200/80 bg-white/85 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"><CardContent className="flex items-center gap-3 p-4"><div className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone === "amber" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" : tone === "blue" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" : tone === "rose" ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300")}><Icon className="size-5" /></div><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-0.5 text-2xl font-black tabular-nums">{value}</p>{detail && <p className="truncate text-[11px] text-muted-foreground">{detail}</p>}</div></CardContent></Card>)}</div>;
}

export function FilterBar({ value, onChange, placeholder = "Search records...", children }: { value: string; onChange: (value: string) => void; placeholder?: string; children?: ReactNode }) {
  return <div className="flex flex-col gap-2 border-b border-border/70 pb-4 sm:flex-row sm:items-center"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-10 rounded-xl pl-9" /></div><div className="flex flex-wrap gap-2">{children}</div></div>;
}

export function StatusBadge({ value }: { value: string | null | undefined }) {
  const normalized = (value ?? "unknown").toLowerCase();
  const tone = normalized.includes("active") || normalized.includes("paid") || normalized.includes("operational") || normalized.includes("resolved") ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300" : normalized.includes("suspend") || normalized.includes("failed") || normalized.includes("urgent") || normalized.includes("overdue") ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300" : normalized.includes("pending") || normalized.includes("trial") || normalized.includes("progress") || normalized.includes("warning") ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300" : "border-border bg-muted text-muted-foreground";
  return <Badge variant="outline" className={cn("capitalize", tone)}>{value ?? "Unknown"}</Badge>;
}

export function DataTable({ columns, children, loading, empty, error }: { columns: string[]; children?: ReactNode; loading?: boolean; empty?: string; error?: string | undefined }) {
  return <Card className="overflow-hidden border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"><CardHeader className="border-b border-border/70 px-4 py-4"><CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Live database records</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow>{columns.map((column) => <TableHead key={column} className="whitespace-nowrap px-4 py-3 text-[10px] font-bold uppercase tracking-wider">{column}</TableHead>)}</TableRow></TableHeader><TableBody>{loading ? <TableRow><TableCell colSpan={columns.length} className="h-28 text-center text-sm text-muted-foreground">Loading database records...</TableCell></TableRow> : error ? <TableRow><TableCell colSpan={columns.length} className="h-28 text-center text-sm text-rose-600">{error}</TableCell></TableRow> : children ?? <TableRow><TableCell colSpan={columns.length} className="h-28 text-center text-sm text-muted-foreground">{empty ?? "No records found."}</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>;
}

export function RowMenu({ items }: { items: { label: string; onSelect?: () => void }[] }) {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8 rounded-lg"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{items.map((item) => <DropdownMenuItem key={item.label} onSelect={item.onSelect}>{item.label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>;
}

export function EmptyPanel({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return <div className="grid min-h-36 place-items-center rounded-xl border border-dashed border-border p-6 text-center"><Icon className="size-7 text-muted-foreground/50" /><p className="mt-2 text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>;
}
