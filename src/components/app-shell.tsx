import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { BadgeCheck, Check, Loader2 } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faBell,
  faBoxArchive,
  faBookOpen,
  faCalendarDays,
  faChartLine,
  faChevronLeft,
  faChevronRight,
  faClipboardCheck,
  faCoins,
  faFileLines,
  faEnvelope,
  faGraduationCap,
  faMagnifyingGlass,
  faRightFromBracket,
  faSchool,
  faShieldHalved,
  faSliders,
  faUsers,
  faUserTie,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SchoolLogo } from "@/components/school-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/components/use-theme";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabase";
import { ROLE_LABELS, useSchool, type AppRole } from "@/hooks/use-school";
import { ALLOWED_CURRICULUM_ROLES } from "@/lib/access-control";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notification-bell";
import { useCommunicationCounts } from "@/lib/communication";

interface NavItem {
  to: string;
  label: string;
  icon: IconDefinition;
  roles: AppRole[];
}

interface NavGroup {
  label: string;
  paths: string[];
}

const NAV_GROUPS: NavGroup[] = [
  { label: "Overview", paths: ["/dashboard"] },
  {
    label: "Daily operations",
    paths: [
      "/attendance",
      "/attendance-analytics",
      "/marks",
      "/reports",
      "/report-management",
      "/report-card-approvals",
      "/admissions",
    ],
  },
  { label: "People", paths: ["/learners", "/staff"] },
  {
    label: "Academics",
    paths: [
      "/transition",
      "/timetable",
      "/exam-timetable",
      "/classes",
      "/curriculum",
      "/my-teaching",
      "/assignments",
      "/assessments",
      "/grading",
    ],
  },
  { label: "Finance", paths: ["/finance"] },
  { label: "Settings & security", paths: ["/settings", "/audit", "/platform"] },
];

const NAV: NavItem[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: faChartLine,
    roles: [
      "principal",
      "deputy",
      "teacher",
      "class_teacher",
      "parent",
      "student",
      "super_admin",
      "admin",
      "exam_officer",
    ],
  },
  {
    to: "/learners",
    label: "Learners",
    icon: faGraduationCap,
    roles: ["admin", "principal", "deputy", "teacher", "class_teacher"],
  },
  {
    to: "/transition",
    label: "Grade 9 Transition",
    icon: faGraduationCap,
    roles: ["principal", "deputy", "super_admin"],
  },
  { to: "/staff", label: "Staff", icon: faUserTie, roles: ["principal", "deputy"] },
  {
    to: "/my-teaching",
    label: "My Teaching",
    icon: faBookOpen,
    roles: ["teacher", "class_teacher"],
  },
  {
    to: "/classes",
    label: "Grades & Streams",
    icon: faSchool,
    roles: ["principal", "deputy"],
  },
  {
    to: "/curriculum",
    label: "Curriculum",
    icon: faBookOpen,
    roles: [...ALLOWED_CURRICULUM_ROLES],
  },
  {
    to: "/timetable",
    label: "Timetable",
    icon: faCalendarDays,
    roles: ["admin", "principal", "deputy", "teacher", "class_teacher"],
  },
  {
    to: "/exam-timetable",
    label: "Exam Timetable",
    icon: faCalendarDays,
    roles: ["admin", "exam_officer", "principal", "deputy"],
  },
  {
    to: "/attendance",
    label: "Attendance",
    icon: faClipboardCheck,
    roles: ["principal", "deputy", "teacher", "class_teacher"],
  },
  {
    to: "/attendance-analytics",
    label: "Attendance analytics",
    icon: faChartLine,
    roles: ["admin", "principal", "deputy", "super_admin"],
  },
  {
    to: "/marks",
    label: "Marks Entry",
    icon: faFileLines,
    roles: ["admin", "exam_officer", "principal", "deputy", "teacher", "class_teacher"],
  },
  {
    to: "/assessment-approvals",
    label: "Marks Approvals",
    icon: faClipboardCheck,
    roles: ["admin", "exam_officer", "principal", "deputy", "super_admin"],
  },
  {
    to: "/assignments",
    label: "Create Assessment",
    icon: faClipboardCheck,
    roles: ["admin", "exam_officer", "principal", "deputy", "super_admin"],
  },
  {
    to: "/assessments",
    label: "Assessment Records",
    icon: faClipboardCheck,
    roles: ["admin", "exam_officer", "principal", "deputy", "super_admin"],
  },
  {
    to: "/reports",
    label: "Report Cards",
    icon: faFileLines,
    roles: ["admin", "exam_officer", "principal", "deputy", "teacher", "class_teacher"],
  },
  {
    to: "/report-management",
    label: "Report Office",
    icon: faFileLines,
    roles: ["admin", "exam_officer"],
  },
  {
    to: "/report-card-approvals",
    label: "Approve Report Cards",
    icon: faClipboardCheck,
    roles: ["principal", "deputy", "super_admin"],
  },
  {
    to: "/finance",
    label: "Fees & Finance",
    icon: faCoins,
    roles: ["principal", "deputy"],
  },
  {
    to: "/grading",
    label: "Grading Scheme",
    icon: faBookOpen,
    roles: ["principal", "deputy", "teacher", "class_teacher"],
  },
  {
    to: "/admissions",
    label: "Admissions",
    icon: faBoxArchive,
    roles: ["principal", "deputy"],
  },
  { to: "/settings", label: "School Settings", icon: faSliders, roles: ["principal", "deputy"] },
  { to: "/audit", label: "Audit Logs", icon: faShieldHalved, roles: ["principal", "super_admin"] },
  { to: "/platform", label: "Platform Control", icon: faShieldHalved, roles: ["super_admin"] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const school = useSchool();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isNavigating = useRouterState({ select: (s) => s.status === "pending" });
  const communicationCounts = useCommunicationCounts(school.userId);
  const { theme, setTheme } = useTheme();

  const visible = NAV.filter(
    (n) => school.roles.length === 0 || n.roles.some((r) => school.roles.includes(r)),
  )
    .filter(
      (item) =>
        school.activeRole !== "exam_officer" ||
        [
          "/dashboard",
          "/exam-timetable",
          "/marks",
          "/assessment-approvals",
          "/assignments",
          "/assessments",
          "/reports",
          "/report-management",
        ].includes(item.to),
    )
    .map((item) => {
      if (school.activeRole === "exam_officer") {
        const labels: Record<string, string> = {
          "/exam-timetable": "Schedule Exams",
          "/marks": "Mark Entry",
          "/assessment-approvals": "Results",
          "/assignments": "Exam Management",
          "/assessments": "Candidates & Exams",
          "/reports": "Reports",
          "/report-management": "Published Results",
        };
        return labels[item.to] ? { ...item, label: labels[item.to] } : item;
      }
      if (school.can("teacher") && !school.can("principal", "deputy", "super_admin")) {
        const labels: Record<string, string> = {
          "/learners": "My Students",
          "/timetable": "My Timetable",
          "/attendance": "My Attendance",
          "/marks": "My Marks",
          "/reports": "My Reports",
        };
        return labels[item.to] ? { ...item, label: labels[item.to] } : item;
      }
      return item;
    });
  const yearTerms = school.terms.filter((t) => t.academic_year_id === school.academicYearId);
  const groupedNavigation = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.paths
      .map((path) => visible.find((item) => item.to === path))
      .filter((item): item is NavItem => Boolean(item)),
  })).filter((group) => group.items.length > 0);

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out successfully.");
    void router.navigate({ to: "/auth", replace: true });
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-[color:var(--sidebar)] text-[color:var(--sidebar-foreground)]">
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--sidebar-border)] px-4 py-4">
        <SchoolLogo
          logoUrl={school.school?.logo_url}
          schoolName={school.school?.name}
          shortName={school.school?.short_name}
          className="size-9 shadow-[0_8px_20px_rgba(15,118,110,0.18)]"
        />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">Shanscot Technologies</p>
            <p className="truncate text-xs text-slate-300">
              {school.school?.name ?? "School Management"}
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3 pt-1">
        {groupedNavigation.map((group, groupIndex) => (
          <div
            key={group.label}
            className={cn(
              "border-sidebar-border/70",
              groupIndex > 0 && "mt-5 border-t pt-4 md:border-t-0 md:pt-0",
            )}
          >
            {!collapsed && (
              <div className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                {group.label}
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm leading-5 transition-all duration-200",
                      collapsed && "justify-center px-2",
                      active
                        ? "bg-[color:var(--primary)] text-white shadow-sm"
                        : "text-slate-300 hover:bg-slate-800/90 hover:text-white",
                    )}
                    title={item.label}
                  >
                    <FontAwesomeIcon icon={item.icon} className="size-4 shrink-0 text-[0.8rem]" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-[color:var(--sidebar-border)] p-2">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/90 hover:text-white md:flex"
        >
          {collapsed ? (
            <FontAwesomeIcon icon={faChevronRight} />
          ) : (
            <FontAwesomeIcon icon={faChevronLeft} />
          )}
          {!collapsed && "Collapse"}
        </button>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/90 hover:text-white"
        >
          <FontAwesomeIcon icon={faRightFromBracket} className="w-4" />
          {!collapsed && "Sign out"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {isNavigating && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-background/55 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card px-5 py-4 text-sm font-medium text-foreground shadow-2xl shadow-primary/15">
            <Loader2 className="size-5 animate-spin text-primary" />
            Loading page…
          </div>
        </div>
      )}
      <aside
        className={cn(
          "hidden shrink-0 border-r border-[color:var(--sidebar-border)] bg-[color:var(--sidebar)] md:block",
          collapsed ? "w-[68px]" : "w-64",
        )}
      >
        <div className="sticky top-0 h-screen">{sidebar}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-background/90 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] backdrop-blur transition-shadow duration-200 no-print">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden" aria-label="Open menu">
                <FontAwesomeIcon icon={faBars} />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              {sidebar}
            </SheetContent>
          </Sheet>

          <div className="relative hidden min-w-[220px] flex-1 sm:block">
            <FontAwesomeIcon
              icon={faMagnifyingGlass}
              className="pointer-events-none absolute left-2.5 top-1/2 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Link to="/learners" className="block">
              <Input
                readOnly
                placeholder="Search learners…"
                className="pl-8 cursor-pointer"
                aria-label="Global learner search"
              />
            </Link>
          </div>

          {pathname.startsWith("/learners/") && (
            <h1 className="order-first text-lg font-bold text-foreground sm:order-none">
              Student Profile
            </h1>
          )}

          <div className="ml-auto flex items-center gap-2">
            {school.years.length > 0 && (
              <Select value={school.academicYearId ?? ""} onValueChange={school.setAcademicYearId}>
                <SelectTrigger className="w-[130px]" aria-label="Academic year">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {school.years.map((y) => (
                    <SelectItem key={y.id} value={y.id}>
                      {y.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {yearTerms.length > 0 && (
              <Select value={school.termId ?? ""} onValueChange={school.setTermId}>
                <SelectTrigger className="w-[120px]" aria-label="Term">
                  <SelectValue placeholder="Term" />
                </SelectTrigger>
                <SelectContent>
                  {yearTerms.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {school.roles.length > 1 && (
              <Select
                value={school.activeRole ?? ""}
                onValueChange={(v) => school.setActiveRole(v as AppRole)}
              >
                <SelectTrigger className="hidden w-[190px] lg:flex" aria-label="Active role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {school.roles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Badge variant="secondary" className="hidden gap-1 xl:flex">
              <BadgeCheck className="size-3.5" />
              {school.activeRole ? ROLE_LABELS[school.activeRole] : "No role"}
            </Badge>
            <NotificationBell />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  aria-label="Open account menu"
                >
                  <Avatar className="size-9">
                    <AvatarImage
                      src={school.avatarUrl ?? undefined}
                      alt={`${school.fullName || "User"} profile picture`}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {initials(school.fullName || "U")}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="truncate">
                  {school.fullName || "My account"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile">My Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Theme preference</DropdownMenuLabel>
                {[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                  { value: "system", label: "System" },
                ].map((option) => {
                  const active = theme === option.value;
                  return (
                    <DropdownMenuItem
                      key={option.value}
                      onSelect={() => setTheme(option.value as "light" | "dark" | "system")}
                      className={cn(
                        "flex items-center justify-between gap-3",
                        active && "bg-accent text-accent-foreground",
                      )}
                    >
                      <span>{option.label}</span>
                      {active && <Check className="size-4" />}
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {pathname.startsWith("/learners/") && (
              <span className="hidden text-sm font-medium text-foreground sm:inline">Admin</span>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
}: {
  title: string;
  description?: string;
  icon?: IconDefinition;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <FontAwesomeIcon icon={Icon} className="w-5" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
