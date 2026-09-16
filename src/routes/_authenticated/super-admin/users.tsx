import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, ShieldCheck, UsersRound } from "lucide-react";
import { useState } from "react";
import {
  DataTable,
  FilterBar,
  MetricStrip,
  PlatformPage,
  StatusBadge,
  fetchPlatformRows,
} from "@/components/platform-page";

export const Route = createFileRoute("/_authenticated/super-admin/users")({ component: UsersPage });
type Profile = { id: string; full_name: string; email: string | null; created_at: string };

function UsersPage() {
  const [search, setSearch] = useState("");
  const profiles = useQuery({
    queryKey: ["platform-profiles"],
    queryFn: () => fetchPlatformRows<Profile>("profiles", "id,full_name,email,created_at"),
  });
  const learners = useQuery({
    queryKey: ["platform-learners-count"],
    queryFn: () => fetchPlatformRows<{ id: string }>("learners", "id"),
  });
  const staff = useQuery({
    queryKey: ["platform-staff-count"],
    queryFn: () => fetchPlatformRows<{ id: string }>("staff", "id"),
  });
  const rows = (profiles.data ?? []).filter((profile) =>
    `${profile.full_name} ${profile.email ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <PlatformPage
      eyebrow="People & access"
      title="Users and learners"
      description="Global visibility across administrators, staff, learners, parents, and platform roles with tenant isolation enforced by RLS."
    >
      <MetricStrip
        items={[
          { label: "User profiles", value: profiles.data?.length ?? "-", icon: UsersRound },
          {
            label: "Learners",
            value: learners.data?.length ?? "-",
            icon: GraduationCap,
            tone: "blue",
          },
          {
            label: "Teachers & staff",
            value: staff.data?.length ?? "-",
            icon: ShieldCheck,
            tone: "amber",
          },
        ]}
      />
      <FilterBar value={search} onChange={setSearch} placeholder="Search name or email..." />
      <DataTable
        columns={["User", "Email", "Created", "Account scope", "Status"]}
        loading={profiles.isLoading}
        error={
          profiles.error
            ? "User data could not be loaded. Check the platform RLS migration."
            : undefined
        }
        empty="No users match this search."
      >
        {rows.length
          ? rows.map((profile) => (
              <tr key={profile.id} className="border-b border-border/60">
                <td className="px-4 py-4 font-semibold">{profile.full_name || "Unnamed user"}</td>
                <td className="px-4 py-4 text-sm text-muted-foreground">
                  {profile.email ?? "No email"}
                </td>
                <td className="px-4 py-4 text-sm text-muted-foreground">
                  {new Date(profile.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-4 text-sm">Platform profile</td>
                <td className="px-4 py-4">
                  <StatusBadge value="active" />
                </td>
              </tr>
            ))
          : undefined}
      </DataTable>
    </PlatformPage>
  );
}
