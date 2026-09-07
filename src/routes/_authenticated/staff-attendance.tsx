import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Clock3, Download, Eye, LogIn, LogOut, Pencil, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { RequireSchool } from "@/components/require-school";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useSchool } from "@/hooks/use-school";
import { downloadCsv } from "@/lib/csv";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/staff-attendance")({
  component: () => (
    <RequireSchool roles={["admin", "principal", "deputy", "security"]}>
      <AttendanceRoutePage />
    </RequireSchool>
  ),
});

const table = () => (supabase as unknown as { from: (table: string) => any }).from("staff_attendance");

function AttendanceRoutePage() {
  const school = useSchool();
  return school.activeRole === "security" ? <GateAttendancePage /> : <StaffAttendanceAdminPage />;
}

function GateAttendancePage() {
  const school = useSchool();
  const [today, setToday] = React.useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date()));
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  React.useEffect(() => {
    const refreshDate = window.setInterval(() => {
      setToday(new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date()));
    }, 60_000);
    return () => window.clearInterval(refreshDate);
  }, []);
  const result = useQuery({
    queryKey: ["gate-staff-attendance", school.schoolId, today],
    enabled: Boolean(school.schoolId),
    queryFn: async () => {
      const [staff, attendance] = await Promise.all([
        (supabase as any).rpc("list_gate_staff", { _school_id: school.schoolId }),
        table().select("*").eq("school_id", school.schoolId!).eq("attendance_date", today),
      ]);
      if (staff.error) throw staff.error;
      if (attendance.error) throw attendance.error;
      const { data: settings, error: settingsError } = await supabase
        .from("school_settings")
        .select("staff_attendance_enabled, staff_attendance_start_time, staff_attendance_grace_minutes")
        .eq("school_id", school.schoolId!)
        .maybeSingle();
      if (settingsError) throw settingsError;
      return {
        rows: (staff.data ?? []).map((member: any) => ({ ...member, attendance: (attendance.data ?? []).find((row: any) => row.staff_id === member.id) })),
        settings,
      };
    },
  });
  const clock = useMutation({
    mutationFn: async ({ staffId, action }: { staffId: string; action: "in" | "out" }) => {
      const { error } = await (supabase as any).rpc("gate_clock_staff", { _school_id: school.schoolId, _staff_id: staffId, _action: action });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Attendance recorded."); void qc.invalidateQueries({ queryKey: ["gate-staff-attendance"] }); },
    onError: (error: Error) => toast.error(error.message || "Attendance could not be recorded."),
  });
  const rows = (result.data?.rows ?? []).filter((row: any) => row.full_name.toLowerCase().includes(search.trim().toLowerCase()));
  const checkedIn = rows.filter((row: any) => row.attendance?.clock_in_time).length;
  const startTime = result.data?.settings?.staff_attendance_start_time ?? "08:00";
  const graceMinutes = result.data?.settings?.staff_attendance_grace_minutes ?? 15;
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const cutoff = new Date(2000, 0, 1, startHours, startMinutes + graceMinutes).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const clockingEnabled = result.data?.settings?.staff_attendance_enabled !== false;
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <section className="overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#063b35_0%,#087f70_62%,#17a589_100%)] p-5 text-white shadow-[0_18px_45px_rgba(6,95,84,0.2)] sm:p-8">
        <div className="flex items-start justify-between gap-5">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-emerald-50"><Clock3 className="size-3.5" /> Live gate register</div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Gate attendance</h1>
            <p className="mt-2 text-sm text-emerald-50/80">Record staff arrivals and departures for today.</p>
          </div>
          <div className="hidden rounded-2xl border border-white/15 bg-black/10 px-4 py-3 text-right sm:block"><p className="text-xs uppercase tracking-wider text-emerald-100/70">Today</p><p className="mt-1 font-semibold">{today}</p></div>
        </div>
        <div className="mt-7 flex flex-wrap items-end gap-x-8 gap-y-3 border-t border-white/15 pt-5">
          <div><p className="text-3xl font-semibold">{checkedIn}<span className="text-xl font-normal text-emerald-100/70"> / {rows.length}</span></p><p className="text-xs uppercase tracking-[0.16em] text-emerald-100/70">Checked in</p></div>
          <div className="text-sm text-emerald-50/80">Late after <span className="font-semibold text-white">{cutoff}</span></div>
        </div>
        {!clockingEnabled && <p className="mt-4 rounded-xl border border-red-200/30 bg-red-950/20 px-3 py-2 text-sm font-medium text-red-100">Clocking is disabled by the administrator.</p>}
      </section>
      <div className="relative"><Search className="absolute left-4 top-3.5 size-4 text-muted-foreground" /><Input className="h-12 rounded-xl border-border/70 bg-card pl-11 shadow-sm" placeholder="Search staff by name" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Staff register</h2><p className="text-sm text-muted-foreground">Tap an action to update attendance.</p></div><div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><Users className="size-4" />{rows.length} staff</div></div>
      <div className="grid gap-3 md:grid-cols-2">{rows.map((row: any) => {
        const attendance = row.attendance;
        const checkedOut = Boolean(attendance?.clock_out_time);
        return <Card className="border-border/70 shadow-sm transition-colors hover:border-emerald-300/70" key={row.id}><CardContent className="flex items-center gap-3 p-4"><div className={`flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-sm font-bold ${attendance?.clock_in_time ? "bg-emerald-500/12 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{row.photo_url ? <img src={row.photo_url} alt="" className="size-full object-cover" /> : row.full_name.split(" ").map((part: string) => part[0]).slice(0, 2).join("")}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{row.full_name}</p><p className="truncate text-xs text-muted-foreground">{row.job_title || "Staff"}</p>{attendance?.clock_in_time && <p className="mt-1 text-xs font-medium text-emerald-700">In {formatTime(attendance.clock_in_time)}{attendance.clock_out_time ? ` · Out ${formatTime(attendance.clock_out_time)}` : ""}</p>}</div>{!attendance?.clock_in_time ? <Button className="h-10 shrink-0 rounded-xl px-3" onClick={() => clock.mutate({ staffId: row.id, action: "in" })} disabled={!clockingEnabled || clock.isPending}><LogIn className="mr-2 size-4" />Check in</Button> : !checkedOut ? <Button variant="secondary" className="h-10 shrink-0 rounded-xl px-3" onClick={() => clock.mutate({ staffId: row.id, action: "out" })} disabled={!clockingEnabled || clock.isPending}><LogOut className="mr-2 size-4" />Check out</Button> : <Badge variant="outline" className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700">Complete</Badge>}</CardContent></Card>;
      })}</div>
      {!rows.length && <p className="py-10 text-center text-sm text-muted-foreground">No active staff match that search.</p>}
    </div>
  );
}

function formatTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-";
}

function formatCutoff(startTime: string | null | undefined, graceMinutes: number | null | undefined) {
  if (!startTime) return "the configured arrival time";
  const [hours, minutes] = startTime.split(":").map(Number);
  const cutoff = new Date(2000, 0, 1, hours, minutes + (graceMinutes ?? 0));
  return cutoff.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getDateOffset(date: string, offset: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function StaffAttendanceAdminPage() {
  const school = useSchool();
  const [date, setDate] = React.useState(new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date()));
  const [search, setSearch] = React.useState("");
  const [role, setRole] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [viewing, setViewing] = React.useState<any>(null);
  const [editing, setEditing] = React.useState<any>(null);
  const [editForm, setEditForm] = React.useState({ status: "present", clockIn: "", clockOut: "", reason: "" });
  const qc = useQueryClient();
  const canEdit = school.can("admin", "super_admin");

  const result = useQuery({
    queryKey: ["staff-attendance-admin", school.schoolId, date],
    enabled: Boolean(school.schoolId),
    queryFn: async () => {
      const trendStart = getDateOffset(date, -6);
      const [staff, attendance, settings, trendAttendance] = await Promise.all([
        supabase.from("staff").select("id, full_name, job_title, department_id, photo_url").eq("school_id", school.schoolId!).eq("is_archived", false).eq("status", "active").order("full_name"),
        table().select("*").eq("school_id", school.schoolId!).eq("attendance_date", date),
        supabase.from("school_settings").select("staff_attendance_start_time, staff_attendance_grace_minutes").eq("school_id", school.schoolId!).maybeSingle(),
        table().select("attendance_date, status").eq("school_id", school.schoolId!).gte("attendance_date", trendStart).lte("attendance_date", date),
      ]);
      if (staff.error) throw staff.error;
      if (attendance.error) throw attendance.error;
      if (settings.error) throw settings.error;
      if (trendAttendance.error) throw trendAttendance.error;
      return {
        rows: (staff.data ?? []).map((member: any) => ({ ...member, attendance: (attendance.data ?? []).find((row: any) => row.staff_id === member.id) })),
        settings: settings.data,
        trend: { totalStaff: staff.data?.length ?? 0, records: trendAttendance.data ?? [] },
      };
    },
  });

  const allRows = result.data?.rows ?? [];
  const roles = [...new Set(allRows.map((row: any) => row.job_title || "Staff"))];
  const rows = allRows.filter((row: any) => row.full_name.toLowerCase().includes(search.trim().toLowerCase()) && (role === "all" || (row.job_title || "Staff") === role) && (status === "all" || (row.attendance?.status ?? "absent") === status));
  const present = allRows.filter((row: any) => row.attendance?.status === "present").length;
  const late = allRows.filter((row: any) => row.attendance?.status === "late").length;
  const onLeave = allRows.filter((row: any) => row.attendance?.status === "on_leave").length;
     const excused = allRows.filter((row: any) => row.attendance?.status === "excused").length;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const cutoff = formatCutoff(result.data?.settings?.staff_attendance_start_time, result.data?.settings?.staff_attendance_grace_minutes);
  const trend = React.useMemo(() => {
    const totalStaff = result.data?.trend.totalStaff ?? allRows.length;
    const records = result.data?.trend.records ?? [];
    return Array.from({ length: 7 }, (_, index) => {
      const trendDate = getDateOffset(date, index - 6);
      const dayRecords = records.filter((record: any) => record.attendance_date === trendDate);
      const count = (status: string) => dayRecords.filter((record: any) => record.status === status).length;
      const present = count("present");
      const late = count("late");
      const onLeave = count("on_leave") + count("excused");
      return {
        day: new Intl.DateTimeFormat("en-KE", { weekday: "short", day: "numeric" }).format(new Date(`${trendDate}T00:00:00Z`)),
        present,
        late,
        absent: Math.max(0, totalStaff - present - late - onLeave - count("half_day")),
        onLeave,
      };
    });
  }, [allRows.length, date, result.data?.trend]);
  const analysis = React.useMemo(() => {
    const totalStaff = result.data?.trend.totalStaff ?? allRows.length;
    const expected = totalStaff * trend.length;
    const attended = trend.reduce((sum, item) => sum + item.present + item.late, 0);
    const late = trend.reduce((sum, item) => sum + item.late, 0);
    const absent = trend.reduce((sum, item) => sum + item.absent, 0);
    const strongestDay = trend.reduce((best, item) =>
      item.present + item.late > best.present + best.late ? item : best,
    trend[0]);
    return {
      attendanceRate: expected ? Math.round((attended / expected) * 100) : 0,
      late,
      absent,
      strongestDay: strongestDay?.day ?? "-",
    };
  }, [allRows.length, result.data?.trend.totalStaff, trend]);

  React.useEffect(() => setPage(1), [search, date, pageSize, role, status]);
  React.useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const edit = useMutation({
    mutationFn: async () => {
      if (!editForm.reason.trim()) throw new Error("A reason is required for manual changes.");
      const payload: any = { school_id: school.schoolId, staff_id: editing.id, attendance_date: date, status: editForm.status, is_manual_override: true, edited_by: school.userId, reason: editForm.reason.trim(), clock_in_time: editForm.clockIn ? new Date(`${date}T${editForm.clockIn}`).toISOString() : null, clock_out_time: editForm.clockOut ? new Date(`${date}T${editForm.clockOut}`).toISOString() : null };
      if (payload.clock_in_time && payload.clock_out_time) payload.hours_worked = Math.round((new Date(payload.clock_out_time).getTime() - new Date(payload.clock_in_time).getTime()) / 3600000 * 100) / 100;
      const { error } = await table().upsert(payload, { onConflict: "school_id,staff_id,attendance_date" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Attendance record updated."); setEditing(null); void qc.invalidateQueries({ queryKey: ["staff-attendance-admin"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  function openEdit(row: any) { setEditing(row); setEditForm({ status: row.attendance?.status ?? "present", clockIn: row.attendance?.clock_in_time ? new Date(row.attendance.clock_in_time).toTimeString().slice(0, 5) : "", clockOut: row.attendance?.clock_out_time ? new Date(row.attendance.clock_out_time).toTimeString().slice(0, 5) : "", reason: "" }); }
  function exportRows() { downloadCsv(`staff-attendance-${date}`, rows.map((row: any) => ({ Date: date, Staff: row.full_name, Role: row.job_title || "Staff", ClockIn: formatTime(row.attendance?.clock_in_time), ClockOut: formatTime(row.attendance?.clock_out_time), Hours: row.attendance?.hours_worked ?? "", Status: row.attendance?.status || "Absent" }))); }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-8">
      <div>
        <div className="flex items-center gap-2"><Clock3 className="size-5 text-primary" /><h1 className="text-2xl font-semibold tracking-tight">Staff Attendance</h1></div>
        <p className="text-sm text-muted-foreground">Staff clocking in after {cutoff} is recorded as late.</p>
        <Button variant="outline" onClick={exportRows}><Download className="mr-2 size-4" />Export CSV</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[["Present Today", present, "text-emerald-600"], ["Late Today", late, "text-orange-600"], ["Absent Today", rows.length - present - late - onLeave - excused, "text-red-600"], ["On Leave", onLeave, "text-purple-600"], ["Total Staff", rows.length, "text-blue-600"]].map(([label, value, color]) => <Card key={String(label)}><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">{label}</p><p className={`text-2xl font-bold ${color}`}>{value}</p></CardContent></Card>)}
      </div>
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="mb-4"><h2 className="font-semibold">Staff attendance by day</h2><p className="text-sm text-muted-foreground">Last seven days ending on the selected date.</p></div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="present" name="Present" fill="#16a34a" radius={[3, 3, 0, 0]} />
                <Bar dataKey="late" name="Late" fill="#ea580c" radius={[3, 3, 0, 0]} />
                <Bar dataKey="absent" name="Absent" fill="#dc2626" radius={[3, 3, 0, 0]} />
                <Bar dataKey="onLeave" name="Leave / excused" fill="#9333ea" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["7-day attendance rate", `${analysis.attendanceRate}%`, "text-emerald-600"],
          ["Late arrivals", analysis.late, "text-orange-600"],
          ["Absent records", analysis.absent, "text-red-600"],
          ["Strongest day", analysis.strongestDay, "text-primary"],
        ].map(([label, value, color]) => (
          <Card key={String(label)}><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">{label}</p><p className={`mt-1 text-xl font-bold ${color}`}>{value}</p></CardContent></Card>
        ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row"><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="sm:w-48" /><Input placeholder="Search staff name" value={search} onChange={(event) => setSearch(event.target.value)} className="sm:max-w-xs" /><Select value={role} onValueChange={setRole}><SelectTrigger className="sm:w-48"><SelectValue placeholder="Role" /></SelectTrigger><SelectContent><SelectItem value="all">All roles</SelectItem>{roles.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Select value={status} onValueChange={setStatus}><SelectTrigger className="sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent>{["all", "present", "late", "absent", "on_leave", "half_day"].map((item) => <SelectItem key={item} value={item}>{item === "all" ? "All statuses" : item.replace("_", " ")}</SelectItem>)}</SelectContent></Select></div>
      <Card><CardContent className="p-0">
        <div className="hidden overflow-x-auto md:block"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-4">Staff member</th><th className="p-4">Role</th><th className="p-4">Clock in</th><th className="p-4">Clock out</th><th className="p-4">Status</th><th className="p-4">Action</th></tr></thead><tbody>{visibleRows.map((row: any) => <tr className="border-b last:border-0" key={row.id}><td className="p-4 font-medium">{row.full_name}</td><td className="p-4 text-muted-foreground">{row.job_title || "Staff"}</td><td className="p-4">{formatTime(row.attendance?.clock_in_time)}</td><td className="p-4">{formatTime(row.attendance?.clock_out_time)}</td><td className="p-4"><Badge variant={row.attendance ? "default" : "destructive"}>{row.attendance?.status || "Absent"}</Badge></td><td className="p-4"><Button variant="ghost" size="icon" onClick={() => setViewing(row)} aria-label={`View ${row.full_name}`}><Eye className="size-4" /></Button>{canEdit && <Button variant="ghost" size="icon" onClick={() => openEdit(row)} aria-label={`Edit ${row.full_name}`}><Pencil className="size-4" /></Button>}</td></tr>)}</tbody></table></div>
        <div className="divide-y md:hidden">{visibleRows.map((row: any) => <div className="space-y-2 p-4" key={row.id}><div className="flex items-center justify-between"><span className="font-medium">{row.full_name}</span><Badge>{row.attendance?.status || "Absent"}</Badge></div><p className="text-sm text-muted-foreground">{row.job_title || "Staff"} · In: {formatTime(row.attendance?.clock_in_time)}</p></div>)}</div>
        {!visibleRows.length && <p className="p-8 text-center text-sm text-muted-foreground">No staff records found.</p>}
      </CardContent></Card>
      <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><p className="flex items-center gap-1"><Users className="size-4" /> {rows.length} staff record{rows.length === 1 ? "" : "s"} · page {page} of {pageCount}</p><div className="flex items-center gap-2"><Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}><SelectTrigger className="w-[110px] bg-card" aria-label="Rows per page"><SelectValue /></SelectTrigger><SelectContent>{[10, 25, 50, 100].map((size) => <SelectItem key={size} value={String(size)}>{size} / page</SelectItem>)}</SelectContent></Select><Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft className="size-4" /></Button><Button variant="outline" size="icon" disabled={page >= pageCount} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight className="size-4" /></Button></div></div>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}><DialogContent><DialogHeader><DialogTitle>Manage attendance{editing ? ` · ${editing.full_name}` : ""}</DialogTitle></DialogHeader><div className="space-y-4"><Select value={editForm.status} onValueChange={(value) => setEditForm({ ...editForm, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["present", "late", "absent", "on_leave", "excused", "half_day"].map((item) => <SelectItem key={item} value={item}>{item.replace("_", " ")}</SelectItem>)}</SelectContent></Select><div className="grid grid-cols-2 gap-3"><Input type="time" value={editForm.clockIn} onChange={(event) => setEditForm({ ...editForm, clockIn: event.target.value })} aria-label="Clock in time" /><Input type="time" value={editForm.clockOut} onChange={(event) => setEditForm({ ...editForm, clockOut: event.target.value })} aria-label="Clock out time" /></div><Textarea placeholder="Reason or note (required)" value={editForm.reason} onChange={(event) => setEditForm({ ...editForm, reason: event.target.value })} /><Button onClick={() => edit.mutate()} disabled={edit.isPending}>Save manual change</Button></div></DialogContent></Dialog>
      <HistoryDialog row={viewing} schoolId={school.schoolId} onClose={() => setViewing(null)} />
    </div>
  );
}

function HistoryDialog({ row, schoolId, onClose }: { row: any; schoolId: string | null; onClose: () => void }) {
  const history = useQuery({
    queryKey: ["staff-attendance-history", schoolId, row?.id],
    enabled: Boolean(row && schoolId),
    queryFn: async () => {
      const { data, error } = await table().select("attendance_date, status, clock_in_time, clock_out_time, hours_worked").eq("school_id", schoolId!).eq("staff_id", row.id).order("attendance_date", { ascending: false }).limit(31);
      if (error) throw error;
      return data ?? [];
    },
  });
  return <Dialog open={Boolean(row)} onOpenChange={(open) => !open && onClose()}><DialogContent><DialogHeader><DialogTitle>{row?.full_name} attendance history</DialogTitle></DialogHeader><div className="max-h-80 divide-y overflow-y-auto">{(history.data ?? []).map((item: any) => <div className="flex items-center justify-between gap-2 py-2 text-sm" key={item.attendance_date}><span>{item.attendance_date}</span><Badge className="capitalize">{String(item.status).replace("_", " ")}</Badge><span>{item.hours_worked ?? "-"}h</span></div>)}</div></DialogContent></Dialog>;
}
