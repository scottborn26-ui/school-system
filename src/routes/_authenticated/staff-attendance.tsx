import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Clock3, Download, Eye, Pencil, Users } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/staff-attendance")({
  component: () => (
    <RequireSchool roles={["admin", "principal", "deputy"]}>
      <StaffAttendanceAdminPage />
    </RequireSchool>
  ),
});

const table = () => (supabase as unknown as { from: (table: string) => any }).from("staff_attendance");

function formatTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-";
}

function formatCutoff(startTime: string | null | undefined, graceMinutes: number | null | undefined) {
  if (!startTime) return "the configured arrival time";
  const [hours, minutes] = startTime.split(":").map(Number);
  const cutoff = new Date(2000, 0, 1, hours, minutes + (graceMinutes ?? 0));
  return cutoff.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

  const result = useQuery({
    queryKey: ["staff-attendance-admin", school.schoolId, date],
    enabled: Boolean(school.schoolId),
    queryFn: async () => {
      const [staff, attendance, settings] = await Promise.all([
        supabase.from("staff").select("id, full_name, job_title, department_id, photo_url").eq("school_id", school.schoolId!).eq("is_archived", false).eq("status", "active").order("full_name"),
        table().select("*").eq("school_id", school.schoolId!).eq("attendance_date", date),
        supabase.from("school_settings").select("staff_attendance_start_time, staff_attendance_grace_minutes").eq("school_id", school.schoolId!).maybeSingle(),
      ]);
      if (staff.error) throw staff.error;
      if (attendance.error) throw attendance.error;
      if (settings.error) throw settings.error;
      return {
        rows: (staff.data ?? []).map((member: any) => ({ ...member, attendance: (attendance.data ?? []).find((row: any) => row.staff_id === member.id) })),
        settings: settings.data,
      };
    },
  });

  const allRows = result.data?.rows ?? [];
  const roles = [...new Set(allRows.map((row: any) => row.job_title || "Staff"))];
  const rows = allRows.filter((row: any) => row.full_name.toLowerCase().includes(search.trim().toLowerCase()) && (role === "all" || (row.job_title || "Staff") === role) && (status === "all" || (row.attendance?.status ?? "absent") === status));
  const present = allRows.filter((row: any) => row.attendance?.status === "present").length;
  const late = allRows.filter((row: any) => row.attendance?.status === "late").length;
  const onLeave = allRows.filter((row: any) => row.attendance?.status === "on_leave").length;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const cutoff = formatCutoff(result.data?.settings?.staff_attendance_start_time, result.data?.settings?.staff_attendance_grace_minutes);

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
        {[["Present Today", present, "text-emerald-600"], ["Late Today", late, "text-orange-600"], ["Absent Today", rows.length - present - late - onLeave, "text-red-600"], ["On Leave", onLeave, "text-purple-600"], ["Total Staff", rows.length, "text-blue-600"]].map(([label, value, color]) => <Card key={String(label)}><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">{label}</p><p className={`text-2xl font-bold ${color}`}>{value}</p></CardContent></Card>)}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row"><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="sm:w-48" /><Input placeholder="Search staff name" value={search} onChange={(event) => setSearch(event.target.value)} className="sm:max-w-xs" /><Select value={role} onValueChange={setRole}><SelectTrigger className="sm:w-48"><SelectValue placeholder="Role" /></SelectTrigger><SelectContent><SelectItem value="all">All roles</SelectItem>{roles.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Select value={status} onValueChange={setStatus}><SelectTrigger className="sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent>{["all", "present", "late", "absent", "on_leave", "half_day"].map((item) => <SelectItem key={item} value={item}>{item === "all" ? "All statuses" : item.replace("_", " ")}</SelectItem>)}</SelectContent></Select></div>
      <Card><CardContent className="p-0">
        <div className="hidden overflow-x-auto md:block"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-4">Staff member</th><th className="p-4">Role</th><th className="p-4">Clock in</th><th className="p-4">Clock out</th><th className="p-4">Status</th><th className="p-4">Action</th></tr></thead><tbody>{visibleRows.map((row: any) => <tr className="border-b last:border-0" key={row.id}><td className="p-4 font-medium">{row.full_name}</td><td className="p-4 text-muted-foreground">{row.job_title || "Staff"}</td><td className="p-4">{formatTime(row.attendance?.clock_in_time)}</td><td className="p-4">{formatTime(row.attendance?.clock_out_time)}</td><td className="p-4"><Badge variant={row.attendance ? "default" : "destructive"}>{row.attendance?.status || "Absent"}</Badge></td><td className="p-4"><Button variant="ghost" size="icon" onClick={() => setViewing(row)} aria-label={`View ${row.full_name}`}><Eye className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => openEdit(row)} aria-label={`Edit ${row.full_name}`}><Pencil className="size-4" /></Button></td></tr>)}</tbody></table></div>
        <div className="divide-y md:hidden">{visibleRows.map((row: any) => <div className="space-y-2 p-4" key={row.id}><div className="flex items-center justify-between"><span className="font-medium">{row.full_name}</span><Badge>{row.attendance?.status || "Absent"}</Badge></div><p className="text-sm text-muted-foreground">{row.job_title || "Staff"} · In: {formatTime(row.attendance?.clock_in_time)}</p></div>)}</div>
        {!visibleRows.length && <p className="p-8 text-center text-sm text-muted-foreground">No staff records found.</p>}
      </CardContent></Card>
      <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><p className="flex items-center gap-1"><Users className="size-4" /> {rows.length} staff record{rows.length === 1 ? "" : "s"} · page {page} of {pageCount}</p><div className="flex items-center gap-2"><Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}><SelectTrigger className="w-[110px] bg-card" aria-label="Rows per page"><SelectValue /></SelectTrigger><SelectContent>{[10, 25, 50, 100].map((size) => <SelectItem key={size} value={String(size)}>{size} / page</SelectItem>)}</SelectContent></Select><Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft className="size-4" /></Button><Button variant="outline" size="icon" disabled={page >= pageCount} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight className="size-4" /></Button></div></div>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}><DialogContent><DialogHeader><DialogTitle>Manage attendance{editing ? ` · ${editing.full_name}` : ""}</DialogTitle></DialogHeader><div className="space-y-4"><Select value={editForm.status} onValueChange={(value) => setEditForm({ ...editForm, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["present", "late", "absent", "on_leave", "half_day"].map((item) => <SelectItem key={item} value={item}>{item.replace("_", " ")}</SelectItem>)}</SelectContent></Select><div className="grid grid-cols-2 gap-3"><Input type="time" value={editForm.clockIn} onChange={(event) => setEditForm({ ...editForm, clockIn: event.target.value })} aria-label="Clock in time" /><Input type="time" value={editForm.clockOut} onChange={(event) => setEditForm({ ...editForm, clockOut: event.target.value })} aria-label="Clock out time" /></div><Textarea placeholder="Reason or note (required)" value={editForm.reason} onChange={(event) => setEditForm({ ...editForm, reason: event.target.value })} /><Button onClick={() => edit.mutate()} disabled={edit.isPending}>Save manual change</Button></div></DialogContent></Dialog>
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
