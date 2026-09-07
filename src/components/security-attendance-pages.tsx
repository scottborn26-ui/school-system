import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, CheckCircle2, ClipboardList, Download, FileClock, LogIn, LogOut, Search, ShieldCheck, TimerReset } from "lucide-react";
import { useState } from "react";
import { RequireSchool } from "@/components/require-school";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useSchool } from "@/hooks/use-school";
import { downloadCsv } from "@/lib/csv";

const attendanceTable = () => (supabase as unknown as { from: (table: string) => any }).from("staff_attendance");
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date());

function dateOffset(date: string, offset: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function formatTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-";
}

export function SecurityPage({ children }: { children: React.ReactNode }) {
  return <RequireSchool roles={["security"]}>{children}</RequireSchool>;
}

export function SecurityDashboardPage() {
  const school = useSchool();
  const currentDate = today();
  const data = useQuery({
    queryKey: ["security-dashboard", school.schoolId, currentDate],
    enabled: Boolean(school.schoolId),
    queryFn: async () => {
      const [staff, attendance] = await Promise.all([
        supabase.from("staff").select("id, full_name, job_title").eq("school_id", school.schoolId!).eq("is_archived", false).eq("status", "active").order("full_name"),
        attendanceTable().select("*").eq("school_id", school.schoolId!).eq("attendance_date", currentDate),
      ]);
      if (staff.error) throw staff.error;
      if (attendance.error) throw attendance.error;
      return { staff: staff.data ?? [], attendance: attendance.data ?? [] };
    },
  });
  const rows = (data.data?.staff ?? []).map((member: any) => ({ ...member, attendance: (data.data?.attendance ?? []).find((item: any) => item.staff_id === member.id) }));
  const checkedIn = rows.filter((row: any) => row.attendance?.clock_in_time).length;
  const checkedOut = rows.filter((row: any) => row.attendance?.clock_out_time).length;
  const late = rows.filter((row: any) => row.attendance?.status === "late").length;
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-2xl border border-emerald-200/70 bg-[linear-gradient(120deg,#063b35_0%,#075e54_58%,#0b7668_100%)] px-5 py-6 text-white shadow-[0_16px_40px_rgba(6,95,84,0.18)] sm:px-8 sm:py-8">
        <div className="relative z-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-emerald-50"><ShieldCheck className="size-3.5" /> Gate operations</div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Good morning, gate team.</h1>
            <p className="mt-2 max-w-xl text-sm text-emerald-50/80">Keep the staff register moving safely and accurately throughout the school day.</p>
          </div>
          <div className="rounded-xl border border-white/15 bg-black/10 px-4 py-3 text-left sm:min-w-44"><p className="text-xs uppercase tracking-wider text-emerald-100/70">Today</p><p className="mt-1 text-lg font-semibold">{currentDate}</p><p className="text-xs text-emerald-100/70">Live attendance view</p></div>
        </div>
        <div className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full border-[28px] border-white/10" />
      </section>
      <div className="grid gap-3 sm:grid-cols-3">
        <Summary icon={LogIn} label="Checked in" value={checkedIn} tone="emerald" />
        <Summary icon={LogOut} label="Checked out" value={checkedOut} tone="blue" />
        <Summary icon={TimerReset} label="Late arrivals" value={late} tone="amber" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <Card className="overflow-hidden border-border/70 shadow-sm">
          <CardHeader className="border-b bg-muted/20 px-5 py-4"><div className="flex items-center justify-between gap-3"><div><CardTitle className="text-base">Staff status today</CardTitle><p className="mt-1 text-xs text-muted-foreground">A live read-only view of the gate register.</p></div><Badge variant="outline" className="gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500" />Live</Badge></div></CardHeader>
          <CardContent className="p-0">{rows.map((row: any) => <div className="flex items-center justify-between gap-4 border-b px-5 py-4 last:border-0 hover:bg-muted/20" key={row.id}><div className="flex min-w-0 items-center gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{row.full_name.split(" ").map((part: string) => part[0]).slice(0, 2).join("")}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{row.full_name}</p><p className="truncate text-xs text-muted-foreground">{row.job_title || "Staff"}</p></div></div><div className="shrink-0 text-right text-sm"><Badge variant={row.attendance?.status === "late" ? "destructive" : row.attendance?.status === "present" ? "default" : "secondary"} className="capitalize">{row.attendance?.status?.replace("_", " ") ?? "not checked in"}</Badge><p className="mt-1 text-[11px] text-muted-foreground">In {formatTime(row.attendance?.clock_in_time)} · Out {formatTime(row.attendance?.clock_out_time)}</p></div></div>)}{!rows.length && <div className="p-8 text-center text-sm text-muted-foreground">No active staff found.</div>}</CardContent>
        </Card>
        <Card className="border-border/70 bg-slate-950 text-white shadow-sm"><CardHeader><CardTitle className="text-base text-white">Quick access</CardTitle><p className="text-xs text-slate-400">Read-only tools for the gate.</p></CardHeader><CardContent className="space-y-2"><SecurityAction to="/staff-attendance" icon={CheckCircle2} label="Gate check-in" /><SecurityAction to="/security/today" icon={CalendarDays} label="Today summary" /><SecurityAction to="/security/history" icon={FileClock} label="Staff history" /><SecurityAction to="/security/reports" icon={Download} label="Export reports" /></CardContent></Card>
      </div>
    </div>
  );
}

export function SecurityTodayPage() {
  const school = useSchool();
  const currentDate = today();
  const data = useQuery({
    queryKey: ["security-today", school.schoolId, currentDate],
    enabled: Boolean(school.schoolId),
    queryFn: async () => {
      const [staff, attendance] = await Promise.all([supabase.from("staff").select("id, full_name, job_title").eq("school_id", school.schoolId!).eq("is_archived", false).eq("status", "active").order("full_name"), attendanceTable().select("*").eq("school_id", school.schoolId!).eq("attendance_date", currentDate)]);
      if (staff.error) throw staff.error;
      if (attendance.error) throw attendance.error;
      return (staff.data ?? []).map((member: any) => ({ ...member, attendance: (attendance.data ?? []).find((item: any) => item.staff_id === member.id) }));
    },
  });
  return <div className="mx-auto max-w-4xl space-y-5 pb-8"><PageHeading title="Today&apos;s attendance" description={currentDate} /><Card><CardContent className="divide-y p-0">{(data.data ?? []).map((row: any) => <div className="flex items-center justify-between gap-3 p-4" key={row.id}><div><p className="font-medium">{row.full_name}</p><p className="text-sm text-muted-foreground">{row.job_title || "Staff"}</p></div><div className="text-right"><Badge>{row.attendance?.status ?? "absent"}</Badge><p className="mt-1 text-xs text-muted-foreground">In {formatTime(row.attendance?.clock_in_time)} · Out {formatTime(row.attendance?.clock_out_time)}</p></div></div>)}</CardContent></Card><SecurityLinks /></div>;
}

export function SecurityHistoryPage() {
  const school = useSchool();
  const [staffId, setStaffId] = useState("all");
  const [search, setSearch] = useState("");
  const end = today();
  const start = dateOffset(end, -30);
  const data = useQuery({
    queryKey: ["security-history", school.schoolId, start, end],
    enabled: Boolean(school.schoolId),
    queryFn: async () => {
      const [staff, attendance] = await Promise.all([supabase.from("staff").select("id, full_name, job_title").eq("school_id", school.schoolId!).eq("is_archived", false).order("full_name"), attendanceTable().select("*").eq("school_id", school.schoolId!).gte("attendance_date", start).lte("attendance_date", end).order("attendance_date", { ascending: false })]);
      if (staff.error) throw staff.error;
      if (attendance.error) throw attendance.error;
      return { staff: staff.data ?? [], attendance: attendance.data ?? [] };
    },
  });
  const names = new Map((data.data?.staff ?? []).map((member: any) => [member.id, member]));
  const rows = (data.data?.attendance ?? []).filter((row: any) => (staffId === "all" || row.staff_id === staffId) && String(names.get(row.staff_id)?.full_name ?? "").toLowerCase().includes(search.toLowerCase()));
  return <div className="mx-auto max-w-5xl space-y-5 pb-8"><PageHeading title="Staff attendance history" description={`${start} to ${end}`} /><div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search staff" value={search} onChange={(event) => setSearch(event.target.value)} /></div><select className="h-10 rounded-md border bg-background px-3 text-sm" value={staffId} onChange={(event) => setStaffId(event.target.value)}><option value="all">All staff</option>{(data.data?.staff ?? []).map((member: any) => <option key={member.id} value={member.id}>{member.full_name}</option>)}</select></div><Card><CardContent className="overflow-x-auto p-0"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-4">Date</th><th className="p-4">Staff</th><th className="p-4">Status</th><th className="p-4">In</th><th className="p-4">Out</th></tr></thead><tbody>{rows.map((row: any) => <tr className="border-b last:border-0" key={row.id}><td className="p-4">{row.attendance_date}</td><td className="p-4 font-medium">{names.get(row.staff_id)?.full_name ?? "Unknown"}</td><td className="p-4"><Badge>{row.status}</Badge></td><td className="p-4">{formatTime(row.clock_in_time)}</td><td className="p-4">{formatTime(row.clock_out_time)}</td></tr>)}</tbody></table>{!rows.length && <p className="p-8 text-center text-sm text-muted-foreground">No attendance history found.</p>}</CardContent></Card><SecurityLinks /></div>;
}

export function SecurityReportsPage() {
  const school = useSchool();
  const [start, setStart] = useState(dateOffset(today(), -30));
  const [end, setEnd] = useState(today());
  const data = useQuery({
    queryKey: ["security-reports", school.schoolId, start, end],
    enabled: Boolean(school.schoolId && start && end),
    queryFn: async () => {
      const [staff, attendance] = await Promise.all([supabase.from("staff").select("id, full_name, job_title").eq("school_id", school.schoolId!), attendanceTable().select("*").eq("school_id", school.schoolId!).gte("attendance_date", start).lte("attendance_date", end).order("attendance_date")]);
      if (staff.error) throw staff.error;
      if (attendance.error) throw attendance.error;
      return { staff: staff.data ?? [], attendance: attendance.data ?? [] };
    },
  });
  const names = new Map((data.data?.staff ?? []).map((member: any) => [member.id, member]));
  function exportReport() { downloadCsv(`staff-attendance-${start}-to-${end}`, (data.data?.attendance ?? []).map((row: any) => ({ Date: row.attendance_date, Staff: names.get(row.staff_id)?.full_name ?? "Unknown", Role: names.get(row.staff_id)?.job_title ?? "Staff", Status: row.status, CheckIn: formatTime(row.clock_in_time), CheckOut: formatTime(row.clock_out_time), Hours: row.hours_worked ?? "" }))); }
  return <div className="mx-auto max-w-5xl space-y-5 pb-8"><PageHeading title="Attendance reports" description="Export read-only attendance records for a date range." /><Card><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end"><label className="space-y-1 text-sm">From<Input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label><label className="space-y-1 text-sm">To<Input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label><Button onClick={exportReport}><Download className="mr-2 size-4" />Export CSV</Button></CardContent></Card><Card><CardContent className="p-4"><p className="font-medium">Records found</p><p className="mt-1 text-3xl font-bold text-primary">{data.data?.attendance.length ?? 0}</p></CardContent></Card><SecurityLinks /></div>;
}

function Summary({ icon: Icon, label, value, tone }: { icon: typeof LogIn; label: string; value: number; tone: "emerald" | "blue" | "amber" }) { const tones = { emerald: "bg-emerald-500/10 text-emerald-600", blue: "bg-blue-500/10 text-blue-600", amber: "bg-amber-500/10 text-amber-600" }; return <Card className="border-border/70 shadow-sm"><CardContent className="flex items-center gap-3 p-4"><div className={`grid size-10 place-items-center rounded-xl ${tones[tone]}`}><Icon className="size-5" /></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-0.5 text-2xl font-bold tracking-tight">{value}</p></div></CardContent></Card>; }
function PageHeading({ title, description }: { title: string; description: string }) { return <div><h1 className="text-2xl font-semibold">{title}</h1><p className="text-sm text-muted-foreground">{description}</p></div>; }
function SecurityAction({ to, icon: Icon, label }: { to: "/staff-attendance" | "/security/today" | "/security/history" | "/security/reports"; icon: typeof CheckCircle2; label: string }) { return <Button asChild variant="ghost" className="h-auto w-full justify-between px-3 py-3 text-left text-slate-100 hover:bg-white/10 hover:text-white"><Link to={to}><span className="flex items-center gap-3"><Icon className="size-4 text-emerald-400" />{label}</span><ArrowRight className="size-4 text-slate-500" /></Link></Button>; }
function SecurityLinks() { return <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/staff-attendance"><ShieldCheck className="mr-2 size-4" />Gate check-in</Link></Button><Button asChild variant="outline"><Link to="/security/today"><CalendarDays className="mr-2 size-4" />Today</Link></Button><Button asChild variant="outline"><Link to="/security/history"><FileClock className="mr-2 size-4" />History</Link></Button><Button asChild variant="outline"><Link to="/security/reports"><ClipboardList className="mr-2 size-4" />Reports</Link></Button></div>; }
