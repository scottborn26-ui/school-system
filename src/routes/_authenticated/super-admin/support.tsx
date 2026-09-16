import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LifeBuoy, Ticket, Timer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  FilterBar,
  MetricStrip,
  PlatformPage,
  RowMenu,
  StatusBadge,
  fetchPlatformRows,
} from "@/components/platform-page";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/super-admin/support")({
  component: SupportPage,
});
type TicketRow = {
  id: string;
  tenant_id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  resolved_at: string | null;
};

function SupportPage() {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["platform-support"],
    queryFn: () =>
      fetchPlatformRows<TicketRow>(
        "support_tickets",
        "id,tenant_id,subject,status,priority,created_at,resolved_at",
      ),
  });
  const rows = data.filter((item) =>
    `${item.subject} ${item.tenant_id} ${item.status} ${item.priority}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const open = data.filter((item) => item.status !== "resolved");
  const updateStatus = async (ticket: TicketRow, status: "open" | "in_progress" | "resolved") => {
    const resolvedAt = status === "resolved" ? new Date().toISOString() : null;
    const { error: updateError } = await supabase
      .from("support_tickets" as never)
      .update({ status, resolved_at: resolvedAt })
      .eq("id", ticket.id);
    if (updateError) toast.error(updateError.message);
    else {
      toast.success(status === "resolved" ? "Ticket resolved." : "Ticket reopened.");
      void client.invalidateQueries({ queryKey: ["platform-support"] });
      void client.invalidateQueries({ queryKey: ["super-admin-sidebar-support"] });
    }
  };

  return (
    <PlatformPage
      eyebrow="Observability & system"
      title="Support queue"
      description="Triage requests from school administrators with clear priority and SLA visibility."
      action={
        <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
          <LifeBuoy /> New ticket
        </Button>
      }
    >
      <MetricStrip
        items={[
          { label: "Open queue", value: open.length, icon: Ticket },
          {
            label: "Urgent",
            value: open.filter((item) => item.priority === "urgent").length,
            detail: "Requires immediate action",
            icon: Timer,
            tone: open.some((item) => item.priority === "urgent") ? "rose" : "emerald",
          },
          {
            label: "Resolved",
            value: data.filter((item) => item.status === "resolved").length,
            icon: LifeBuoy,
            tone: "blue",
          },
        ]}
      />
      <FilterBar
        value={search}
        onChange={setSearch}
        placeholder="Search tickets, tenant IDs, or priority..."
      />
      <DataTable
        columns={["Ticket", "Tenant", "Priority", "Status", "Age", "Actions"]}
        loading={isLoading}
        error={error ? "Support tickets could not be loaded." : undefined}
        empty="No support tickets found."
      >
        {rows.length
          ? rows.map((item) => (
              <tr key={item.id} className="border-b border-border/60">
                <td className="max-w-[340px] px-4 py-4">
                  <p className="truncate font-semibold">{item.subject}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {item.id.slice(0, 14)}...
                  </p>
                </td>
                <td className="px-4 py-4 font-mono text-xs">{item.tenant_id.slice(0, 12)}...</td>
                <td className="px-4 py-4">
                  <StatusBadge value={item.priority} />
                </td>
                <td className="px-4 py-4">
                  <StatusBadge value={item.status.replaceAll("_", " ")} />
                </td>
                <td className="px-4 py-4 text-xs text-muted-foreground">
                  {Math.max(
                    0,
                    Math.floor((Date.now() - new Date(item.created_at).getTime()) / 86400000),
                  )}
                  d
                </td>
                <td className="px-4 py-4">
                  <RowMenu
                    items={
                      item.status === "resolved"
                        ? [
                            {
                              label: "Reopen ticket",
                              onSelect: () => void updateStatus(item, "open"),
                            },
                          ]
                        : [
                            {
                              label: "Mark in progress",
                              onSelect: () => void updateStatus(item, "in_progress"),
                            },
                            {
                              label: "Resolve ticket",
                              onSelect: () => void updateStatus(item, "resolved"),
                            },
                          ]
                    }
                  />
                </td>
              </tr>
            ))
          : undefined}
      </DataTable>
    </PlatformPage>
  );
}
