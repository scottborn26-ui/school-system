import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SuperAdminShell } from "@/components/super-admin-shell";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/super-admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw redirect({ to: "/auth" });
    const [{ data: role }, { data: admin }] = await Promise.all([
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", auth.user.id)
        .eq("role", "super_admin")
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("platform_admins" as never)
        .select("role")
        .eq("id", auth.user.id)
        .in("role", ["super_admin", "support_admin"])
        .maybeSingle(),
    ]);
    if (!role && !admin) throw redirect({ to: "/dashboard" });
  },
  component: () => (
    <SuperAdminShell>
      <Outlet />
    </SuperAdminShell>
  ),
});
