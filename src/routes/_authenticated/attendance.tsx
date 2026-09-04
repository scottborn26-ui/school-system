import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck2, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { RequireSchool } from "@/components/require-school";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSchool } from "@/hooks/use-school";
import {
  formatLessonOptionLabel,
  getAttendanceDayOfWeek,
  type AttendanceStatus,
} from "@/lib/attendance";
import { supabase } from "@/lib/supabase";

type SearchParams = {
  stream?: string;
  area?: string;
};

export const Route = createFileRoute("/_authenticated/attendance")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    stream: search.stream as string | undefined,
    area: search.area as string | undefined,
  }),
  head: () => ({
    meta: [
      { title: "Attendance · SHANSCOTT CBE" },
      { name: "description", content: "Record and review daily learner attendance by class." },
    ],
  }),
  component: () => (
    <RequireSchool roles={["principal", "deputy", "teacher", "class_teacher", "super_admin"]}>
      <AttendancePage />
    </RequireSchool>
  ),
});

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  excused: "Excused",
};

const STATUS_TONES: Record<
  AttendanceStatus,
  {
    badge: string;
    button: string;
    indicator: string;
  }
> = {
  present: {
    badge: "border-transparent bg-emerald-500 text-white shadow hover:bg-emerald-500/90",
    button:
      "data-[state=on]:bg-emerald-100 data-[state=on]:text-emerald-900 data-[state=on]:border-emerald-200 data-[state=off]:text-emerald-700 data-[state=off]:hover:bg-emerald-50",
    indicator: "bg-emerald-500",
  },
  absent: {
    badge: "border-transparent bg-red-500 text-white shadow hover:bg-red-500/90",
    button:
      "data-[state=on]:bg-red-100 data-[state=on]:text-red-900 data-[state=on]:border-red-200 data-[state=off]:text-red-700 data-[state=off]:hover:bg-red-50",
    indicator: "bg-red-500",
  },
  late: {
    badge: "border-transparent bg-amber-500 text-white shadow hover:bg-amber-500/90",
    button:
      "data-[state=on]:bg-amber-100 data-[state=on]:text-amber-900 data-[state=on]:border-amber-200 data-[state=off]:text-amber-700 data-[state=off]:hover:bg-amber-50",
    indicator: "bg-amber-500",
  },
  excused: {
    badge: "border-transparent bg-sky-600 text-white shadow hover:bg-sky-600/90",
    button:
      "data-[state=on]:bg-sky-100 data-[state=on]:text-sky-900 data-[state=on]:border-sky-200 data-[state=off]:text-sky-700 data-[state=off]:hover:bg-sky-50",
    indicator: "bg-sky-600",
  },
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function AttendancePage() {
  const school = useSchool();
  const queryClient = useQueryClient();
  const schoolId = school.schoolId!;
  const { stream: urlStreamId, area: urlAreaId } = useSearch({
    from: "/_authenticated/attendance",
  });
  const isTeacherScoped =
    school.can("teacher", "class_teacher") &&
    !school.can("principal", "deputy", "super_admin", "admin");
  const [streamId, setStreamId] = useState(urlStreamId ?? "");
  const [attendanceMode, setAttendanceMode] = useState<"full_day" | "lesson">("lesson");
  const [learningAreaId, setLearningAreaId] = useState(urlAreaId ?? "");
  const [slotId, setSlotId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(today);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const attendanceDay = getAttendanceDayOfWeek(attendanceDate);

  const teacherStreamIds = useQuery({
    queryKey: ["teacher-attendance-streams", schoolId, school.userId],
    enabled: isTeacherScoped,
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
      if (!staffRecord) return { staffId: null, streamIds: [] as string[] };

      const { data, error } = await supabase
        .from("teacher_allocations")
        .select("stream_id")
        .eq("school_id", schoolId)
        .eq("staff_id", staffRecord.id)
        .or(`academic_year_id.is.null,academic_year_id.eq.${school.academicYearId}`)
        .eq("is_active", true);
      if (error) throw error;
      const { data: classTeacherStreams, error: classTeacherError } = await supabase
        .from("streams")
        .select("id")
        .eq("school_id", schoolId)
        .eq("class_teacher_id", staffRecord.id)
        .eq("is_active", true);
      if (classTeacherError) throw classTeacherError;
      return {
        staffId: staffRecord.id,
        streamIds: [
          ...new Set([
            ...(data ?? []).map((row) => row.stream_id),
            ...(classTeacherStreams ?? []).map((row) => row.id),
          ]),
        ],
        classTeacherStreamIds: (classTeacherStreams ?? []).map((row) => row.id),
      };
    },
  });

  const streams = useQuery({
    queryKey: [
      "attendance-streams",
      schoolId,
      school.academicYearId,
      isTeacherScoped ? teacherStreamIds.data?.staffId ?? "teacher" : "all",
    ],
    enabled: !isTeacherScoped || teacherStreamIds.isFetched,
    queryFn: async () => {
      let query = supabase
        .from("streams")
        .select("id, name, grade")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("grade")
        .order("name");

      if (isTeacherScoped) {
        const ids = teacherStreamIds.data?.streamIds ?? [];
        if (!ids.length) return [];
        query = query.in("id", ids);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const learners = useQuery({
    queryKey: ["attendance-learners", schoolId, streamId],
    enabled: Boolean(streamId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learners")
        .select("id, admission_number, first_name, middle_name, last_name")
        .eq("school_id", schoolId)
        .eq("current_stream_id", streamId)
        .eq("is_archived", false)
        .eq("status", "active")
        .order("last_name")
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const lessonOptions = useQuery({
    queryKey: [
      "attendance-lessons",
      schoolId,
      streamId,
      learningAreaId,
      attendanceDate,
      attendanceDay,
      teacherStreamIds.data?.staffId ?? "all",
    ],
    enabled: Boolean(
      streamId &&
        learningAreaId &&
        attendanceDate &&
        attendanceDay &&
        (!isTeacherScoped || teacherStreamIds.data?.staffId),
    ),
    queryFn: async () => {
      let query = supabase
        .from("timetable_slots")
        .select(
          "id, stream_id, learning_area_id, day_of_week, period_index, timetable_id, timetables!inner(id, status, academic_year_id, term_id)",
        )
        .eq("school_id", schoolId)
        .eq("stream_id", streamId)
        .eq("learning_area_id", learningAreaId)
        .eq("day_of_week", attendanceDay)
        .order("period_index");
      if (isTeacherScoped && teacherStreamIds.data?.staffId) {
        query = query.eq("staff_id", teacherStreamIds.data.staffId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const lessonPeriodMetadata = useQuery({
    queryKey: ["attendance-lesson-periods", schoolId, lessonOptions.data?.map((item) => item.period_index).join("|") ?? ""],
    enabled: Boolean(lessonOptions.data?.length),
    queryFn: async () => {
      const periodIndexes = Array.from(
        new Set((lessonOptions.data ?? []).map((item) => item.period_index)),
      );
      if (!periodIndexes.length) return [];

      const { data, error } = await supabase
        .from("timetable_periods")
        .select("period_index, label, start_time, end_time")
        .eq("school_id", schoolId)
        .in("period_index", periodIndexes)
        .order("period_index");
      if (error) throw error;
      return data;
    },
  });

  const allocations = useQuery({
    queryKey: [
      "attendance-allocations",
      schoolId,
      streamId,
      school.academicYearId,
      teacherStreamIds.data?.staffId ?? "all",
    ],
    enabled: Boolean(streamId && (!isTeacherScoped || teacherStreamIds.data?.staffId)),
    queryFn: async () => {
      let query = supabase
        .from("teacher_allocations")
        .select("id, stream_id, learning_area_id, learning_areas(name)")
        .eq("school_id", schoolId)
        .eq("stream_id", streamId)
        .or(`academic_year_id.is.null,academic_year_id.eq.${school.academicYearId}`)
        .eq("is_active", true);
      if (isTeacherScoped && teacherStreamIds.data?.staffId) {
        query = query.eq("staff_id", teacherStreamIds.data.staffId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const records = useQuery({
    queryKey: ["attendance-records", schoolId, streamId, slotId, attendanceDate],
    enabled: Boolean(streamId && attendanceDate),
    queryFn: async () => {
      let query = supabase
        .from("attendance_records")
        .select("id, learner_id, timetable_slot_id, status")
        .eq("school_id", schoolId)
        .eq("stream_id", streamId)
        .eq("attendance_date", attendanceDate);
      query = slotId
        ? query.eq("timetable_slot_id", slotId)
        : query.is("timetable_slot_id", null);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const assignedStreamIds = teacherStreamIds.data?.streamIds;
    if (isTeacherScoped && streamId && assignedStreamIds && !assignedStreamIds.includes(streamId)) {
      setStreamId(assignedStreamIds[0] ?? "");
    }
  }, [isTeacherScoped, streamId, teacherStreamIds.data?.streamIds]);

  useEffect(() => {
    if (!streamId || !isTeacherScoped || !teacherStreamIds.data) return;
    const isClassTeacherStream = teacherStreamIds.data.classTeacherStreamIds.includes(streamId);
    setAttendanceMode(isClassTeacherStream ? "full_day" : "lesson");
    setLearningAreaId(isClassTeacherStream ? "" : urlAreaId ?? "");
    setSlotId("");
  }, [isTeacherScoped, streamId, teacherStreamIds.data, urlAreaId]);

  useEffect(() => {
    setSlotId("");
    setLearningAreaId("");
  }, [streamId]);

  useEffect(() => {
    if (
      learningAreaId &&
      allocations.data &&
      !allocations.data.some((allocation) => allocation.learning_area_id === learningAreaId)
    ) {
      setLearningAreaId("");
    }
  }, [allocations.data, learningAreaId]);

  const baselineStatuses = useMemo(() => {
    const next = Object.fromEntries(
      (records.data ?? []).map((record) => [record.learner_id, record.status as AttendanceStatus]),
    );
    for (const learner of learners.data ?? []) {
      if (!(learner.id in next)) next[learner.id] = "present";
    }
    return next;
  }, [learners.data, records.data]);

  useEffect(() => {
    setStatuses((current) => {
      const next = { ...current };
      for (const learner of learners.data ?? []) {
        if (next[learner.id] === undefined) {
          next[learner.id] = baselineStatuses[learner.id] ?? "present";
        }
      }
      return next;
    });
  }, [baselineStatuses, learners.data]);

  const learnerRows = learners.data ?? [];
  const hasUnsavedChanges = learnerRows.some(
    (learner) => (statuses[learner.id] ?? "present") !== (baselineStatuses[learner.id] ?? "present"),
  );
  const canSaveRegister =
    learnerRows.length > 0 &&
    (hasUnsavedChanges || (attendanceMode === "full_day" && Boolean(streamId)));

  const counts = (Object.keys(STATUS_LABELS) as AttendanceStatus[]).map((status) => ({
    status,
    count: learnerRows.filter((learner) => (statuses[learner.id] ?? "present") === status).length,
  }));

  const save = useMutation({
    mutationFn: async () => {
      if (!streamId || !attendanceDate) {
        throw new Error("Select a class and attendance date first.");
      }
      const isFullDay = attendanceMode === "full_day";
      if (!isFullDay && (!learningAreaId || !slotId)) {
        throw new Error("Select a learning area and lesson first.");
      }
      const lesson = (lessonOptions.data ?? []).find((option) => option.id === slotId);
      if (!isFullDay && !lesson) throw new Error("That lesson is not in your assigned timetable.");
      const allocation = (allocations.data ?? []).find(
        (item) => item.learning_area_id === lesson?.learning_area_id,
      );
      if (!isFullDay && !allocation) throw new Error("That lesson has no active teacher assignment.");
      const rows = (learners.data ?? []).map((learner) => ({
        school_id: schoolId,
        academic_year_id: school.academicYearId,
        term_id: school.termId,
        stream_id: streamId,
        learner_id: learner.id,
        attendance_date: attendanceDate,
        status: statuses[learner.id] ?? "present",
        marked_by: school.userId,
        timetable_slot_id: isFullDay ? null : lesson?.id,
        teacher_allocation_id: isFullDay ? null : allocation?.id,
      }));
      if (rows.length === 0) throw new Error("This class has no active learners.");
      for (const row of rows) {
        const existing = (records.data ?? []).find(
          (record) =>
            record.learner_id === row.learner_id &&
            record.timetable_slot_id === row.timetable_slot_id,
        );
        const request = existing
          ? supabase.from("attendance_records").update(row).eq("id", existing.id)
          : supabase.from("attendance_records").insert(row);
        const { error } = await request;
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Attendance saved successfully.");
      void queryClient.invalidateQueries({
        queryKey: ["attendance-records", schoolId, streamId],
      });
    },
    onError: (error: Error) =>
      toast.error("Attendance was not saved.", { description: error.message }),
  });

  const lessonsByPeriod = useMemo(
    () =>
      Object.fromEntries(
        (lessonPeriodMetadata.data ?? []).map((period) => [
          period.period_index,
          { label: period.label, start_time: period.start_time, end_time: period.end_time },
        ]),
      ),
    [lessonPeriodMetadata.data],
  );

  const selectedLearningAreaName =
    (allocations.data ?? []).find(
      (allocation) => allocation.learning_area_id === learningAreaId,
    )?.learning_areas?.name ?? "Learning area";

  useEffect(() => {
    if (!learningAreaId || !attendanceDate || !lessonOptions.data) return;
    if (lessonOptions.data.length === 1 && !slotId) {
      setSlotId(lessonOptions.data[0].id);
    }
  }, [attendanceDate, learningAreaId, lessonOptions.data, slotId]);

  useEffect(() => {
    setSlotId("");
  }, [streamId, learningAreaId, attendanceDate]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance register"
        description="Mark the daily register for an active class."
        icon={CalendarCheck2}
        actions={
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <span className="text-xs font-medium uppercase tracking-wide text-amber-600">
                Unsaved changes
              </span>
            )}
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !streamId || (attendanceMode === "lesson" && (!learningAreaId || !slotId)) || !canSaveRegister}
              variant={canSaveRegister ? "default" : "secondary"}
            >
              <Save className="mr-2 size-4" />
              {save.isPending ? "Saving…" : "Save register"}
            </Button>
          </div>
        }
      />
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_minmax(0,1.5fr)_180px]">
          <Select
            value={streamId}
            onValueChange={(value) => {
              setStreamId(value);
              if (isTeacherScoped && !teacherStreamIds.data?.classTeacherStreamIds.includes(value)) {
                setAttendanceMode("lesson");
              }
            }}
          >
            <SelectTrigger aria-label="Class">
              <SelectValue placeholder="Select a class" />
            </SelectTrigger>
            <SelectContent>
              {(streams.data ?? []).map((stream) => (
                <SelectItem key={stream.id} value={stream.id}>
                  {stream.grade} · {stream.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(!isTeacherScoped || teacherStreamIds.data?.classTeacherStreamIds.includes(streamId)) && <Select
            value={attendanceMode}
            onValueChange={(value) => {
              setAttendanceMode(value as "full_day" | "lesson");
              setLearningAreaId("");
              setSlotId("");
            }}
          >
            <SelectTrigger aria-label="Attendance type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="lesson">Lesson attendance</SelectItem>
              <SelectItem value="full_day">Full-day register</SelectItem>
            </SelectContent>
          </Select>}
          {attendanceMode === "lesson" && <>
          <Select
            value={learningAreaId}
            onValueChange={(value) => {
              setLearningAreaId(value);
              setSlotId("");
            }}
            disabled={!streamId || !allocations.data?.length}
          >
            <SelectTrigger aria-label="Learning area">
              <SelectValue placeholder="Select a learning area" />
            </SelectTrigger>
            <SelectContent>
              {(allocations.data ?? [])
                .filter(
                  (allocation, index, all) =>
                    all.findIndex((item) => item.learning_area_id === allocation.learning_area_id) === index,
                )
                .map((allocation) => (
                  <SelectItem key={allocation.learning_area_id} value={allocation.learning_area_id}>
                    {allocation.learning_areas?.name ?? "Learning area"}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={slotId} onValueChange={setSlotId} disabled={!learningAreaId || !attendanceDay}>
            <SelectTrigger aria-label="Lesson">
              <SelectValue placeholder="Select a timetable lesson" />
            </SelectTrigger>
            <SelectContent>
              {(lessonOptions.data ?? []).map((lesson) => (
                <SelectItem key={lesson.id} value={lesson.id}>
                  {formatLessonOptionLabel(lesson.period_index, lessonsByPeriod[lesson.period_index])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          </>}
          <Input
            type="date"
            value={attendanceDate}
            onChange={(event) => {
              setAttendanceDate(event.target.value);
              setSlotId("");
            }}
            aria-label="Attendance date"
          />
        </CardContent>
      </Card>
      {learningAreaId && attendanceDay && lessonOptions.data && !lessonOptions.data.length && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          No scheduled lesson for {selectedLearningAreaName} on this date.
        </div>
      )}
      {streamId && (
        <div className="grid gap-3 sm:grid-cols-4">
          {counts.map(({ status, count }) => (
            <Card key={status}>
              <CardContent className="flex items-center justify-between pt-5">
                <span className="text-sm text-muted-foreground">{STATUS_LABELS[status]}</span>
                <Badge className={STATUS_TONES[status].badge}>{count}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>{streamId ? "Learners" : "Choose a class to begin"}</CardTitle>
          {streamId && learnerRows.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setStatuses((current) => {
                  const next = { ...current };
                  for (const learner of learnerRows) {
                    next[learner.id] = "present";
                  }
                  return next;
                })
              }
            >
              Mark all as Present
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {streamId && learnerRows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Learner</TableHead>
                  <TableHead>Admission no.</TableHead>
                  <TableHead className="w-[220px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {learnerRows.map((learner) => (
                  <TableRow key={learner.id} className="even:bg-muted/40 hover:bg-muted/50">
                    <TableCell className="font-medium">
                      {learner.last_name}, {learner.first_name} {learner.middle_name ?? ""}
                    </TableCell>
                    <TableCell>{learner.admission_number}</TableCell>
                    <TableCell>
                      <ToggleGroup
                        type="single"
                        value={statuses[learner.id] ?? "present"}
                        onValueChange={(value) => {
                          if (!value) return;
                          setStatuses((current) => ({
                            ...current,
                            [learner.id]: value as AttendanceStatus,
                          }));
                        }}
                        className="w-full justify-start rounded-lg border bg-muted/40 p-1"
                      >
                        {(Object.keys(STATUS_LABELS) as AttendanceStatus[]).map((status) => (
                          <ToggleGroupItem
                            key={status}
                            value={status}
                            aria-label={`${STATUS_LABELS[status]} for ${learner.first_name} ${learner.last_name}`}
                            className={`flex-1 min-w-[72px] rounded-md border border-transparent px-2 py-1 text-xs font-medium ${STATUS_TONES[status].button}`}
                          >
                            {STATUS_LABELS[status]}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              {streamId
                ? "No active learners are assigned to this class."
                : "Select a class above to load its learners."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
