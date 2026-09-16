import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BellRing, Megaphone, Send } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/_authenticated/super-admin/announcements")({
  component: AnnouncementsPage,
});

type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: string;
  published_at: string | null;
  created_at: string;
};

function AnnouncementsPage() {
  const [search, setSearch] = useState("");
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["platform-announcements"],
    queryFn: () =>
      fetchPlatformRows<Announcement>(
        "platform_announcements",
        "id,title,body,audience,published_at,created_at",
      ),
  });
  const pending = data.filter((item) => !item.published_at);
  const rows = data.filter((item) =>
    `${item.title} ${item.body} ${item.audience}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <PlatformPage
      eyebrow="Governance & security"
      title="Announcements"
      description="Broadcast operational updates to schools, tenants, and platform administrators."
      action={<Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700"><Send /> Create announcement</Button>}
    >
      <MetricStrip items={[{ label: "Pending action", value: pending.length, detail: "Draft or scheduled", icon: BellRing, tone: pending.length ? "amber" : "emerald" }, { label: "Total broadcasts", value: data.length, icon: Megaphone, tone: "blue" }]} />
      <FilterBar value={search} onChange={setSearch} placeholder="Search announcement title or audience..." />
      <DataTable columns={["Announcement", "Audience", "Status", "Published", "Created", "Actions"]} loading={isLoading} error={error ? "Announcements could not be loaded." : undefined} empty="No announcements found.">
        {rows.length ? rows.map((item) => (
          <tr key={item.id} className="border-b border-border/60">
            <td className="max-w-[320px] px-4 py-4"><p className="truncate font-semibold">{item.title}</p><p className="truncate text-xs text-muted-foreground">{item.body}</p></td>
            <td className="px-4 py-4"><Badge variant="outline" className="capitalize">{item.audience.replaceAll("_", " ")}</Badge></td>
            <td className="px-4 py-4"><StatusBadge value={item.published_at ? "Sent" : "Draft"} /></td>
            <td className="px-4 py-4 text-sm text-muted-foreground">{item.published_at ? new Date(item.published_at).toLocaleString() : "Not sent"}</td>
            <td className="px-4 py-4 text-sm text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</td>
            <td className="px-4 py-4"><RowMenu items={[{ label: "Edit" }, { label: "Preview" }, { label: "Delete" }]} /></td>
          </tr>
        )) : undefined}
      </DataTable>
    </PlatformPage>
  );
}
