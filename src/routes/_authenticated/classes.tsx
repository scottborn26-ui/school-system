import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { RequireSchool } from "@/components/require-school";
import { ACTIONS_COLUMN_CLASS, RowActions } from "@/components/row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useSchool } from "@/hooks/use-school";
import { GRADE_LABELS, type CbeGrade } from "@/lib/cbe";

export const Route = createFileRoute("/_authenticated/classes")({
  head: () => ({
    meta: [
      { title: "Grades & streams · SHANSCOTT CBE" },
      {
        name: "description",
        content:
          "Configure CBE grades, streams, class capacity and class teachers for your school.",
      },
      { property: "og:title", content: "Grades & streams · SHANSCOTT CBE" },
      {
        property: "og:description",
        content:
          "Create and manage streams per CBE grade with capacity and class teacher assignment.",
      },
    ],
  }),
  component: () => (
    <RequireSchool roles={["principal", "deputy"]}>
      <ClassesPage />
    </RequireSchool>
  ),
});

interface StreamRow {
  id: string;
  grade: CbeGrade;
  name: string;
  capacity: number;
  class_teacher_id: string | null;
  is_active: boolean;
}

function ClassesPage() {
  const school = useSchool();
  const schoolId = school.schoolId!;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StreamRow | null>(null);
  const [gradeFilter, setGradeFilter] = useState("all");
  const [dialogGrade, setDialogGrade] = useState<CbeGrade | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["streams", schoolId, school.academicYearId],
    queryFn: async () => {
      const [streams, staff, learners] = await Promise.all([
        supabase
          .from("streams")
          .select("id, grade, name, capacity, class_teacher_id, is_active")
          .eq("school_id", schoolId)
          .eq("academic_year_id", school.academicYearId)
          .order("grade"),
        supabase
          .from("staff")
          .select("id, full_name")
          .eq("school_id", schoolId)
          .eq("is_archived", false),
        supabase
          .from("learners")
          .select("id, current_stream_id")
          .eq("school_id", schoolId)
          .eq("status", "active"),
      ]);
      if (streams.error) throw streams.error;
      return {
        streams: (streams.data ?? []) as StreamRow[],
        staff: staff.data ?? [],
        learners: learners.data ?? [],
      };
    },
  });

  const staff = data?.staff ?? [];
  const learners = data?.learners ?? [];
  const groups = useMemo(() => {
    const search = query.trim().toLowerCase();
    return school.grades
      .map((grade) => {
        const streams = (data?.streams ?? []).filter((stream) => {
          if (stream.grade !== grade) return false;
          const teacher =
            staff.find((member) => member.id === stream.class_teacher_id)?.full_name ?? "";
          return !search || `${stream.name} ${teacher}`.toLowerCase().includes(search);
        });
        const gradeMatches = GRADE_LABELS[grade].toLowerCase().includes(search);
        return {
          grade,
          streams:
            search && gradeMatches
              ? (data?.streams ?? []).filter((stream) => stream.grade === grade)
              : streams,
        };
      })
      .filter(
        (group) =>
          (gradeFilter === "all" || group.grade === gradeFilter) &&
          (!search || group.streams.length > 0),
      );
  }, [data?.streams, gradeFilter, query, school.grades, staff]);

  const streamCount = groups.reduce((total, group) => total + group.streams.length, 0);
  const pageCount = 1;
  const currentPage = 1;
  const visibleGroups = groups;

  const setStreamActive = useMutation({
    mutationFn: async (stream: StreamRow) => {
      const { error } = await supabase
        .from("streams")
        .update({ is_active: !stream.is_active })
        .eq("id", stream.id)
        .eq("school_id", schoolId);
      if (error) throw error;
    },
    onSuccess: (_, stream) => {
      toast.success(
        stream.is_active ? "Stream archived successfully." : "Stream restored successfully.",
      );
      void qc.invalidateQueries({ queryKey: ["streams", schoolId, school.academicYearId] });
    },
    onError: () => toast.error("The stream status could not be changed."),
  });

  function resetFilters() {
    setQuery("");
    setGradeFilter("all");
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Grades & streams</h1>
          <p className="text-sm text-muted-foreground">
            Streams are the classes learners are placed in. Only grades your school offers are
            available.
          </p>
        </div>
        <Dialog
          open={open && dialogGrade === null}
          onOpenChange={(value) => {
            setOpen(value);
            if (!value) setDialogGrade(null);
          }}
        >
          <DialogTrigger asChild>
            <Button disabled={school.grades.length === 0}>
              <Plus className="mr-2 size-4" /> Add stream
            </Button>
          </DialogTrigger>
          <StreamDialog
            schoolId={schoolId}
            staff={staff}
            onDone={() => {
              setOpen(false);
              void qc.invalidateQueries({ queryKey: ["streams", schoolId, school.academicYearId] });
            }}
          />
        </Dialog>
      </div>

      <div className="surface-soft sticky top-[4.25rem] z-10 flex flex-col gap-3 p-3 md:flex-row md:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search streams…"
            className="bg-card pl-9"
            aria-label="Search streams"
          />
        </div>
        <Select
          value={gradeFilter}
          onValueChange={(value) => {
            setGradeFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full bg-card md:w-[170px]" aria-label="Filter by grade">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All grades</SelectItem>
            {school.grades.map((g) => (
              <SelectItem key={g} value={g}>
                {GRADE_LABELS[g]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
          <RotateCcw className="size-4" /> Reset
        </Button>
      </div>

      <div className="space-y-3" aria-live="polite">
        {isLoading && (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
            Loading streams…
          </div>
        )}
        {!isLoading && visibleGroups.length === 0 && (
          <div className="rounded-xl border bg-card p-10 text-center">
            <Layers className="mx-auto mb-3 size-7 text-muted-foreground" />
            <p className="font-medium">No streams configured</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add at least one stream per grade so learners can be placed in a class.
            </p>
          </div>
        )}
        {!isLoading &&
          visibleGroups.map((group) => {
            const isExpanded = expanded[group.grade] ?? false;
            const capacity = group.streams.reduce((total, stream) => total + stream.capacity, 0);
            return (
              <section
                key={group.grade}
                className="overflow-hidden rounded-xl border bg-card shadow-sm shadow-primary/5"
              >
                <div className="flex items-center gap-3 bg-muted/35 px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={`grade-${group.grade}`}
                    onClick={() =>
                      setExpanded((current) => ({ ...current, [group.grade]: !isExpanded }))
                    }
                    className="flex min-w-0 cursor-pointer flex-1 items-center gap-3 text-left transition-colors hover:text-primary"
                  >
                    <ChevronDown
                      className={cn(
                        "size-5 shrink-0 transition-transform duration-200",
                        !isExpanded && "-rotate-90",
                      )}
                    />
                    <span className="text-base font-semibold">{GRADE_LABELS[group.grade]}</span>
                    <span className="text-sm text-muted-foreground">
                      {group.streams.length} {group.streams.length === 1 ? "stream" : "streams"} ·{" "}
                      {capacity} capacity
                    </span>
                  </button>
                  <Dialog
                    open={open && dialogGrade === group.grade}
                    onOpenChange={(value) => {
                      setOpen(value);
                      setDialogGrade(value ? group.grade : null);
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="hidden text-primary sm:inline-flex"
                      >
                        <Plus className="size-4" /> Add stream
                      </Button>
                    </DialogTrigger>
                    <StreamDialog
                      schoolId={schoolId}
                      staff={staff}
                      initialGrade={group.grade}
                      onDone={() => {
                        setOpen(false);
                        void qc.invalidateQueries({
                          queryKey: ["streams", schoolId, school.academicYearId],
                        });
                      }}
                    />
                  </Dialog>
                </div>
                {isExpanded && (
                  <div id={`grade-${group.grade}`} className="accordion-panel">
                    {group.streams.length === 0 ? (
                      <div className="px-5 py-7 text-sm text-muted-foreground">
                        No streams added for this grade.{" "}
                        <button
                          type="button"
                          className="font-medium text-primary hover:underline"
                          onClick={() => {
                            setGradeFilter(group.grade);
                            setDialogGrade(group.grade);
                            setOpen(true);
                          }}
                        >
                          Add stream
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {group.streams.map((stream) => {
                          const count = learners.filter(
                            (learner) => learner.current_stream_id === stream.id,
                          ).length;
                          const ratio = stream.capacity
                            ? Math.min(100, (count / stream.capacity) * 100)
                            : 0;
                          const occupancyTone =
                            !stream.is_active || ratio >= 100
                              ? "bg-muted-foreground"
                              : ratio >= 80
                                ? "bg-warning"
                                : "bg-success";
                          return (
                            <div
                              key={stream.id}
                              className="grid gap-3 px-4 py-4 transition-colors hover:bg-accent/35 sm:grid-cols-[1.2fr_1.3fr_1fr_0.9fr_auto] sm:items-center sm:px-5"
                            >
                              <div>
                                <p className="font-medium">{stream.name}</p>
                                <p className="mt-1 text-xs text-muted-foreground sm:hidden">
                                  Stream
                                </p>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Users className="size-4 text-muted-foreground" />
                                <span>
                                  {staff.find((member) => member.id === stream.class_teacher_id)
                                    ?.full_name ?? "Not assigned"}
                                </span>
                                <span className="text-xs text-muted-foreground sm:hidden">
                                  Class teacher
                                </span>
                              </div>
                              <div>
                                <div className="flex items-center justify-between gap-3 text-sm">
                                  <span className="text-muted-foreground sm:hidden">Occupancy</span>
                                  <span className="font-medium">
                                    {count}/{stream.capacity}
                                  </span>
                                </div>
                                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className={cn("h-full rounded-full", occupancyTone)}
                                    style={{ width: `${ratio}%` }}
                                  />
                                </div>
                              </div>
                              <Badge
                                variant={stream.is_active ? "default" : "secondary"}
                                className={
                                  stream.is_active
                                    ? "w-fit bg-success text-success-foreground"
                                    : "w-fit"
                                }
                              >
                                {stream.is_active ? "Active" : "Inactive"}
                              </Badge>
                              <div className={ACTIONS_COLUMN_CLASS}>
                                <RowActions
                                  onEdit={() => setEditing(stream)}
                                  archived={!stream.is_active}
                                  onArchive={() => setStreamActive.mutate(stream)}
                                  onRestore={() => setStreamActive.mutate(stream)}
                                  disabled={setStreamActive.isPending}
                                  archiveLabel="Archive stream"
                                  restoreLabel="Restore stream"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
      </div>

      <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          {isLoading
            ? "Loading…"
            : `${streamCount} record${streamCount === 1 ? "" : "s"} · page ${currentPage} of ${pageCount}`}
        </p>
        <div className="flex items-center gap-2">
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[110px] bg-card" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={currentPage >= pageCount}
            onClick={() => setPage(currentPage + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
      {editing && (
        <Dialog open onOpenChange={(value) => !value && setEditing(null)}>
          <EditStreamDialog
            stream={editing}
            schoolId={schoolId}
            staff={staff}
            onDone={() => {
              setEditing(null);
              void qc.invalidateQueries({ queryKey: ["streams", schoolId, school.academicYearId] });
            }}
          />
        </Dialog>
      )}
    </div>
  );
}

function EditStreamDialog({
  stream,
  schoolId,
  staff,
  onDone,
}: {
  stream: StreamRow;
  schoolId: string;
  staff: { id: string; full_name: string }[];
  onDone: () => void;
}) {
  const school = useSchool();
  const [name, setName] = useState(stream.name);
  const [capacity, setCapacity] = useState(String(stream.capacity));
  const [teacher, setTeacher] = useState(stream.class_teacher_id ?? "");
  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("streams")
        .update({
          name: name.trim(),
          capacity: Number(capacity),
          class_teacher_id: teacher || null,
        })
        .eq("id", stream.id)
        .eq("school_id", schoolId);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        school_id: schoolId,
        actor_id: school.userId,
        actor_name: school.fullName,
        action: "update",
        entity: "stream",
        entity_id: stream.id,
        after_data: { name: name.trim(), capacity: Number(capacity) },
      });
    },
    onSuccess: () => {
      toast.success("Stream updated successfully.");
      onDone();
    },
    onError: () => toast.error("The stream could not be updated."),
  });
  function submit() {
    if (!name.trim() || Number(capacity) < 1) {
      toast.warning("Enter a stream name and a valid capacity.");
      return;
    }
    mutation.mutate();
  }
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Edit stream</DialogTitle>
        <DialogDescription>Update the stream name, capacity, or class teacher.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Grade</Label>
          <Input value={GRADE_LABELS[stream.grade]} disabled />
        </div>
        <div className="space-y-1.5">
          <Label>Stream name *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Capacity</Label>
          <Input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Class teacher</Label>
          <Select value={teacher} onValueChange={setTeacher}>
            <SelectTrigger>
              <SelectValue placeholder="Select teacher" />
            </SelectTrigger>
            <SelectContent>
              {staff.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function StreamDialog({
  schoolId,
  staff,
  initialGrade,
  onDone,
}: {
  schoolId: string;
  staff: { id: string; full_name: string }[];
  initialGrade?: CbeGrade;
  onDone: () => void;
}) {
  const school = useSchool();
  const [grade, setGrade] = useState(initialGrade ?? "");
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("45");
  const [teacher, setTeacher] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("streams").insert({
        school_id: schoolId,
        academic_year_id: school.academicYearId,
        grade: grade as CbeGrade,
        name: name.trim(),
        capacity: Number(capacity) || 45,
        class_teacher_id: teacher || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stream created successfully.");
      onDone();
    },
    onError: () => {
      toast.error("The stream could not be created.", {
        description: "A stream with this name may already exist for that grade.",
      });
    },
  });

  function submit() {
    const e: Record<string, string> = {};
    if (!grade) e["grade"] = "Select a grade.";
    if (name.trim().length < 1) e["name"] = "Enter a stream name, e.g. North or Blue.";
    if (Number(capacity) < 1) e["capacity"] = "Capacity must be at least 1.";
    setErrors(e);
    if (Object.keys(e).length) return;
    mutation.mutate();
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add a stream</DialogTitle>
        <DialogDescription>
          Streams belong to the currently selected academic year.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Grade *</Label>
          <Select value={grade} onValueChange={setGrade}>
            <SelectTrigger>
              <SelectValue placeholder="Select grade" />
            </SelectTrigger>
            <SelectContent>
              {school.grades.map((g) => (
                <SelectItem key={g} value={g}>
                  {GRADE_LABELS[g]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors["grade"] && <p className="text-xs text-destructive">{errors["grade"]}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Stream name *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="North" />
          {errors["name"] && <p className="text-xs text-destructive">{errors["name"]}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Capacity</Label>
          <Input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
          {errors["capacity"] && <p className="text-xs text-destructive">{errors["capacity"]}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Class teacher</Label>
          <Select value={teacher} onValueChange={setTeacher} disabled={staff.length === 0}>
            <SelectTrigger>
              <SelectValue placeholder={staff.length ? "Select teacher" : "No staff added yet"} />
            </SelectTrigger>
            <SelectContent>
              {staff.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" /> Saving…
            </>
          ) : (
            "Create stream"
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
