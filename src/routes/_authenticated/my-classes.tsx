import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Calendar,
  CalendarCheck2,
  CheckCircle2,
  Users,
  BookOpen,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/app-shell";
import { RequireSchool } from "@/components/require-school";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSchool } from "@/hooks/use-school";
import { supabase } from "@/lib/supabase";
import { GRADE_LABELS, type CbeGrade } from "@/lib/cbe";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/my-classes")({
  head: () => ({
    meta: [
      { title: "My Classes · SHANSCOTT CBE" },
      {
        name: "description",
        content: "View learners in your classes, mark attendance, and manage your streams.",
      },
    ],
  }),
  component: () => (
    <RequireSchool roles={["teacher", "class_teacher"]}>
      <MyClassesPage />
    </RequireSchool>
  ),
});

type Stream = {
  id: string;
  name: string;
  grade: CbeGrade;
  class_teacher_id: string | null;
};

type Learner = {
  id: string;
  admission_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  gender: string | null;
  current_grade: string;
};

type AttendanceRecord = {
  learner_id: string;
  status: "present" | "absent" | "late" | "excused";
  attendance_date: string;
};

type TeacherAllocation = {
  id: string;
  stream_id: string;
  learning_area_id: string;
  learning_areas: { name: string } | null;
};

function MyClassesPage() {
  const school = useSchool();
  const schoolId = school.schoolId!;
  const [selectedStreamId, setSelectedStreamId] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const today = new Date().toISOString().slice(0, 10);

  // Fetch teacher's streams and allocations
  const teacherStreams = useQuery({
    queryKey: ["teacher-my-classes-streams", schoolId, school.userId],
    queryFn: async () => {
      const { data: staffRecord, error: staffError } = await supabase
        .from("staff")
        .select("id")
        .eq("school_id", schoolId)
        .eq("user_id", school.userId)
        .eq("is_archived", false)
        .eq("status", "active")
        .maybeSingle();
      if (staffError) throw staffError;
      if (!staffRecord) return { staffId: null, streams: [] };

      // Get class teacher streams
      const { data: classTeacherStreams, error: classTeacherError } = await supabase
        .from("streams")
        .select("id, name, grade, class_teacher_id")
        .eq("school_id", schoolId)
        .eq("class_teacher_id", staffRecord.id)
        .eq("is_active", true)
        .order("grade")
        .order("name");
      if (classTeacherError) throw classTeacherError;

      // Get teaching assignment streams
      const { data: allocations, error: allocError } = await supabase
        .from("teacher_allocations")
        .select("stream_id, streams(id, name, grade, class_teacher_id)")
        .eq("school_id", schoolId)
        .eq("staff_id", staffRecord.id)
        .eq("is_active", true)
        .or(`academic_year_id.is.null,academic_year_id.eq.${school.academicYearId}`);
      if (allocError) throw allocError;

      // Combine and deduplicate streams
      const streamIds = new Set<string>();
      const streamMap = new Map<string, Stream>();

      // Add class teacher streams
      for (const stream of classTeacherStreams ?? []) {
        if (!streamIds.has(stream.id)) {
          streamIds.add(stream.id);
          streamMap.set(stream.id, stream);
        }
      }

      // Add allocated teaching streams
      for (const allocation of allocations ?? []) {
        const stream = allocation.streams as Stream;
        if (stream && !streamIds.has(stream.id)) {
          streamIds.add(stream.id);
          streamMap.set(stream.id, stream);
        }
      }

      return {
        staffId: staffRecord.id,
        streams: Array.from(streamMap.values()).sort((a, b) =>
          `${a.grade} ${a.name}`.localeCompare(`${b.grade} ${b.name}`)
        ),
      };
    },
  });

  // Fetch learners for selected stream
  const streamLearners = useQuery({
    queryKey: ["my-classes-learners", schoolId, selectedStreamId],
    enabled: Boolean(selectedStreamId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learners")
        .select("id, admission_number, first_name, middle_name, last_name, gender, current_grade")
        .eq("school_id", schoolId)
        .eq("current_stream_id", selectedStreamId)
        .eq("is_archived", false)
        .eq("status", "active")
        .order("last_name")
        .order("first_name");
      if (error) throw error;
      return (data ?? []) as Learner[];
    },
  });

  // Fetch teacher allocations for selected stream
  const teacherAllocations = useQuery({
    queryKey: [
      "my-classes-allocations",
      schoolId,
      selectedStreamId,
      teacherStreams.data?.staffId,
    ],
    enabled: Boolean(selectedStreamId && teacherStreams.data?.staffId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_allocations")
        .select("id, stream_id, learning_area_id, learning_areas(name)")
        .eq("school_id", schoolId)
        .eq("stream_id", selectedStreamId)
        .eq("staff_id", teacherStreams.data!.staffId)
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as TeacherAllocation[];
    },
  });

  // Fetch attendance for the selected stream (today)
  const streamAttendance = useQuery({
    queryKey: ["my-classes-attendance-today", schoolId, selectedStreamId, today],
    enabled: Boolean(selectedStreamId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("learner_id, status, attendance_date, timetable_slot_id")
        .eq("school_id", schoolId)
        .eq("stream_id", selectedStreamId)
        .eq("attendance_date", today)
        .is("timetable_slot_id", null); // Full-day attendance only
      if (error) throw error;
      return (data ?? []) as AttendanceRecord[];
    },
  });

  // Auto-select first stream if available
  if (
    teacherStreams.data?.streams.length &&
    !selectedStreamId &&
    teacherStreams.isFetched
  ) {
    setSelectedStreamId(teacherStreams.data.streams[0].id);
  }

  const selectedStream = teacherStreams.data?.streams.find((s) => s.id === selectedStreamId);
  const learners = streamLearners.data ?? [];
  const allocations = teacherAllocations.data ?? [];

  // Calculate attendance stats
  const attendanceStats = useMemo(() => {
    const records = streamAttendance.data ?? [];
    const attendanceMap = new Map(records.map((r) => [r.learner_id, r.status]));

    const present = records.filter((r) => ["present", "late"].includes(r.status)).length;
    const absent = records.filter((r) => r.status === "absent").length;
    const excused = records.filter((r) => r.status === "excused").length;
    const notMarked = learners.length - records.length;

    return {
      attendanceMap,
      present,
      absent,
      excused,
      notMarked,
      total: learners.length,
      percentage: learners.length ? Math.round((present / learners.length) * 100) : 0,
    };
  }, [streamAttendance.data, learners.length]);

  const isClassTeacher = selectedStream?.class_teacher_id === teacherStreams.data?.staffId;
  const isAssignedTeacher = allocations.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Classes"
        description="View and manage learners in your assigned classes, mark attendance, and track performance."
        icon={Users}
      />

      {/* Stream Selection */}
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-[1fr_auto_auto]">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Select class
            </label>
            <Select value={selectedStreamId} onValueChange={setSelectedStreamId}>
              <SelectTrigger aria-label="Select stream">
                <SelectValue placeholder="Choose a class..." />
              </SelectTrigger>
              <SelectContent>
                {teacherStreams.data?.streams.map((stream) => (
                  <SelectItem key={stream.id} value={stream.id}>
                    <div className="flex items-center gap-2">
                      {stream.class_teacher_id === teacherStreams.data?.staffId && (
                        <Badge variant="secondary" className="mr-1">
                          Class Teacher
                        </Badge>
                      )}
                      {stream.grade} · {stream.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedStream && (
            <>
              <Button asChild variant="default" size="sm">
                <Link to={`/attendance?stream=${selectedStreamId}`}>
                  <CalendarCheck2 className="mr-2 size-4" />
                  Mark Attendance
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/my-teaching">
                  <BookOpen className="mr-2 size-4" />
                  My Teaching
                </Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Attendance Overview */}
      {selectedStream && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Attendance Overview</CardTitle>
                <CardDescription>
                  Full-day attendance for{" "}
                  {GRADE_LABELS[selectedStream.grade as CbeGrade] || selectedStream.grade} ·{" "}
                  {selectedStream.name}
                </CardDescription>
              </div>
              <Badge
                variant="secondary"
                className={cn(
                  attendanceStats.percentage >= 75
                    ? "bg-emerald-100 text-emerald-700"
                    : attendanceStats.percentage >= 50
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                )}
              >
                {attendanceStats.percentage}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/40 dark:bg-emerald-950/30">
                <p className="text-sm text-muted-foreground">Present / Late</p>
                <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {attendanceStats.present}
                </p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800/40 dark:bg-red-950/30">
                <p className="text-sm text-muted-foreground">Absent</p>
                <p className="mt-1 text-2xl font-bold text-red-700 dark:text-red-400">
                  {attendanceStats.absent}
                </p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800/40 dark:bg-blue-950/30">
                <p className="text-sm text-muted-foreground">Excused</p>
                <p className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-400">
                  {attendanceStats.excused}
                </p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/40 dark:bg-amber-950/30">
                <p className="text-sm text-muted-foreground">Not Marked</p>
                <p className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-400">
                  {attendanceStats.notMarked}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Learners Table */}
      {selectedStream && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-4">
            <div>
              <CardTitle className="text-lg">
                Learners ({learners.length})
              </CardTitle>
              <CardDescription>
                All active learners in {selectedStream.grade} · {selectedStream.name}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "table" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("table")}
              >
                Table
              </Button>
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
              >
                Grid
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {learners.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <AlertCircle className="mx-auto mb-2 size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No active learners in this class.
                </p>
              </div>
            ) : viewMode === "table" ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Admission #</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-center">Attendance</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {learners.map((learner) => {
                      const attendanceStatus =
                        attendanceStats.attendanceMap.get(learner.id);
                      return (
                        <TableRow key={learner.id}>
                          <TableCell className="font-medium text-sm">
                            {learner.admission_number}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {learner.first_name} {learner.last_name}
                              </p>
                              {learner.middle_name && (
                                <p className="text-xs text-muted-foreground">
                                  {learner.middle_name}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {attendanceStatus ? (
                              <Badge
                                variant="secondary"
                                className={
                                  attendanceStatus === "present" ||
                                  attendanceStatus === "late"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : attendanceStatus === "absent"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-blue-100 text-blue-700"
                                }
                              >
                                {attendanceStatus.charAt(0).toUpperCase() +
                                  attendanceStatus.slice(1)}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600">
                                Not marked
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {learner.gender && (
                              <span className="text-sm text-muted-foreground capitalize">
                                {learner.gender}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {learners.map((learner) => {
                  const attendanceStatus =
                    attendanceStats.attendanceMap.get(learner.id);
                  return (
                    <div
                      key={learner.id}
                      className="rounded-lg border border-border bg-card p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm">
                            {learner.first_name} {learner.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {learner.admission_number}
                          </p>
                        </div>
                        {attendanceStatus && (
                          <Badge
                            variant="secondary"
                            className={
                              attendanceStatus === "present" ||
                              attendanceStatus === "late"
                                ? "bg-emerald-100 text-emerald-700"
                                : attendanceStatus === "absent"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-blue-100 text-blue-700"
                            }
                          >
                            {attendanceStatus.charAt(0).toUpperCase() +
                              attendanceStatus.slice(1)}
                          </Badge>
                        )}
                      </div>
                      {learner.middle_name && (
                        <p className="text-xs text-muted-foreground mb-2">
                          {learner.middle_name}
                        </p>
                      )}
                      {learner.gender && (
                        <p className="text-xs text-muted-foreground capitalize">
                          {learner.gender}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Teaching Allocations */}
      {selectedStream && allocations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Learning Areas</CardTitle>
            <CardDescription>
              Subjects you teach in {selectedStream.grade} · {selectedStream.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {allocations.map((allocation) => (
                <div
                  key={allocation.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="size-4 text-primary" />
                    <span className="font-medium text-sm">
                      {allocation.learning_areas?.name ?? "Learning Area"}
                    </span>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/attendance?stream=${selectedStreamId}&area=${allocation.learning_area_id}`}>
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help Section */}
      {selectedStream && !isClassTeacher && !isAssignedTeacher && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-900 dark:text-amber-300">
                  No assignments yet
                </h3>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-400">
                  You haven't been assigned as a class teacher or allocated any learning
                  areas for this class yet. Contact your school administrator to get
                  started.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
