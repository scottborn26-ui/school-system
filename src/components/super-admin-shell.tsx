import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BellRing,
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Settings2,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/super-admin", label: "Overview", icon: LayoutDashboard },
  { to: "/super-admin/schools", label: "Schools", icon: Building2 },
  { to: "/super-admin/billing", label: "Plans & billing", icon: CreditCard },
  { to: "/super-admin/admins", label: "Platform admins", icon: Users },
  { to: "/super-admin/audit-log", label: "Audit log", icon: ShieldCheck },
  { to: "/super-admin/announcements", label: "Announcements", icon: BellRing },
  { to: "/super-admin/support", label: "Support tickets", icon: Ticket },
  { to: "/super-admin/system", label: "System health", icon: Activity },
  { to: "/super-admin/settings", label: "Platform settings", icon: Settings2 },
];

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [collapsed, setCollapsed] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out successfully.");
    window.location.assign("/auth");
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <aside
        className={cn(
          "hidden shrink-0 border-r border-slate-800 bg-slate-950 text-slate-200 md:block",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="border-b border-slate-800 p-4">
            <div className="flex items-center gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-500 text-slate-950">
                <ShieldCheck className="size-5" />
              </div>
              {!collapsed && (
                <div>
                  <p className="font-semibold text-white">SHANSCOTT</p>
                  <p className="text-xs text-emerald-300">Platform Admin</p>
                </div>
              )}
            </div>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active =
                pathname === to || (to !== "/super-admin" && pathname.startsWith(`${to}/`));
              return (
                <Link
                  key={to}
                  to={to}
                  title={label}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    collapsed && "justify-center px-2",
                    active
                      ? "bg-emerald-500 font-semibold text-slate-950"
                      : "text-slate-300 hover:bg-slate-900 hover:text-white",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-slate-800 p-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-slate-300 hover:text-white"
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? <ChevronRight /> : <ChevronLeft />}
              {!collapsed && "Collapse"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-slate-300 hover:text-white"
              onClick={() => void signOut()}
            >
              <LogOut />
              {!collapsed && "Sign out"}
            </Button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 md:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">
              Platform control room
            </p>
            <h1 className="text-lg font-semibold">Super Admin</h1>
          </div>
          <Badge className="gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
            <ShieldCheck className="size-3" /> Platform owner
          </Badge>
        </header>
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
