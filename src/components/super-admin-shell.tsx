import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  BellRing,
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  Database,
  GraduationCap,
  PlugZap,
  Radio,
  Settings2,
  ShieldCheck,
  Ticket,
  Users,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSchool } from "@/hooks/use-school";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  count?: number;
  badgeTone?: "emerald" | "amber" | "rose";
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Core Operations",
    items: [
      { to: "/super-admin", label: "Overview", icon: LayoutDashboard },
      { to: "/super-admin/schools", label: "School Tenants", icon: Building2 },
      { to: "/super-admin/users", label: "Users & Learners", icon: Users },
      { to: "/super-admin/academics", label: "Academics & CBC", icon: GraduationCap },
      { to: "/super-admin/billing", label: "Plans & Billing", icon: CreditCard },
      { to: "/super-admin/sms-credits", label: "SMS Credits", icon: WalletCards },
    ],
  },
  {
    title: "Insights & Platform",
    items: [
      { to: "/super-admin/analytics", label: "Reports & Analytics", icon: BarChart3 },
      { to: "/super-admin/data", label: "Data Management", icon: Database },
      { to: "/super-admin/integrations", label: "Integrations", icon: PlugZap },
    ],
  },
  {
    title: "Governance & Security",
    items: [
      { to: "/super-admin/admins", label: "Platform Admins", icon: Users },
      { to: "/super-admin/audit-log", label: "Audit & Security", icon: ShieldCheck },
      {
        to: "/super-admin/announcements",
        label: "Announcements",
        icon: BellRing,
        badgeTone: "emerald",
      },
    ],
  },
  {
    title: "Observability & System",
    items: [
      { to: "/super-admin/support", label: "Support Queue", icon: Ticket, badgeTone: "amber" },
      { to: "/super-admin/system", label: "System Telemetry", icon: Activity },
      { to: "/super-admin/settings", label: "Platform Config", icon: Settings2 },
    ],
  },
];

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const school = useSchool();
  const { data: pendingAnnouncements = 0 } = useQuery({
    queryKey: ["super-admin-sidebar-announcements"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("platform_announcements" as never)
        .select("id", { count: "exact", head: true })
        .is("published_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const { data: openTickets = 0 } = useQuery({
    queryKey: ["super-admin-sidebar-support"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("support_tickets" as never)
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "in_progress"]);
      if (error) throw error;
      return count ?? 0;
    },
  });

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out of platform command.");
    window.location.assign("/auth?mode=super_admin");
  }

  const adminName = school.fullName || "Super Administrator";
  const adminEmail = school.email || "admin@shanscott.com";
  const initials = adminName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const currentItem = NAV_SECTIONS.flatMap((s) => s.items).find(
    (item) =>
      pathname === item.to || (item.to !== "/super-admin" && pathname.startsWith(`${item.to}/`)),
  );
  const pageTitle = currentItem?.label ?? "Platform Command";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="super-admin-shell flex min-h-screen bg-[#f3f7f5] text-slate-900 selection:bg-emerald-500/25 selection:text-emerald-950 dark:bg-[#060d0b] dark:text-slate-100 dark:selection:bg-emerald-500/30 dark:selection:text-emerald-200">
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            "hidden shrink-0 border-r border-[#1e3a32]/80 bg-[linear-gradient(175deg,#0c2620_0%,#081a15_52%,#05100d_100%)] text-slate-200 shadow-[10px_0_30px_rgba(4,20,16,0.25)] transition-all duration-300 ease-in-out md:block",
            collapsed ? "w-[78px]" : "w-[290px]",
          )}
        >
          <div className="sticky top-0 flex h-screen flex-col overflow-hidden">
            {/* Sidebar Brand Header */}
            <div className="relative border-b border-[#1f3f37] bg-white/[0.02] p-4.5">
              <div className="flex items-center gap-3">
                <div className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-[#071713] shadow-[0_0_20px_rgba(52,211,153,0.35),0_0_0_1px_rgba(255,255,255,0.2)_inset]">
                  <ShieldCheck className="size-6 drop-shadow-sm" />
                  <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[#0c2620] bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                </div>
                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black tracking-[0.14em] text-white">
                        SHANSCOTT
                      </span>
                      <span className="rounded bg-emerald-400/20 px-1 py-0.2 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                        CBE
                      </span>
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
                      Platform Command
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation Sections */}
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 [scrollbar-color:rgba(52,211,153,0.18)_transparent]">
              {NAV_SECTIONS.map((section, idx) => (
                <div key={section.title} className={cn(idx > 0 && "mt-5")}>
                  {!collapsed && (
                    <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200/40">
                      {section.title}
                    </p>
                  )}
                  {collapsed && idx > 0 && (
                    <div className="mx-2 my-2 border-t border-emerald-500/15" />
                  )}
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <SidebarLink
                        key={item.to}
                        item={getLiveNavItem(item, pendingAnnouncements, openTickets)}
                        pathname={pathname}
                        collapsed={collapsed}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Sidebar Footer & System Status */}
            <div className="shrink-0 border-t border-[#1f3f37] bg-white/[0.015] p-3 space-y-2">
              {!collapsed && (
                <Link
                  to="/super-admin/system"
                  className="group block rounded-xl border border-emerald-500/20 bg-emerald-950/40 p-2.5 transition-all hover:border-emerald-400/40 hover:bg-emerald-950/60"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                      </span>
                      <span className="text-[11px] font-bold text-emerald-300">Operational</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400/70">99.98%</span>
                  </div>
                  <p className="mt-1 truncate text-[10px] text-slate-400">
                    All services & DB online
                  </p>
                </Link>
              )}

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCollapsed((val) => !val)}
                  className="flex-1 justify-start gap-2 rounded-xl text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  {collapsed ? (
                    <ChevronRight className="size-4" />
                  ) : (
                    <ChevronLeft className="size-4" />
                  )}
                  {!collapsed && <span className="text-xs font-medium">Collapse</span>}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void signOut()}
                  title="Sign out of platform command"
                  className="size-8 rounded-xl text-rose-300/80 hover:bg-rose-500/20 hover:text-rose-200"
                >
                  <LogOut className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top Bar Header */}
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-emerald-900/20 bg-white/85 px-4 backdrop-blur-xl dark:border-emerald-900/30 dark:bg-[#091512]/85 md:px-8">
            {/* Left Header Controls */}
            <div className="flex items-center gap-3 md:gap-4">
              {/* Mobile Drawer Trigger */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0 border-slate-200 bg-white shadow-sm md:hidden dark:border-slate-800 dark:bg-slate-900"
                    aria-label="Open platform menu"
                  >
                    <Menu className="size-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-[min(85vw,320px)] border-r border-[#1f3f37] bg-[linear-gradient(175deg,#0c2620_0%,#081a15_52%,#05100d_100%)] p-0 text-slate-200"
                >
                  <SheetTitle className="sr-only">Platform Command Navigation</SheetTitle>
                  <SheetDescription className="sr-only">
                    Navigate the SHANSCOTT platform control room.
                  </SheetDescription>
                  <div className="flex h-full flex-col">
                    <div className="border-b border-[#1f3f37] p-5">
                      <div className="flex items-center gap-3">
                        <div className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-[#071713] shadow-md">
                          <ShieldCheck className="size-5" />
                        </div>
                        <div>
                          <p className="text-sm font-black tracking-widest text-white">SHANSCOTT</p>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                            Platform Command
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-4">
                      {NAV_SECTIONS.map((section) => (
                        <div key={section.title}>
                          <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200/50">
                            {section.title}
                          </p>
                          <div className="space-y-1">
                            {section.items.map((item) => (
                              <SidebarLink
                                key={item.to}
                                item={getLiveNavItem(item, pendingAnnouncements, openTickets)}
                                pathname={pathname}
                                collapsed={false}
                                onNavigate={() => setMobileOpen(false)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-[#1f3f37] p-3">
                      <Button
                        variant="ghost"
                        onClick={() => void signOut()}
                        className="w-full justify-start gap-2 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                      >
                        <LogOut className="size-4" /> Sign out
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              {/* Breadcrumb / Title */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="hidden items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-700 sm:flex dark:text-emerald-400">
                    <Radio className="size-3 animate-pulse text-emerald-500" /> Platform Command
                  </span>
                  <span className="hidden text-slate-300 sm:inline dark:text-slate-700">/</span>
                  <h1 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg dark:text-white">
                    {pageTitle}
                  </h1>
                </div>
              </div>
            </div>

            {/* Right Header Controls */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* Live Status Pill */}
              <div className="hidden items-center gap-2 rounded-full border border-emerald-600/20 bg-emerald-50/80 px-3 py-1 text-xs font-semibold text-emerald-800 shadow-sm md:flex dark:border-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                <span>System Live</span>
              </div>

              {/* Quick Jump to School Dashboard */}
              <Button
                asChild
                variant="outline"
                size="sm"
                className="hidden gap-1.5 rounded-full border-slate-200 bg-white/70 text-xs font-semibold text-slate-700 shadow-sm hover:bg-white hover:text-emerald-700 lg:inline-flex dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-emerald-300"
              >
                <Link to="/dashboard">
                  <ExternalLink className="size-3.5" /> School View
                </Link>
              </Button>

              {/* Theme Toggle */}
              <ThemeToggle className="size-9 rounded-full border-slate-200/80 bg-white/80 shadow-sm dark:border-slate-800 dark:bg-slate-900/80" />

              {/* Super Admin Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative flex h-9 items-center gap-2.5 rounded-full border border-emerald-600/30 bg-emerald-900/10 py-1 pl-1 pr-3 transition hover:bg-emerald-900/20 dark:border-emerald-500/30 dark:bg-emerald-400/10"
                  >
                    <Avatar className="size-7 ring-1 ring-emerald-500/50">
                      <AvatarImage src={school.avatarUrl ?? undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-700 text-[10px] font-bold text-white">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden text-left sm:block">
                      <p className="text-xs font-bold leading-none text-slate-800 dark:text-slate-100">
                        {adminName}
                      </p>
                      <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Platform Owner
                      </p>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60 p-1.5 shadow-xl">
                  <DropdownMenuLabel className="p-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-9 ring-1 ring-emerald-500/30">
                        <AvatarFallback className="bg-emerald-600 text-xs font-bold text-white">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                          {adminName}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {adminEmail}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <span>Access Level</span>
                      <span className="font-bold uppercase tracking-wider">
                        Super Administrator
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link to="/super-admin/system" className="cursor-pointer gap-2">
                        <Activity className="size-4 text-emerald-500" />
                        <span>System Health</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/super-admin/audit-log" className="cursor-pointer gap-2">
                        <ShieldCheck className="size-4 text-emerald-500" />
                        <span>Security Audit Log</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/super-admin/settings" className="cursor-pointer gap-2">
                        <Settings2 className="size-4 text-emerald-500" />
                        <span>Platform Settings</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => void signOut()}
                    className="cursor-pointer gap-2 text-rose-600 focus:bg-rose-50 focus:text-rose-700 dark:text-rose-400 dark:focus:bg-rose-950/40"
                  >
                    <LogOut className="size-4" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Main Viewport Container */}
          <main className="min-h-0 flex-1 p-4 md:p-8 lg:p-10">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}

function SidebarLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const active =
    pathname === item.to || (item.to !== "/super-admin" && pathname.startsWith(`${item.to}/`));

  const linkNode = (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
        collapsed && "justify-center px-2",
        active
          ? "bg-gradient-to-r from-emerald-400 to-teal-400 font-bold text-[#061c16] shadow-[0_4px_16px_rgba(52,211,153,0.3)]"
          : "text-slate-300 hover:bg-white/[0.08] hover:text-white",
      )}
    >
      {active && !collapsed && (
        <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-emerald-300 shadow-[0_0_8px_#34d399]" />
      )}
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-lg transition-colors",
          active
            ? "bg-[#061c16]/15 text-[#061c16]"
            : "bg-white/[0.04] text-slate-300 group-hover:bg-white/[0.1] group-hover:text-white",
        )}
      >
        <Icon className="size-4" />
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && item.count !== undefined && item.count > 0 && (
        <span
          className={cn(
            "ml-auto grid min-w-5 place-items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
            active
              ? "bg-[#061c16]/20 text-[#061c16]"
              : item.badgeTone === "amber"
                ? "bg-amber-400/20 text-amber-300"
                : item.badgeTone === "rose"
                  ? "bg-rose-400/20 text-rose-300"
                  : "bg-emerald-400/20 text-emerald-300",
          )}
        >
          {item.count}
        </span>
      )}
      {collapsed && item.count !== undefined && item.count > 0 && (
        <span
          className={cn(
            "absolute right-1 top-1 size-2 rounded-full",
            item.badgeTone === "amber" ? "bg-amber-400" : "bg-emerald-400",
          )}
        />
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkNode}</TooltipTrigger>
        <TooltipContent
          side="right"
          className="border-[#1f3f37] bg-[#0c2620] text-xs font-semibold text-white"
        >
          {item.label}
          {item.count !== undefined && item.count > 0 && ` (${item.count})`}
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkNode;
}

function getLiveNavItem(item: NavItem, pendingAnnouncements: number, openTickets: number) {
  if (item.to === "/super-admin/announcements") {
    return { ...item, count: pendingAnnouncements };
  }
  if (item.to === "/super-admin/support") {
    return { ...item, count: openTickets };
  }
  return item;
}
