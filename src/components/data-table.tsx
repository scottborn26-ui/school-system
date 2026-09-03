import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Loader2,
  RotateCcw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  loading?: boolean;
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  searchValue?: (row: T) => string;
  /** Extra filter controls rendered inside the icon-led filter bar. */
  filters?: ReactNode;
  onReset?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  toolbar?: ReactNode;
  groupBy?: (row: T) => string;
  groupLabel?: (key: string) => ReactNode;
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
}

export function DataTable<T>({
  rows,
  columns,
  loading,
  rowKey,
  searchPlaceholder = "Search…",
  searchValue,
  filters,
  onReset,
  emptyTitle = "Nothing here yet",
  emptyDescription = "Records will appear here once they are added.",
  emptyAction,
  toolbar,
  groupBy,
  groupLabel,
  selectable = false,
  selectedKeys = new Set(),
  onSelectionChange,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    let out = rows;
    if (query.trim() && searchValue) {
      const q = query.trim().toLowerCase();
      out = out.filter((r) => searchValue(r).toLowerCase().includes(q));
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col?.sortValue) {
        out = [...out].sort((a, b) => {
          const av = col.sortValue!(a);
          const bv = col.sortValue!(b);
          if (av === bv) return 0;
          if (av === null) return 1;
          if (bv === null) return -1;
          const res = av > bv ? 1 : -1;
          return sortDir === "asc" ? res : -res;
        });
      }
    }
    return out;
  }, [rows, query, searchValue, sortKey, sortDir, columns]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const paged = filtered.slice((current - 1) * pageSize, current * pageSize);
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((row) => selectedKeys.has(rowKey(row)));

  function toggleSelection(key: string) {
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange?.(next);
  }

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="space-y-4">
      <div className="surface-soft flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {searchValue && (
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={searchPlaceholder}
                className="pl-8"
                aria-label={searchPlaceholder}
              />
            </div>
          )}
          {filters}
          {(query || onReset) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setPage(1);
                onReset?.();
              }}
            >
              <RotateCcw className="size-4" /> Reset
            </Button>
          )}
        </div>
        {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm shadow-primary/5">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/45 hover:bg-muted/45">
                {selectable && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allFilteredSelected}
                      aria-label="Select all filtered records"
                      onCheckedChange={(checked) =>
                        onSelectionChange?.(
                          checked ? new Set(filtered.map((row) => rowKey(row))) : new Set(),
                        )
                      }
                    />
                  </TableHead>
                )}
                {columns.map((c) => (
                  <TableHead key={c.key} className={c.className}>
                    {c.sortable && c.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                      >
                        {c.header}
                        {sortKey === c.key ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="size-3.5" />
                          ) : (
                            <ArrowDown className="size-3.5" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3.5 opacity-50" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    {columns.map((c) => (
                      <TableCell key={c.key}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {!loading && paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length} className="py-12">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="rounded-full bg-muted p-3">
                        <Inbox className="size-6 text-muted-foreground" />
                      </div>
                      <p className="font-medium">{emptyTitle}</p>
                      <p className="max-w-sm text-sm text-muted-foreground">{emptyDescription}</p>
                      {emptyAction}
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!loading && groupBy && paged.length > 0
                ? Array.from(new Map(paged.map((row) => [groupBy(row), [] as T[]])).keys()).flatMap(
                    (key) => [
                      <TableRow key={`group-${key}`} className="bg-muted/35 hover:bg-muted/35">
                        <TableCell
                          colSpan={columns.length}
                          className="py-2.5 font-semibold text-foreground"
                        >
                          {groupLabel ? groupLabel(key) : key}
                        </TableCell>
                      </TableRow>,
                      ...paged
                        .filter((row) => groupBy(row) === key)
                        .map((row) => (
                          <TableRow
                            key={rowKey(row)}
                            className="transition-colors hover:bg-accent/45"
                          >
                            {columns.map((c) => (
                              <TableCell key={c.key} className={cn("align-middle", c.className)}>
                                {c.cell(row)}
                              </TableCell>
                            ))}
                          </TableRow>
                        )),
                    ],
                  )
                : !loading &&
                  paged.map((row) => (
                    <TableRow key={rowKey(row)} className="transition-colors hover:bg-accent/45">
                      {selectable && (
                        <TableCell className="w-12">
                          <Checkbox
                            checked={selectedKeys.has(rowKey(row))}
                            aria-label={`Select ${rowKey(row)}`}
                            onCheckedChange={() => toggleSelection(rowKey(row))}
                          />
                        </TableCell>
                      )}
                      {columns.map((c) => (
                        <TableCell key={c.key} className={cn("align-middle", c.className)}>
                          {c.cell(row)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" /> Loading…
            </span>
          ) : (
            <>
              {filtered.length} record{filtered.length === 1 ? "" : "s"} · page {current} of{" "}
              {pageCount}
            </>
          )}
        </p>
        <div className="flex items-center gap-2">
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[110px]" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={current >= pageCount}
            onClick={() => setPage(current + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
