import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Grid2X2,
  Pencil,
  Plus,
  Printer,
  Send,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { RequireSchool } from "@/components/require-school";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSchool } from "@/hooks/use-school";
import { supabase } from "@/lib/supabase";
import { GRADE_LABELS, type CbeGrade } from "@/lib/cbe";
import { printSection } from "@/lib/csv";
import { generateTimetable } from "@/lib/timetable-generator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export const Route = createFileRoute("/_authenticated/timetable")({
  head: () => ({
    meta: [
      { title: "Timetable · SHANSCOTT CBE" },
      {
        name: "description",
        content:
          "Generate the school timetable from teacher allocations, resolve conflicts, publish and print it.",
      },
      { property: "og:title", content: "Timetable · SHANSCOTT CBE" },
      {
        property: "og:description",
        content: "Automatic conflict-free timetable generation for Kenyan CBE schools.",
      },
    ],
  }),
  component: () => (
    <RequireSchool roles={["principal", "deputy", "teacher", "class_teacher", "super_admin"]}>
      <TimetablePage />
    </RequireSchool>
  ),
});

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
];

const DEFAULT_PERIODS = [
  { period_index: 1, label: "Period 1", start_time: "08:00", end_time: "08:40", is_break: false },
  { period_index: 2, label: "Period 2", start_time: "08:40", end_time: "09:20", is_break: false },
  { period_index: 3, label: "Period 3", start_time: "09:20", end_time: "10:00", is_break: false },
  { period_index: 4, label: "Short break", start_time: "10:00", end_time: "10:20", is_break: true },
  { period_index: 5, label: "Period 4", start_time: "10:20", end_time: "11:00", is_break: false },
  { period_index: 6, label: "Period 5", start_time: "11:00", end_time: "11:40", is_break: false },
  { period_index: 7, label: "Lunch", start_time: "11:40", end_time: "12:40", is_break: true },
  { period_index: 8, label: "Period 6", start_time: "12:40", end_time: "13:20", is_break: false },
  { period_index: 9, label: "Period 7", start_time: "13:20", end_time: "14:00", is_break: false },
  { period_index: 10, label: "Period 8", start_time: "14:00", end_time: "14:40", is_break: false },
];

function TimetablePage() {
  const school = useSchool();
  const qc = useQueryClient();
  const schoolId = school.schoolId!;
  const isAdmin = school.can("principal", "deputy", "super_admin");
  const [viewGrade, setViewGrade] = useState<CbeGrade | "">("");
  const [viewStream, setViewStream] = useState("");
  const [viewMode, setViewMode] = useState<"stream" | "teacher">("stream");
  const [viewTeacher, setViewTeacher] = useState("");
  const [teacherQuery, setTeacherQuery] = useState("");
  const [unplaced, setUnplaced] = useState<string[]>([]);
  const [editingPeriod, setEditingPeriod] = useState<any | null>(null);
  const [editingCell, setEditingCell] = useState<{
    day: number;
    period: any;
    slot: any | null;
  } | null>(null);
  const [periodForm, setPeriodForm] = useState({ label: "", start: "", end: "", isBreak: false });
  const [cellForm, setCellForm] = useState({ area: "", teacher: "" });

  const periods = useQuery({
    queryKey: ["timetable-periods", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timetable_periods")
        .select("*")
        .eq("school_id", schoolId)
        .order("period_index");
      if (error) throw error;
      return data;
    },
  });

  const streams = useQuery({
    queryKey: ["streams-lite", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streams")
        .select("id, name, grade, room_id")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("grade");
      if (error) throw error;
      return data;
    },
  });

  const viewStreams = useQuery({
    queryKey: ["timetable-view-streams", schoolId, viewGrade],
    enabled: Boolean(viewGrade),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streams")
        .select("id, name, grade, room_id")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .eq("grade", viewGrade)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const staff = useQuery({
    queryKey: ["staff-lite", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id, full_name")
        .eq("school_id", schoolId)
        .eq("is_archived", false);
      if (error) throw error;
      return data;
    },
  });

  const areas = useQuery({
    queryKey: ["learning-areas", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_areas")
        .select("id, name, code")
        .eq("school_id", schoolId);
      if (error) throw error;
      return data;
    },
  });

  const allocations = useQuery({
    queryKey: ["allocations", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_allocations")
        .select("id, staff_id, stream_id, learning_area_id, periods_per_week")
        .eq("school_id", schoolId)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const timetables = useQuery({
    queryKey: ["timetables", schoolId, school.termId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timetables")
        .select("*")
        .eq("school_id", schoolId)
        .order("version", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const current = timetables.data?.[0] ?? null;

  const slots = useQuery({
    queryKey: ["timetable-slots", current?.id],
    enabled: Boolean(current?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timetable_slots")
        .select("*")
        .eq("timetable_id", current!.id);
      if (error) throw error;
      return data;
    },
  });

  const createPeriods = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("timetable_periods")
        .insert(DEFAULT_PERIODS.map((p) => ({ ...p, school_id: schoolId })));
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Default period structure created successfully.");
      void qc.invalidateQueries({ queryKey: ["timetable-periods", schoolId] });
    },
    onError: (e: Error) => toast.error("Could not create periods.", { description: e.message }),
  });

  const generate = useMutation({
    mutationFn: async () => {
      const teachingPeriods = (periods.data ?? [])
        .filter((p) => !p.is_break)
        .map((p) => p.period_index);
      const allocs = allocations.data ?? [];
      if (teachingPeriods.length === 0) throw new Error("Create the period structure first.");
      if (allocs.length === 0)
        throw new Error("Add teacher allocations before generating a timetable.");

      const version = (timetables.data?.[0]?.version ?? 0) + 1;
      const { data: tt, error: ttErr } = await supabase
        .from("timetables")
        .insert({
          school_id: schoolId,
          academic_year_id: school.academicYearId,
          term_id: school.termId,
          version,
          status: "draft",
          created_by: school.userId,
        })
        .select("id")
        .single();
      if (ttErr) throw ttErr;

      const result = generateTimetable(
        allocs.map((allocation) => ({
          id: allocation.id,
          streamId: allocation.stream_id,
          staffId: allocation.staff_id,
          learningAreaId: allocation.learning_area_id,
          periodsPerWeek: allocation.periods_per_week,
          roomId:
            streams.data?.find((stream) => stream.id === allocation.stream_id)?.room_id ?? null,
        })),
        {
          days: DAYS.map((day) => day.value),
          periods: teachingPeriods,
        },
      );
      const rows = result.slots.map((slot) => ({
        school_id: schoolId,
        timetable_id: tt.id,
        stream_id: slot.streamId,
        learning_area_id: slot.learningAreaId,
        staff_id: slot.staffId,
        room_id: slot.roomId,
        day_of_week: slot.dayOfWeek,
        period_index: slot.periodIndex,
      }));
      const failed = result.failures.map((failure) => {
        const allocation = allocs.find((item) => item.id === failure.split(":")[0]);
        const areaName =
          areas.data?.find((area) => area.id === allocation?.learning_area_id)?.name ??
          "Learning area";
        const stream = streams.data?.find((item) => item.id === allocation?.stream_id);
        const streamName = stream
          ? `${GRADE_LABELS[stream.grade as CbeGrade]} ${stream.name}`
          : "Class";
        return `${streamName} · ${areaName}: ${failure.slice(failure.indexOf(":") + 2)}`;
      });

      if (rows.length > 0) {
        const { error } = await supabase.from("timetable_slots").insert(rows);
        if (error) throw error;
      }
      return { placed: rows.length, failed };
    },
    onSuccess: ({ placed, failed }) => {
      setUnplaced(failed);
      toast.success(`Timetable generated: ${placed} lessons placed.`, {
        description: failed.length
          ? `${failed.length} allocation(s) could not be fully placed.`
          : "No conflicts detected.",
      });
      void qc.invalidateQueries({ queryKey: ["timetables", schoolId, school.termId] });
      void qc.invalidateQueries({ queryKey: ["timetable-slots"] });
    },
    onError: (e: Error) => toast.error("Generation failed.", { description: e.message }),
  });

  const publish = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("Generate a timetable first.");
      const { error } = await supabase
        .from("timetables")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          published_by: school.userId,
        })
        .eq("id", current.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Timetable published successfully.", {
        description: "Published timetables can no longer be edited.",
      });
      void qc.invalidateQueries({ queryKey: ["timetables", schoolId, school.termId] });
    },
    onError: (e: Error) => toast.error("Could not publish.", { description: e.message }),
  });

  const clearSlot = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("timetable_slots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lesson removed successfully.");
      void qc.invalidateQueries({ queryKey: ["timetable-slots", current?.id] });
    },
    onError: (e: Error) => toast.error("Could not remove the lesson.", { description: e.message }),
  });

  const moveSlot = useMutation({
    mutationFn: async (input: { id: string; day: number; period: number }) => {
      const { data: movingSlot, error: movingSlotError } = await supabase
        .from("timetable_slots")
        .select("stream_id, staff_id, room_id")
        .eq("id", input.id)
        .single();
      if (movingSlotError) throw movingSlotError;

      const { data: targetSlots, error: targetError } = await supabase
        .from("timetable_slots")
        .select("id, stream_id, staff_id, room_id")
        .eq("timetable_id", current?.id)
        .eq("day_of_week", input.day)
        .eq("period_index", input.period)
        .neq("id", input.id);
      if (targetError) throw targetError;

      const target = targetSlots?.find(
        (slot) =>
          slot.stream_id === movingSlot.stream_id ||
          (slot.staff_id && slot.staff_id === movingSlot.staff_id) ||
          (slot.room_id && slot.room_id === movingSlot.room_id),
      );
      if (target) {
        const reason =
          target.stream_id === movingSlot.stream_id
            ? "this class"
            : target.staff_id === movingSlot.staff_id
              ? "this teacher"
              : "this room";
        throw new Error(`That period is already occupied by ${reason}. Check the teacher or room timetable.`);
      }

      const { error } = await supabase
        .from("timetable_slots")
        .update({ day_of_week: input.day, period_index: input.period })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lesson moved successfully.");
      void qc.invalidateQueries({ queryKey: ["timetable-slots", current?.id] });
    },
    onError: (e: Error) =>
      toast.error("That move creates a clash.", {
        description: e.message.includes("duplicate")
          ? "The teacher, class or room is already booked in that period. Check the other class timetables."
          : e.message,
      }),
  });

  const savePeriod = useMutation({
    mutationFn: async () => {
      if (!periodForm.label.trim() || !periodForm.start || !periodForm.end)
        throw new Error("Enter a name and both times.");
      const payload = {
        label: periodForm.label.trim(),
        start_time: periodForm.start,
        end_time: periodForm.end,
        is_break: periodForm.isBreak,
      };
      if (editingPeriod?.id) {
        const { error } = await supabase
          .from("timetable_periods")
          .update(payload)
          .eq("id", editingPeriod.id)
          .eq("school_id", schoolId);
        if (error) throw error;
      } else {
        const nextIndex =
          Math.max(0, ...(periods.data ?? []).map((period) => period.period_index)) + 1;
        const { error } = await supabase
          .from("timetable_periods")
          .insert({ ...payload, period_index: nextIndex, school_id: schoolId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingPeriod?.id ? "Period updated." : "Period added.");
      setEditingPeriod(null);
      void qc.invalidateQueries({ queryKey: ["timetable-periods", schoolId] });
    },
    onError: (error: Error) =>
      toast.error("Could not save the period.", { description: error.message }),
  });

  const deletePeriod = useMutation({
    mutationFn: async (period: any) => {
      if ((slots.data ?? []).some((slot) => slot.period_index === period.period_index))
        throw new Error("Remove the lessons in this period before deleting it.");
      const { error } = await supabase
        .from("timetable_periods")
        .delete()
        .eq("id", period.id)
        .eq("school_id", schoolId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Period removed.");
      void qc.invalidateQueries({ queryKey: ["timetable-periods", schoolId] });
    },
    onError: (error: Error) =>
      toast.error("Could not remove the period.", { description: error.message }),
  });

  const saveCell = useMutation({
    mutationFn: async () => {
      if (!editingCell || !streamId) return;
      if (!editingCell.period.is_break && (!cellForm.area || !cellForm.teacher))
        throw new Error("Select a learning area and teacher.");
      const clash = (slots.data ?? []).find(
        (slot) =>
          slot.id !== editingCell.slot?.id &&
          slot.day_of_week === editingCell.day &&
          slot.period_index === editingCell.period.period_index &&
          slot.staff_id === cellForm.teacher,
      );
      if (clash) throw new Error("That teacher is already assigned at this time.");
      if (editingCell.slot) {
        const { error } = await supabase
          .from("timetable_slots")
          .update({ learning_area_id: cellForm.area, staff_id: cellForm.teacher })
          .eq("id", editingCell.slot.id);
        if (error) throw error;
      } else {
        const streamRecord = streams.data?.find((item) => item.id === streamId);
        const { error } = await supabase.from("timetable_slots").insert({
          school_id: schoolId,
          timetable_id: current?.id,
          stream_id: streamId,
          learning_area_id: cellForm.area,
          staff_id: cellForm.teacher,
          room_id: streamRecord?.room_id ?? null,
          day_of_week: editingCell.day,
          period_index: editingCell.period.period_index,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Lesson saved.");
      setEditingCell(null);
      void qc.invalidateQueries({ queryKey: ["timetable-slots", current?.id] });
    },
    onError: (error: Error) =>
      toast.error("Could not save the lesson.", { description: error.message }),
  });

  const streamId = viewStream;
  const stream = viewStreams.data?.find((s) => s.id === streamId);
  const teacherId = viewTeacher || staff.data?.[0]?.id || "";
  const teacher = staff.data?.find((member) => member.id === teacherId);
  const areaName = (id: string | null) => areas.data?.find((a) => a.id === id)?.name ?? "—";
  const staffName = (id: string | null) => staff.data?.find((s) => s.id === id)?.full_name ?? "—";
  const teachingPeriods = (periods.data ?? []).filter((p) => !p.is_break);

  const slotAt = (day: number, period: number) =>
    (slots.data ?? []).find((s) =>
      viewMode === "stream"
        ? s.stream_id === streamId && s.day_of_week === day && s.period_index === period
        : s.staff_id === teacherId && s.day_of_week === day && s.period_index === period,
    );

  const editable = current?.status === "draft" && isAdmin;

  function openPeriodEditor(period: any) {
    setEditingPeriod(period);
    setPeriodForm({
      label: period.label,
      start: period.start_time.slice(0, 5),
      end: period.end_time.slice(0, 5),
      isBreak: period.is_break,
    });
  }

  function openCellEditor(day: number, period: any, slot: any | null) {
    setEditingCell({ day, period, slot });
    setCellForm({ area: slot?.learning_area_id ?? "", teacher: slot?.staff_id ?? "" });
  }

  // Teacher load summary (a simple reconciliation view)
  const load = (staff.data ?? [])
    .map((s) => ({
      name: s.full_name,
      lessons: (slots.data ?? []).filter((sl) => sl.staff_id === s.id).length,
    }))
    .filter((r) => r.lessons > 0)
    .sort((a, b) => b.lessons - a.lessons);

  return (
    <>
      <PageHeader
        title="Timetable"
        description="Generated automatically from teacher allocations, validated for clashes, editable while in draft, then published and printable."
        icon={CalendarClock}
        actions={
          <div className="flex flex-wrap gap-3">
            {(periods.data ?? []).length === 0 && isAdmin && (
              <Button
                variant="outline"
                onClick={() => createPeriods.mutate()}
                disabled={createPeriods.isPending}
              >
                Create period structure
              </Button>
            )}
            {isAdmin && (
              <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
                <Sparkles className="mr-2 size-4" /> Generate new version
              </Button>
            )}
            {current?.status === "draft" && isAdmin && (
              <Button
                variant="secondary"
                onClick={() => publish.mutate()}
                disabled={publish.isPending}
              >
                <Send className="mr-2 size-4" /> Publish
              </Button>
            )}
            <Button variant="outline" onClick={() => printSection("timetable-print")}>
              <Printer className="mr-2 size-4" /> Print
            </Button>
          </div>
        }
      />

      {current && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge variant={current.status === "published" ? "default" : "secondary"}>
            Version {current.version} · {current.status}
          </Badge>
          {editable && (
            <Badge variant="outline" className="border-warning/60 text-warning-foreground">
              Draft · editable
            </Badge>
          )}
          {current.status === "published" && (
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-success" /> Locked for editing — generate a new
              version to change it.
            </span>
          )}
        </div>
      )}

      {unplaced.length > 0 && (
        <Card className="mb-4 border-warning/50">
          <CardHeader className="flex flex-row items-center gap-2">
            <AlertTriangle className="size-4 text-warning" />
            <CardTitle className="text-base">Conflicts to resolve</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            {unplaced.map((u) => (
              <p key={u}>{u}</p>
            ))}
            <p className="pt-2">
              Add more teaching periods, reduce periods per week, or split the class allocation.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label>{viewMode === "stream" ? "Class timetable" : "Teacher timetable"}</Label>
              {editable && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingPeriod({});
                    setPeriodForm({
                      label: "New period",
                      start: "14:40",
                      end: "15:20",
                      isBreak: false,
                    });
                  }}
                >
                  <Plus className="size-4" /> Add period
                </Button>
              )}
            </div>
            {viewMode === "stream" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Select value={viewGrade} onValueChange={(value) => { setViewGrade(value as CbeGrade); setViewStream(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                  <SelectContent>{school.grades.map((grade) => <SelectItem key={grade} value={grade}>{GRADE_LABELS[grade]}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={streamId} onValueChange={setViewStream} disabled={!viewGrade}>
                  <SelectTrigger className={!viewGrade ? "border-muted bg-muted/40 text-muted-foreground" : undefined}><SelectValue placeholder={viewGrade ? "Select stream" : "Select a grade first"} /></SelectTrigger>
                  <SelectContent>{(viewStreams.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <Select value={teacherId} onValueChange={setViewTeacher}>
                <SelectTrigger>
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 pb-2">
                    <Input value={teacherQuery} onChange={(event) => setTeacherQuery(event.target.value)} placeholder="Search teachers…" aria-label="Search teachers" />
                  </div>
                  {(staff.data ?? []).filter((member) => member.full_name.toLowerCase().includes(teacherQuery.toLowerCase())).map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex items-end">
            <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value as "stream" | "teacher")} className="rounded-lg bg-muted/50 p-1">
              <ToggleGroupItem value="stream" className="px-3 transition-colors data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=off]:text-muted-foreground">Class view</ToggleGroupItem>
              <ToggleGroupItem value="teacher" className="px-3 transition-colors data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=off]:text-muted-foreground"><Users className="mr-2 size-4" /> Teacher view</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardContent>
      </Card>

      <div
        id="timetable-print"
        className="print-page min-h-[500px] overflow-x-auto rounded-lg border bg-card p-4"
      >
        <div className="mb-4">
          <h2 className="text-lg font-semibold">
            {school.school?.name} —{" "}
            {viewMode === "stream"
              ? stream
                ? `${GRADE_LABELS[stream.grade as CbeGrade]} ${stream.name}`
                : "Class"
              : (teacher?.full_name ?? "Teacher")} {" "}
            timetable
          </h2>
          <p className="text-sm text-muted-foreground">
            {current ? `Version ${current.version} · ${current.status}` : "No timetable generated yet"}
          </p>
        </div>

        {teachingPeriods.length === 0 ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="rounded-full bg-primary/10 p-4"><Grid2X2 className="size-8 text-primary" /></div>
            <p className="font-medium">No timetable generated yet</p>
            <p className="text-sm text-muted-foreground">Create the period structure to see the weekly grid.</p>
            {isAdmin && <Button onClick={() => createPeriods.mutate()} disabled={createPeriods.isPending}>Create period structure</Button>}
          </div>
        ) : (
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="sticky top-0 z-10 bg-card">
                <th className="sticky left-0 z-20 border bg-card p-2 text-left">Period</th>
                {DAYS.map((d) => (
                  <th key={d.value} className="border p-2 text-left">
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(periods.data ?? []).map((p) => (
                <tr key={p.id} className={p.is_break ? "bg-muted/50" : undefined}>
                  <td className="sticky left-0 z-[1] border bg-card p-2 align-top">
                    {editable ? (
                      <button
                        type="button"
                        className="group w-full text-left"
                        onClick={() => openPeriodEditor(p)}
                        aria-label={`Edit ${p.label}`}
                      >
                        <p className="font-medium group-hover:text-primary">
                          {p.label} <Pencil className="ml-1 inline size-3 opacity-50" />
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)}
                        </p>
                      </button>
                    ) : (
                      <>
                        <p className="font-medium">{p.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)}
                        </p>
                      </>
                    )}
                  </td>
                  {p.is_break ? (
                    <td
                      colSpan={DAYS.length}
                      className="border p-2 text-center text-xs font-medium text-muted-foreground"
                    >
                      {p.label} · {p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)}
                    </td>
                  ) : (
                    DAYS.map((d) => {
                      const slot = slotAt(d.value, p.period_index);
                      const teacherClash =
                        slot &&
                        (slots.data ?? []).some(
                          (other) =>
                            other.id !== slot.id &&
                            other.day_of_week === slot.day_of_week &&
                            other.period_index === slot.period_index &&
                            other.staff_id === slot.staff_id,
                        );
                      return (
                        <td
                          key={d.value}
                          title={
                            teacherClash
                              ? `${staffName(slot?.staff_id)} is already assigned at this time.`
                              : undefined
                          }
                          className={`border p-2 align-top ${editable && viewMode === "stream" ? "cursor-pointer hover:bg-accent/50" : ""} ${teacherClash ? "bg-destructive/10" : ""}`}
                          onClick={() =>
                            editable && viewMode === "stream" && openCellEditor(d.value, p, slot)
                          }
                          role={editable && viewMode === "stream" ? "button" : undefined}
                          tabIndex={editable && viewMode === "stream" ? 0 : undefined}
                          onKeyDown={(event) => {
                            if (
                              editable &&
                              viewMode === "stream" &&
                              (event.key === "Enter" || event.key === " ")
                            )
                              openCellEditor(d.value, p, slot);
                          }}
                        >
                          {slot ? (
                            <div className="space-y-1">
                              <p className="font-medium">{areaName(slot.learning_area_id)}</p>
                              <p className="text-xs text-muted-foreground">
                                {staffName(slot.staff_id)}
                              </p>
                              {teacherClash && (
                                <p className="flex items-center gap-1 text-xs text-destructive">
                                  <AlertTriangle className="size-3" /> Teacher clash
                                </p>
                              )}
                              {editable && viewMode === "stream" && (
                                <div
                                  className="flex items-center gap-1 no-print"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <Select
                                    value={`${slot.day_of_week}-${slot.period_index}`}
                                    onValueChange={(v) => {
                                      const [day, period] = v.split("-").map(Number);
                                      moveSlot.mutate({ id: slot.id, day: day!, period: period! });
                                    }}
                                  >
                                    <SelectTrigger
                                      className="h-7 w-[110px] text-xs"
                                      aria-label="Move lesson"
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {DAYS.flatMap((dd) =>
                                        teachingPeriods.map((pp) => (
                                          <SelectItem
                                            key={`${dd.value}-${pp.period_index}`}
                                            value={`${dd.value}-${pp.period_index}`}
                                          >
                                            {dd.label.slice(0, 3)} · {pp.label}
                                          </SelectItem>
                                        )),
                                      )}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-7"
                                    aria-label="Remove lesson"
                                    onClick={() => clearSlot.mutate(slot.id)}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {editable ? "+ Add lesson" : "—"}
                            </span>
                          )}
                        </td>
                      );
                    })
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog
        open={Boolean(editingPeriod)}
        onOpenChange={(open) => !open && setEditingPeriod(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPeriod?.id ? "Edit period" : "Add period"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="period-label">Period or break name</Label>
              <Input
                id="period-label"
                value={periodForm.label}
                onChange={(event) =>
                  setPeriodForm((form) => ({ ...form, label: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="period-start">Start time</Label>
                <Input
                  id="period-start"
                  type="time"
                  value={periodForm.start}
                  onChange={(event) =>
                    setPeriodForm((form) => ({ ...form, start: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="period-end">End time</Label>
                <Input
                  id="period-end"
                  type="time"
                  value={periodForm.end}
                  onChange={(event) =>
                    setPeriodForm((form) => ({ ...form, end: event.target.value }))
                  }
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={periodForm.isBreak}
                onChange={(event) =>
                  setPeriodForm((form) => ({ ...form, isBreak: event.target.checked }))
                }
              />{" "}
              Break row
            </label>
          </div>
          <DialogFooter>
            <div className="flex w-full items-center justify-between">
              <div>
                {editingPeriod?.id && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      deletePeriod.mutate(editingPeriod);
                      setEditingPeriod(null);
                    }}
                  >
                    Delete period
                  </Button>
                )}
              </div>
              <Button onClick={() => savePeriod.mutate()} disabled={savePeriod.isPending}>
                {savePeriod.isPending ? "Saving…" : "Save period"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingCell)} onOpenChange={(open) => !open && setEditingCell(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCell?.slot ? "Edit lesson" : "Assign lesson"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {editingCell
                ? `${DAYS.find((day) => day.value === editingCell.day)?.label} · ${editingCell.period.label}`
                : ""}
            </p>
            <div className="space-y-1.5">
              <Label>Learning area</Label>
              <Select
                value={cellForm.area}
                onValueChange={(value) => setCellForm((form) => ({ ...form, area: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {(areas.data ?? []).map((area) => (
                    <SelectItem key={area.id} value={area.id}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Teacher</Label>
              <Select
                value={cellForm.teacher}
                onValueChange={(value) => setCellForm((form) => ({ ...form, teacher: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent>
                  {(staff.data ?? []).map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <div className="flex w-full items-center justify-between">
              <div>
                {editingCell?.slot && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      clearSlot.mutate(editingCell.slot.id);
                      setEditingCell(null);
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <Button onClick={() => saveCell.mutate()} disabled={saveCell.isPending}>
                {saveCell.isPending ? "Saving…" : "Save lesson"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {load.length > 0 && (
        <Card className="mt-6 no-print">
          <CardHeader>
            <CardTitle className="text-base">Teacher weekly load</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {load.map((l) => (
              <div
                key={l.name}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span>{l.name}</span>
                <Badge variant="secondary">{l.lessons} lessons</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
