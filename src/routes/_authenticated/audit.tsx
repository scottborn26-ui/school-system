import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Trash2 } from "lucide-react";
import { useState } from "react";
import { RequireSchool } from "@/components/require-school";
import { DataTable, type Column } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useSchool } from "@/hooks/use-school";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({
    meta: [
      { title: "Audit logs · SHANSCOTT CBE" },
      {
        name: "description",
        content:
          "Immutable audit trail of every create, update and delete action performed in your school workspace.",
      },
      { property: "og:title", content: "Audit logs · SHANSCOTT CBE" },
      {
        property: "og:description",
        content: "Accountability trail of all changes made in your school workspace.",
      },
    ],
  }),
  component: () => (
    <RequireSchool roles={["principal", "super_admin"]}>
      <AuditPage />
    </RequireSchool>
  ),
});

interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  actor_name: string | null;
  reason: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_TONE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  create: "default",
  update: "secondary",
  delete: "destructive",
};

function AuditPage() {
  const school = useSchool();
  const schoolId = school.schoolId!;
  const queryClient = useQueryClient();
  const [action, setAction] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<AuditRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AuditRow | null>(null);
  const [deleteSelectedOpen, setDeleteSelectedOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["audit", schoolId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("audit_logs")
        .select("id, action, entity, entity_id, actor_name, reason, before_data, after_data, created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (rows ?? []) as AuditRow[];
    },
  });

  const rows = (data ?? []).filter((r) => action === "all" || r.action === action);
  const allRowsSelected = rows.length > 0 && selected.size === rows.length;

  const deleteLogs = useMutation({
    mutationFn: async (ids: string[]) => {
      const deletedIds: string[] = [];
      for (const id of ids) {
        const { data: deletedRows, error } = await supabase
          .from("audit_logs")
          .delete()
          .eq("school_id", schoolId)
          .eq("id", id)
          .select("id");
        if (error) throw error;
        if (deletedRows?.length) deletedIds.push(id);
      }
      if (!deletedIds.length) {
        throw new Error("No audit logs were deleted. Apply the audit log delete policy migration first.");
      }
      return { count: deletedIds.length, ids: deletedIds };
    },
    onSuccess: ({ count: deletedCount, ids: deletedIds }) => {
      setSelected(new Set());
      setDeleteTarget(null);
      setDeleteSelectedOpen(false);
      toast.success(`${deletedCount} audit log${deletedCount === 1 ? "" : "s"} deleted.`);
      queryClient.setQueryData<AuditRow[]>(["audit", schoolId], (current) =>
        (current ?? []).filter((row) => !deletedIds.includes(row.id)),
      );
      void queryClient.invalidateQueries({ queryKey: ["audit", schoolId] });
    },
    onError: (error: Error) => {
      toast.error("Audit logs could not be deleted.", { description: error.message });
    },
  });

  const columns: Column<AuditRow>[] = [
    {
      key: "created_at",
      header: "When",
      sortable: true,
      sortValue: (r) => r.created_at,
      cell: (r) => formatDateTime(r.created_at),
    },
    {
      key: "action",
      header: "Action",
      cell: (r) => (
        <Badge variant={ACTION_TONE[r.action] ?? "outline"} className="capitalize">
          {r.action}
        </Badge>
      ),
    },
    {
      key: "entity",
      header: "Record",
      sortable: true,
      sortValue: (r) => r.entity,
      cell: (r) => <span className="capitalize">{r.entity.replace(/_/g, " ")}</span>,
    },
    { key: "actor_name", header: "Performed by", cell: (r) => r.actor_name ?? "System" },
    {
      key: "actions",
      header: "Actions",
      className: "w-28",
      cell: (r) => (
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" title="View audit entry" aria-label="View audit entry" onClick={() => setViewing(r)}>
            <Eye className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" title="Delete audit entry" aria-label="Delete audit entry" onClick={() => setDeleteTarget(r)}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit logs</h1>
          <p className="text-sm text-muted-foreground">
            The 500 most recent actions in this school.
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          disabled={selected.size === 0 || deleteLogs.isPending}
          onClick={() => setDeleteSelectedOpen(true)}
        >
          <Trash2 className="size-4" />
          {allRowsSelected ? "Delete all" : "Delete selected"} ({selected.size})
        </Button>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        loading={isLoading}
        rowKey={(r) => r.id}
        selectable
        selectedKeys={selected}
        onSelectionChange={setSelected}
        searchPlaceholder="Search by record or person…"
        searchValue={(r) => `${r.entity} ${r.action} ${r.actor_name ?? ""}`}
        onReset={() => setAction("all")}
        emptyTitle="No audit entries yet"
        emptyDescription="Actions such as admitting learners or adding staff will be recorded here."
        filters={
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-[160px]" aria-label="Filter by action">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Audit entry details</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div><span className="text-muted-foreground">When</span><p className="font-medium">{formatDateTime(viewing.created_at)}</p></div>
                <div><span className="text-muted-foreground">Action</span><p className="font-medium capitalize">{viewing.action}</p></div>
                <div><span className="text-muted-foreground">Record</span><p className="font-medium capitalize">{viewing.entity.replace(/_/g, " ")}</p></div>
                <div><span className="text-muted-foreground">Performed by</span><p className="font-medium">{viewing.actor_name ?? "System"}</p></div>
              </div>
              <div><span className="text-muted-foreground">Reason</span><p className="mt-1 rounded-lg border bg-muted/30 p-3">{viewing.reason ?? "No reason recorded."}</p></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <JsonBlock label="Before" value={viewing.before_data} />
                <JsonBlock label="After" value={viewing.after_data} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete audit entry?</AlertDialogTitle><AlertDialogDescription>This permanently removes the selected audit entry.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteTarget && deleteLogs.mutate([deleteTarget.id])}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={deleteSelectedOpen} onOpenChange={setDeleteSelectedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{allRowsSelected ? "Delete all audit logs?" : "Delete selected audit entries?"}</AlertDialogTitle><AlertDialogDescription>This permanently removes {selected.size} audit entries.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteLogs.mutate([...selected])}>Delete selected</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: Record<string, unknown> | null }) {
  return <div><span className="text-muted-foreground">{label}</span><pre className="mt-1 max-h-48 overflow-auto rounded-lg border bg-slate-950 p-3 text-xs text-slate-100">{value ? JSON.stringify(value, null, 2) : "No data recorded."}</pre></div>;
}
