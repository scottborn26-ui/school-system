import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  TrendingUp,
  User,
  Users,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/app-shell";
import { RequireSchool } from "@/components/require-school";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useSchool } from "@/hooks/use-school";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/attendance-analytics")({
  head: () => ({ meta: [{ title: "Attendance analytics · SHANSCOTT CBE" }] }),
  component: () => (
    <RequireSchool roles={["admin", "principal", "deputy", "super_admin"]}>
      <AttendanceAnalyticsPage />
    </RequireSchool>
  ),
});

type Scope = "school" | "grade" | "stream";
type AttendanceRow = {
  attendance_date: string;
  learner_id: string;
  stream_id: string;
  status: string;
  timetable_slot_id: string | null;
};

function AttendanceAnalyticsPage() {
  const school = useSchool();
  const schoolId = school.schoolId!;
  const [scope, setScope] = useState<Scope>("school");
  const [grade, setGrade] = useState("all");
  const [streamId, setStreamId] = useState("all");
  const [learnerId, setLearnerId] = useState("all");

  const data = useQuery({
    queryKey: ["attendance-analytics", schoolId, school.academicYearId],
    queryFn: async () => {
      const [records, streams, learners] = await Promise.all([
        supabase
          .from("attendance_records")
          .select(
            "attendance_date, learner_id, stream_id, status, timetable_slot_id"
          )
          .eq("school_id", schoolId)
          .eq("academic_year_id", school.academicYearId),
        supabase
          .from("streams")
          .select("id, name, grade")
          .eq("school_id", schoolId)
          .order("grade")
          .order("name"),
        supabase
          .from("learners")
          .select("id, first_name, last_name, current_grade, current_stream_id")
          .eq("school_id", schoolId)
          .eq("is_archived", false)
          .order("last_name"),
      ]);
      if (records.error) throw records.error;
      if (streams.error) throw streams.error;
      if (learners.error) throw learners.error;
      return {
        records: (records.data ?? []) as AttendanceRow[],
        streams: streams.data ?? [],
        learners: learners.data ?? [],
      };
    },
  });

  const streams = data.data?.streams ?? [];
  const learners = data.data?.learners ?? [];
  const filteredStreamIds = streams
    .filter((item) => grade === "all" || item.grade === grade)
    .map((item) => item.id);
  const learnerOptions = learners.filter(
    (item) => streamId === "all" || item.current_stream_id === streamId
  );

  const { chartData, chartLines, stats } = useMemo(() => {
    const records = (data.data?.records ?? []).filter((record) => {
      if (record.timetable_slot_id !== null) return false;
      if (
        grade !== "all" &&
        !streams.find(
          (stream) => stream.id === record.stream_id && stream.grade === grade
        )
      )
        return false;
      if (streamId !== "all" && record.stream_id !== streamId) return false;
      if (learnerId !== "all" && record.learner_id !== learnerId) return false;
      return true;
    });

    // Calculate overall stats
    const present = records.filter(
      (r) => r.status === "present" || r.status === "late"
    ).length;
    const absent = records.filter((r) => r.status === "absent").length;
    const excused = records.filter((r) => r.status === "excused").length;
    const total = records.length;
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

    // Build chart data
    const grouped = new Map<string, Map<string, { present: number; total: number }>>();
    const lineLabels = new Map<string, string>();

    for (const record of records) {
      const stream = streams.find((item) => item.id === record.stream_id);
      const key =
        learnerId !== "all"
          ? "learner"
          : scope === "school"
            ? "school"
            : scope === "grade"
              ? stream?.grade ?? "unknown"
              : record.stream_id;
      const label =
        learnerId !== "all"
          ? "Learner"
          : scope === "school"
            ? "Whole school"
            : scope === "grade"
              ? stream?.grade ?? "Unknown grade"
              : `${stream?.grade ?? ""} · ${stream?.name ?? "Unknown stream"}`;
      lineLabels.set(key, label);

      const byLine = grouped.get(record.attendance_date) ?? new Map();
      const current = byLine.get(key) ?? { present: 0, total: 0 };
      current.total += 1;
      if (record.status === "present" || record.status === "late")
        current.present += 1;
      byLine.set(key, current);
      grouped.set(record.attendance_date, byLine);
    }

    const chartData = [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, lines]) => ({
        date,
        ...Object.fromEntries(
          [...lines.entries()].map(([key, value]) => [
            key,
            Math.round((value.present / value.total) * 100),
          ])
        ),
      }));

    return {
      chartData,
      chartLines: [...lineLabels.entries()],
      stats: { present, absent, excused, total, attendanceRate },
    };
  }, [data.data?.records, grade, learnerId, scope, streamId, streams]);

  const selectedLearner = learners.find((learner) => learner.id === learnerId);
  const selectedStream = streams.find((stream) => stream.id === streamId);
  const scopeLabel =
    scope === "school"
      ? "Whole school"
      : scope === "grade"
        ? `${grade || "all grades"}`
        : selectedStream
          ? `${selectedStream.grade} · ${selectedStream.name}`
          : "Stream";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Analytics"
        description="Track full-day attendance trends across the school, by grade, by stream, and individual learners."
        icon={TrendingUp}
      />

      {/* Filters */}
      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-2 block">
              Report Scope
            </label>
            <Select value={scope} onValueChange={(value) => setScope(value as Scope)}>
              <SelectTrigger aria-label="Report scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="school">Whole school</SelectItem>
                <SelectItem value="grade">By grade</SelectItem>
                <SelectItem value="stream">By stream</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-2 block">
              Grade Filter
            </label>
            <Select
              value={grade}
              onValueChange={(value) => {
                setGrade(value);
                setStreamId("all");
              }}
            >
              <SelectTrigger aria-label="Grade filter">
                <SelectValue placeholder="All grades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All grades</SelectItem>
                {school.grades.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-2 block">
              Stream Filter
            </label>
            <Select
              value={streamId}
              onValueChange={setStreamId}
              disabled={scope === "school"}
            >
              <SelectTrigger aria-label="Stream filter">
                <SelectValue placeholder="All streams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All streams</SelectItem>
                {streams
                  .filter((item) => filteredStreamIds.includes(item.id))
                  .map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.grade} · {item.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-2 block">
              Track Learner
            </label>
            <Select value={learnerId} onValueChange={setLearnerId}>
              <SelectTrigger aria-label="Learner filter">
                <SelectValue placeholder="Track a learner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All learners</SelectItem>
                {learnerOptions.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.last_name}, {item.first_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      {stats.total > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex h-full min-h-[120px] flex-col justify-between p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">
                    Attendance Rate
                  </p>
                  <p className="mt-2 text-3xl font-bold">{stats.attendanceRate}%</p>
                </div>
                <div className="grid size-12 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <CheckCircle2 className="size-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Based on {stats.total} records
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex h-full min-h-[120px] flex-col justify-between p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">
                    Present / Late
                  </p>
                  <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {stats.present}
                  </p>
                </div>
                <div className="grid size-12 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <Users className="size-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex h-full min-h-[120px] flex-col justify-between p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Absent</p>
                  <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">
                    {stats.absent}
                  </p>
                </div>
                <div className="grid size-12 place-items-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <XCircle className="size-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex h-full min-h-[120px] flex-col justify-between p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Excused</p>
                  <p className="mt-2 text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {stats.excused}
                  </p>
                </div>
                <div className="grid size-12 place-items-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <AlertCircle className="size-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>
              {selectedLearner
                ? `${selectedLearner.first_name} ${selectedLearner.last_name}`
                : `${scopeLabel} attendance`}
            </CardTitle>
            <CardDescription>
              Full-day register completion over recorded dates.
            </CardDescription>
          </div>
          <Badge variant="secondary">
            <CalendarDays className="mr-1 size-3.5" /> {chartData.length} days
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="attendance-chart h-[400px] w-full">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "var(--color-text-secondary)" }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    unit="%"
                    tick={{ fill: "var(--color-text-secondary)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                    labelStyle={{ color: "var(--foreground)" }}
                    itemStyle={{ color: "var(--foreground)" }}
                    formatter={(value) => [`${value}%`, "Attendance"]}
                  />
                  {chartLines.map(([key, label], index) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      name={label}
                      stroke={
                        [
                          "#0f766e",
                          "#0891b2",
                          "#2563eb",
                          "#7c3aed",
                          "#db2777",
                        ][index % 5]
                      }
                      strokeWidth={3}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">
                No full-day attendance records match these filters.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
