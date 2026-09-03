import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, LogIn, LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useSchool } from "@/hooks/use-school";

const attendanceTable = () => (supabase as unknown as { from: (table: string) => any }).from("staff_attendance");

export function AttendanceClockCard() {
  const school = useSchool();
  const schoolId = school.schoolId;
  const localToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date());
  const qc = useQueryClient();
  const today = localToday;
  const [reason, setReason] = useState("");
  const settings = useQuery({
    queryKey: ["staff-attendance-settings", schoolId],
    enabled: Boolean(schoolId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_settings")
        .select("staff_attendance_start_time, staff_attendance_grace_minutes, staff_attendance_enabled, staff_attendance_require_late_reason")
        .eq("school_id", schoolId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const attendance = useQuery({
    queryKey: ["my-staff-attendance-today", schoolId, school.userId, today],
    enabled: Boolean(schoolId && school.userId),
    queryFn: async () => {
      const { data: staff } = await supabase.from("staff").select("id").eq("school_id", schoolId!).eq("user_id", school.userId!).maybeSingle();
      if (!staff) return null;
      const { data, error } = await attendanceTable().select("*").eq("school_id", schoolId!).eq("staff_id", staff.id).eq("attendance_date", today).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const clock = useMutation({
    mutationFn: async (action: "in" | "out") => {
      const { data, error } = action === "in"
        ? await supabase.rpc("clock_staff_in", { _school_id: schoolId!, _reason: reason.trim() || null })
        : await supabase.rpc("clock_staff_out", { _school_id: schoolId! });
      if (error) throw error;
      return data;
    },
    onSuccess: (record) => {
      qc.setQueryData(["my-staff-attendance-today", schoolId, school.userId, today], record);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["my-staff-attendance-today"] });
      void qc.invalidateQueries({ queryKey: ["my-staff-attendance"] });
      toast.success("Attendance updated.", {
        description: "Your attendance record was saved successfully.",
        referenceId: record?.id,
        timestamp: record?.clock_out_time ?? record?.clock_in_time,
      });
    },
    onError: (error: Error) => toast.error(error.message || "Attendance could not be updated."),
  });
  const record = attendance.data;
  const clockIn = record?.clock_in_time ? new Date(record.clock_in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
  const clockOut = record?.clock_out_time ? new Date(record.clock_out_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
  const cutoff = settings.data?.staff_attendance_start_time
    ? (() => { const [hours, minutes] = settings.data.staff_attendance_start_time.split(":").map(Number); return hours * 60 + minutes + (settings.data.staff_attendance_grace_minutes ?? 0); })()
    : null;
  const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const mayBeLate = cutoff !== null && currentMinutes > cutoff;
  const worked = record?.hours_worked == null ? null : `${Math.floor(Number(record.hours_worked))}h ${Math.round((Number(record.hours_worked) % 1) * 60)}m`;
  return <Card className="rounded-xl border-primary/20 bg-primary/[0.03]"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Clock3 className="size-5 text-primary" /> My Attendance <Badge variant="outline" className="ml-auto">{new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</Badge></CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap items-center gap-2 text-sm">{!record ? <Badge variant="secondary">Not Marked</Badge> : record.status === "late" ? <Badge className="bg-orange-100 text-orange-700">Late</Badge> : <Badge className="bg-emerald-100 text-emerald-700">On Time</Badge>} {clockIn && <span>Clocked in at <strong>{clockIn}</strong></span>} {clockOut && <span>Clocked out at <strong>{clockOut}</strong>{worked ? ` · Worked: ${worked}` : ""}</span>}</div>{!record && mayBeLate && <p className="text-xs text-orange-700">You are clocking in after the configured arrival time.</p>}{!clockIn && mayBeLate && <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for lateness (optional)" className="w-full rounded-md border bg-background px-3 py-2 text-sm" />}{!clockIn && settings.data?.staff_attendance_require_late_reason && mayBeLate && <p className="text-xs text-muted-foreground">A reason is required by your school.</p>}<div className="flex gap-2"><Button onClick={() => clock.mutate("in")} disabled={Boolean(clockIn) || clock.isPending || (Boolean(settings.data?.staff_attendance_require_late_reason && mayBeLate) && !reason.trim())}><LogIn className="mr-2 size-4" />Clock In</Button><Button variant="secondary" onClick={() => clock.mutate("out")} disabled={!clockIn || Boolean(clockOut) || clock.isPending}><LogOut className="mr-2 size-4" />Clock Out</Button></div></CardContent></Card>;
}
