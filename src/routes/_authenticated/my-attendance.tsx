import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarCheck2 } from "lucide-react";
import { RequireSchool } from "@/components/require-school";
import { AttendanceClockCard } from "@/components/attendance-clock-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useSchool } from "@/hooks/use-school";

export const Route = createFileRoute("/_authenticated/my-attendance")({ component: () => <RequireSchool><MyAttendancePage /></RequireSchool> });
const table = () => (supabase as unknown as { from: (table: string) => any }).from("staff_attendance");
function MyAttendancePage() {
  const school = useSchool();
  const [month, setMonth] = useState(new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date()).slice(0, 7));
  const [year, monthNumber] = month.split("-").map(Number);
  const nextMonth = `${monthNumber === 12 ? year + 1 : year}-${String(monthNumber === 12 ? 1 : monthNumber + 1).padStart(2, "0")}-01`;
  const rows = useQuery({ queryKey: ["my-staff-attendance", school.schoolId, school.userId, month], enabled: Boolean(school.schoolId && school.userId), queryFn: async () => {
    const { data: staff } = await supabase.from("staff").select("id").eq("school_id", school.schoolId!).eq("user_id", school.userId!).maybeSingle();
    if (!staff) return [];
    const { data, error } = await table().select("*").eq("school_id", school.schoolId!).eq("staff_id", staff.id).gte("attendance_date", `${month}-01`).lt("attendance_date", nextMonth).order("attendance_date", { ascending: false });
    if (error) throw error; return data ?? [];
  }});
  const data = rows.data ?? [];
  const present = data.filter((row: any) => row.status === "present").length;
  const late = data.filter((row: any) => row.status === "late").length;
  const absent = data.filter((row: any) => row.status === "absent").length;
  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString([], { month: "long", year: "numeric" });
  return <div className="mx-auto max-w-5xl space-y-5 pb-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight">My Attendance</h1><p className="text-sm text-muted-foreground">Your attendance record for {monthLabel}.</p></div><label className="flex items-center gap-2 text-sm font-medium">Month <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="rounded-md border bg-background px-3 py-2" /></label></div><AttendanceClockCard /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Present</p><p className="text-2xl font-bold">{present}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Late</p><p className="text-2xl font-bold text-orange-600">{late}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Absent</p><p className="text-2xl font-bold text-red-600">{absent}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Attendance rate</p><p className="text-2xl font-bold">{data.length ? Math.round(((present + late) / data.length) * 100) : 0}%</p></CardContent></Card></div><Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarCheck2 className="size-5 text-primary" />Attendance history</CardTitle></CardHeader><CardContent><div className="divide-y">{data.length ? data.map((row: any) => <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm" key={row.id}><span className="font-medium">{row.attendance_date}</span><span>{row.clock_in_time ? new Date(row.clock_in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}</span><span>{row.clock_out_time ? new Date(row.clock_out_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}</span><span>{row.hours_worked ? `${row.hours_worked}h` : "-"}</span><span className="capitalize">{String(row.status).replace("_", " ")}</span></div>) : <p className="py-6 text-sm text-muted-foreground">No attendance has been recorded this month.</p>}</div></CardContent></Card></div>;
}
