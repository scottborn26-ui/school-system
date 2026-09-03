import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { DetailPanel } from "@/components/detail-panel";
import { RequireSchool } from "@/components/require-school";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSchool } from "@/hooks/use-school";
import { supabase } from "@/lib/supabase";
import { GRADE_LABELS, type CbeGrade } from "@/lib/cbe";
import { cn } from "@/lib/utils";
import { SeniorPathwaysPanel } from "@/components/senior-pathways-panel";
import { ALLOWED_CURRICULUM_ROLES } from "@/lib/access-control";

export const Route = createFileRoute("/_authenticated/curriculum")({
  head: () => ({
    meta: [
      { title: "Learning areas & teacher allocations · SHANSCOTT CBE" },
      {
        name: "description",
        content:
          "Define CBE learning areas and allocate teachers to streams with periods per week.",
      },
      { property: "og:title", content: "Learning areas & teacher allocations · SHANSCOTT CBE" },
      {
        property: "og:description",
        content: "Curriculum setup that feeds automatic timetable generation.",
      },
    ],
  }),
  component: () => (
    <RequireSchool roles={[...ALLOWED_CURRICULUM_ROLES]}>
      <CurriculumPage />
    </RequireSchool>
  ),
});

function CurriculumPage() {
  const school = useSchool();
  const qc = useQueryClient();
  const schoolId = school.schoolId!;

  const areas = useQuery({
    queryKey: ["learning-areas", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_areas")
        .select("*")
        .eq("school_id", schoolId)
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
        .select("id, full_name, staff_number")
        .eq("school_id", schoolId)
        .eq("is_archived", false)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const streams = useQuery({
    queryKey: ["streams-lite", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streams")
        .select("id, name, grade, display_name")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("grade");
      if (error) throw error;
      return data;
    },
  });

  const assessments = useQuery({
    queryKey: ["learning-area-assessments", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select("id, title, grade, stream_id, learning_area_id, assessment_type, max_score, assessment_date, status")
        .eq("school_id", schoolId)
        .order("assessment_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const allocations = useQuery({
    queryKey: ["allocations", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_allocations")
        .select("id, periods_per_week, is_active, staff_id, stream_id, learning_area_id, academic_year_id")
        .eq("school_id", schoolId);
      if (error) throw error;
      return data;
    },
  });

  const timetableSlots = useQuery({
    queryKey: ["allocation-timetable-slots", schoolId, school.termId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timetable_slots")
        .select("id, stream_id, learning_area_id, day_of_week, period_index, timetable:timetables!inner(id, academic_year_id, term_id, status)")
        .eq("school_id", schoolId)
        .eq("timetables.academic_year_id", school.academicYearId)
        .eq("timetables.term_id", school.termId);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ---- create learning area
  const isCurriculumManager = school.can("super_admin", "admin", "principal", "deputy");
  const [areaOpen, setAreaOpen] = useState(false);
  const [areaName, setAreaName] = useState("");
  const [areaCode, setAreaCode] = useState("");
  const [areaAbbreviation, setAreaAbbreviation] = useState("");
  const [areaCore, setAreaCore] = useState(true);
  const [areaGrades, setAreaGrades] = useState<CbeGrade[]>([]);
  const [areaQuery, setAreaQuery] = useState("");
  const [areaPage, setAreaPage] = useState(1);
  const [areaPageSize, setAreaPageSize] = useState(10);
  const [expandedGrades, setExpandedGrades] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined" || !schoolId) return {};
    try {
      const raw = window.localStorage.getItem(`curriculum-expanded-grades:${schoolId}`);
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, boolean>;
    } catch {
      return {};
    }
  });
  const [viewingAreaId, setViewingAreaId] = useState<string | null>(null);
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [editAreaName, setEditAreaName] = useState("");
  const [editAreaCode, setEditAreaCode] = useState("");
  const [editAreaAbbreviation, setEditAreaAbbreviation] = useState("");
  const [editAreaCore, setEditAreaCore] = useState(true);
  const [deleteAreaId, setDeleteAreaId] = useState<string | null>(null);

  useEffect(() => {
    if (!school.grades.length) return;
    setExpandedGrades((current) => {
      const next: Record<string, boolean> = {};
      for (const grade of school.grades) {
        next[grade] = current[grade] ?? false;
      }
      return next;
    });
  }, [school.grades]);

  useEffect(() => {
    if (!schoolId || !school.grades.length) return;
    const storageKey = `curriculum-expanded-grades:${schoolId}`;
    if (Object.keys(expandedGrades).length === 0) {
      const defaults = Object.fromEntries(school.grades.map((grade) => [grade, false]));
      window.localStorage.setItem(storageKey, JSON.stringify(defaults));
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(expandedGrades));
  }, [expandedGrades, school.grades, schoolId]);

  const createArea = useMutation({
    mutationFn: async () => {
      if (areaName.trim().length < 2) throw new Error("Enter the learning area name.");
      if (areaGrades.length === 0) throw new Error("Select at least one grade.");
      const code = (areaCode.trim() || areaAbbreviation.trim() || "").trim() || null;
      const { error } = await supabase.from("learning_areas").insert({
        school_id: schoolId,
        name: areaName.trim(),
        code,
        is_core: areaCore,
        grades: areaGrades,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Learning area added successfully.");
      setAreaOpen(false);
      setAreaName("");
      setAreaCode("");
      setAreaAbbreviation("");
      setAreaGrades([]);
      setAreaCore(true);
      void qc.invalidateQueries({ queryKey: ["learning-areas", schoolId] });
    },
    onError: (e: Error) =>
      toast.error("Could not add the learning area.", { description: e.message }),
  });

  const updateArea = useMutation({
    mutationFn: async () => {
      if (!editingAreaId) throw new Error("Select a learning area to edit.");
      const nextName = editAreaName.trim();
      const nextCode = (editAreaCode.trim() || editAreaAbbreviation.trim() || "").trim() || null;
      if (nextName.length < 2) throw new Error("Enter the learning area name.");
      const { error } = await supabase
        .from("learning_areas")
        .update({ name: nextName, code: nextCode, is_core: editAreaCore })
        .eq("id", editingAreaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Learning area updated.");
      setEditingAreaId(null);
      setEditAreaName("");
      setEditAreaCode("");
      setEditAreaAbbreviation("");
      setEditAreaCore(true);
      void qc.invalidateQueries({ queryKey: ["learning-areas", schoolId] });
    },
    onError: (e: Error) =>
      toast.error("Could not update the learning area.", { description: e.message }),
  });

  const deleteArea = useMutation({
    mutationFn: async (areaId: string) => {
      const [allocationsResult, assessmentsResult, combinationResult] = await Promise.all([
        supabase.from("teacher_allocations").select("id").eq("learning_area_id", areaId).limit(1),
        supabase.from("assessments").select("id").eq("learning_area_id", areaId).limit(1),
        supabase
          .from("subject_combination_learning_areas")
          .select("id")
          .eq("learning_area_id", areaId)
          .limit(1),
      ]);

      const blockers = [
        allocationsResult.data?.length ? "teacher allocations" : null,
        assessmentsResult.data?.length ? "assessments" : null,
        combinationResult.data?.length ? "senior pathway combinations" : null,
      ].filter(Boolean) as string[];

      if (blockers.length > 0) {
        throw new Error(
          `This learning area is still linked to ${blockers.join(", ")}. Remove those references before deleting it.`,
        );
      }

      const { error } = await supabase.from("learning_areas").delete().eq("id", areaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Learning area deleted.");
      setDeleteAreaId(null);
      void qc.invalidateQueries({ queryKey: ["learning-areas", schoolId] });
    },
    onError: (e: Error) => {
      if (deleteAreaId) {
        toast.error("Could not delete this learning area.", { description: e.message });
      }
    },
  });

  // ---- create allocation
  const [allocOpen, setAllocOpen] = useState(false);
  const [allocStaff, setAllocStaff] = useState("");
  const [allocGrade, setAllocGrade] = useState<CbeGrade | "">("");
  const [allocStream, setAllocStream] = useState("");
  const [allocArea, setAllocArea] = useState("");
  const [allocPeriods, setAllocPeriods] = useState("4");
  const [allocGradeOpen, setAllocGradeOpen] = useState<Record<string, boolean>>({});
  const [allocStreamOpen, setAllocStreamOpen] = useState<Record<string, boolean>>({});
  const [allocationQuery, setAllocationQuery] = useState("");
  const [editingAllocationId, setEditingAllocationId] = useState<string | null>(null);
  const [viewingAllocationId, setViewingAllocationId] = useState<string | null>(null);
  const [deleteAllocationId, setDeleteAllocationId] = useState<string | null>(null);
  const [editStaff, setEditStaff] = useState("");
  const [editPeriods, setEditPeriods] = useState("4");

  const allocationAreas = useQuery({
    queryKey: ["allocation-learning-areas", schoolId, allocGrade],
    enabled: Boolean(allocGrade),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_areas")
        .select("id, name, code, is_core, grades")
        .eq("school_id", schoolId)
        .contains("grades", [allocGrade]);
      if (error) throw error;
      return data ?? [];
    },
  });

  const createAllocation = useMutation({
    mutationFn: async () => {
      if (!allocStaff || !allocStream || !allocArea)
        throw new Error("Select a teacher, stream and learning area.");
      if (!allocGrade) throw new Error("Select a grade.");
      const { error } = await supabase.from("teacher_allocations").insert({
        school_id: schoolId,
        academic_year_id: school.academicYearId,
        staff_id: allocStaff,
        stream_id: allocStream,
        learning_area_id: allocArea,
        periods_per_week: Number(allocPeriods) || 4,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Allocation saved successfully.");
      setAllocOpen(false);
      setAllocStaff("");
      setAllocGrade("");
      setAllocStream("");
      setAllocArea("");
      void qc.invalidateQueries({ queryKey: ["allocations", schoolId] });
    },
    onError: (e: Error) =>
      toast.error("Could not save the allocation.", {
        description: e.message.includes("duplicate")
          ? "This stream already has a teacher for that learning area."
          : e.message,
      }),
  });

  const updateAllocation = useMutation({
    mutationFn: async () => {
      if (!editingAllocationId) throw new Error("Select an allocation to edit.");
      const periods = Number(editPeriods);
      if (!editStaff || !Number.isInteger(periods) || periods < 1 || periods > 20) throw new Error("Select a teacher and enter between 1 and 20 periods per week.");
      const { error } = await supabase.from("teacher_allocations").update({ staff_id: editStaff, periods_per_week: periods }).eq("id", editingAllocationId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Allocation updated."); setEditingAllocationId(null); void qc.invalidateQueries({ queryKey: ["allocations", schoolId] }); },
    onError: (e: Error) => toast.error("Could not update the allocation.", { description: e.message }),
  });

  const deleteAllocation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teacher_allocations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Allocation deleted."); setDeleteAllocationId(null); void qc.invalidateQueries({ queryKey: ["allocations", schoolId] }); },
    onError: (e: Error) => { toast.error("Could not delete the allocation.", { description: e.message }); setDeleteAllocationId(null); },
  });

  const streamLabel = (id: string) => {
    const s = streams.data?.find((x) => x.id === id);
    return s ? `${GRADE_LABELS[s.grade as CbeGrade]} ${s.name}` : "—";
  };
  const areaName_ = (id: string) => areas.data?.find((a) => a.id === id)?.name ?? "—";
  const staffName = (id: string) => staff.data?.find((s) => s.id === id)?.full_name ?? "—";

  type AreaRow = NonNullable<typeof areas.data>[number];
  const areaGroups = useMemo(() => {
    const search = areaQuery.trim().toLowerCase();
    return school.grades.map((grade) => ({
      grade,
      areas: (areas.data ?? [])
        .filter((area) => (area.grades ?? []).includes(grade))
        .filter(
          (area) =>
            !search ||
            `${area.name} ${area.code ?? ""} ${area.is_core ? "core" : "optional"}`
              .toLowerCase()
              .includes(search),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [areaQuery, areas.data, school.grades]);

  const visibleAreaGroups = useMemo(() => {
    const search = areaQuery.trim().toLowerCase();

    if (!search) {
      return areaGroups;
    }

    const filtered = areaGroups.map((group) => ({
      ...group,
      areas: group.areas.filter(
        (area) =>
          `${area.name} ${area.code ?? ""} ${area.is_core ? "core" : "optional"}`
            .toLowerCase()
            .includes(search),
      ),
    }));

    const start = (areaPage - 1) * areaPageSize;
    const end = areaPage * areaPageSize;
    let seen = 0;

    return filtered.flatMap((group) => {
      const groupStart = seen;
      const groupEnd = groupStart + group.areas.length;
      seen = groupEnd;

      const overlapsPage = groupEnd > start && groupStart < end;
      return overlapsPage ? [group] : [];
    });
  }, [areaGroups, areaPage, areaPageSize, areaQuery]);

  const areaRecordCount = areaGroups.reduce((total, group) => total + group.areas.length, 0);
  const areaPageCount = Math.max(1, Math.ceil(areaRecordCount / areaPageSize));
  const currentAreaPage = Math.min(areaPage, areaPageCount);
  const allSectionsExpanded =
    school.grades.length > 0 && school.grades.every((grade) => expandedGrades[grade] ?? false);
  const viewingArea = areas.data?.find((area) => area.id === viewingAreaId) ?? null;
  const editingArea = areas.data?.find((area) => area.id === editingAreaId) ?? null;

  function resetAreaFilters() {
    setAreaQuery("");
    setAreaPage(1);
  }

  function toggleAllSections() {
    const nextState = school.grades.reduce(
      (acc, grade) => ({ ...acc, [grade]: !allSectionsExpanded }),
      {} as Record<string, boolean>,
    );
    setExpandedGrades(nextState);
  }

  function openEditArea(area: AreaRow) {
    setEditingAreaId(area.id);
    setEditAreaName(area.name);
    setEditAreaCode(area.code ?? "");
    setEditAreaAbbreviation(area.code ?? "");
    setEditAreaCore(Boolean(area.is_core));
  }

  function closeEditArea() {
    setEditingAreaId(null);
    setEditAreaName("");
    setEditAreaCode("");
    setEditAreaAbbreviation("");
    setEditAreaCore(true);
  }

  const allocationSlots = timetableSlots.data ?? [];
  const allocationGroups = useMemo(() => {
    const query = allocationQuery.trim().toLowerCase();
    return school.grades.map((grade) => ({ grade, streams: (streams.data ?? []).filter((stream) => stream.grade === grade).map((stream) => ({ stream, allocations: (allocations.data ?? []).filter((allocation) => allocation.stream_id === stream.id).filter((allocation) => !query || `${areaName_(allocation.learning_area_id)} ${staffName(allocation.staff_id)}`.toLowerCase().includes(query)) })) }));
  }, [allocationQuery, allocations.data, school.grades, streams.data]);
  const allAllocationSectionsExpanded = allocationGroups.length > 0 && allocationGroups.every((group) => allocGradeOpen[group.grade]);
  const viewingAllocation = allocations.data?.find((allocation) => allocation.id === viewingAllocationId) ?? null;
  const editingAllocation = allocations.data?.find((allocation) => allocation.id === editingAllocationId) ?? null;
  const openAllocationEdit = (allocation: NonNullable<typeof allocations.data>[number]) => { setEditingAllocationId(allocation.id); setEditStaff(allocation.staff_id); setEditPeriods(String(allocation.periods_per_week)); };
  const toggleAllAllocationSections = () => { const expanded = !allAllocationSectionsExpanded; setAllocGradeOpen(Object.fromEntries(allocationGroups.map((group) => [group.grade, expanded]))); setAllocStreamOpen(Object.fromEntries(allocationGroups.flatMap((group) => group.streams.map(({ stream }) => [stream.id, expanded])))); };

  return (
    <>
      <PageHeader
        title="Curriculum & allocations"
        description="Define learning areas per grade, then allocate teachers to classes. Allocations drive automatic timetable generation."
        icon={BookOpen}
      />

      <Tabs defaultValue="areas">
        <TabsList className="mb-4">
          <TabsTrigger value="areas">
            <BookOpen className="mr-2 size-4" /> Learning areas
          </TabsTrigger>
          <TabsTrigger value="pathways">
            <BookOpen className="mr-2 size-4" /> Senior School pathways
          </TabsTrigger>
          <TabsTrigger value="allocations">
            <Users className="mr-2 size-4" /> Teacher allocations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="areas">
          <div className="surface-soft sticky top-[4.25rem] z-10 flex flex-col gap-3 p-3 md:flex-row md:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={areaQuery}
                onChange={(event) => {
                  setAreaQuery(event.target.value);
                  setAreaPage(1);
                }}
                placeholder="Search learning areas…"
                className="bg-card pl-9"
                aria-label="Search learning areas"
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={toggleAllSections}>
              {allSectionsExpanded ? "Collapse all" : "Expand all"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={resetAreaFilters}>
              <RotateCcw className="size-4" /> Reset
            </Button>
            <Dialog open={areaOpen} onOpenChange={setAreaOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 size-4" /> Add learning area
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add a learning area</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="la-name">Name</Label>
                      <Input
                        id="la-name"
                        value={areaName}
                        onChange={(e) => setAreaName(e.target.value)}
                        placeholder="e.g. Mathematics"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="la-code">Code (optional)</Label>
                      <Input
                        id="la-code"
                        value={areaCode}
                        onChange={(e) => setAreaCode(e.target.value)}
                        placeholder="MATH"
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="la-abbreviation">Abbreviation (optional)</Label>
                      <Input
                        id="la-abbreviation"
                        value={areaAbbreviation}
                        onChange={(e) => setAreaAbbreviation(e.target.value)}
                        placeholder="MAT"
                      />
                    </div>
                    <div className="flex items-center gap-3 pt-7">
                      <Switch id="la-core" checked={areaCore} onCheckedChange={setAreaCore} />
                      <Label htmlFor="la-core">Core learning area</Label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Grades offered</Label>
                    <div className="flex flex-wrap gap-2">
                      {school.grades.map((g) => {
                        const on = areaGrades.includes(g);
                        return (
                          <Button
                            key={g}
                            type="button"
                            size="sm"
                            variant={on ? "default" : "outline"}
                            onClick={() =>
                              setAreaGrades((prev) =>
                                on ? prev.filter((x) => x !== g) : [...prev, g],
                              )
                            }
                          >
                            {GRADE_LABELS[g]}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => createArea.mutate()} disabled={createArea.isPending}>
                    Save learning area
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="mt-4 space-y-3" aria-live="polite">
            {areas.isLoading && (
              <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
                Loading learning areas…
              </div>
            )}
            {!areas.isLoading && visibleAreaGroups.length === 0 && (
              <div className="rounded-xl border bg-card p-10 text-center">
                <BookOpen className="mx-auto mb-3 size-7 text-muted-foreground" />
                <p className="font-medium">No learning areas match your search</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try a different name or code, or add a learning area.
                </p>
              </div>
            )}
            {!areas.isLoading &&
              visibleAreaGroups.map((group) => {
                const isExpanded = expandedGrades[group.grade] ?? false;
                return (
                  <section
                    key={group.grade}
                    className="overflow-hidden rounded-xl border bg-card shadow-sm shadow-primary/5"
                  >
                    <div className="flex items-center gap-3 bg-muted/35 px-4 py-3 sm:px-5">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={`areas-${group.grade}`}
                        onClick={() =>
                          setExpandedGrades((current) => ({
                            ...current,
                            [group.grade]: !isExpanded,
                          }))
                        }
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <ChevronDown
                          className={cn(
                            "size-5 shrink-0 transition-transform duration-200",
                            !isExpanded && "-rotate-90",
                          )}
                        />
                        <span className="text-base font-semibold">{GRADE_LABELS[group.grade]}</span>
                        <Badge variant="secondary">
                          {group.areas.length} {group.areas.length === 1 ? "area" : "areas"}
                        </Badge>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAreaOpen(true)}
                        className="hidden text-sm font-medium text-primary hover:underline sm:block"
                      >
                        + Add
                      </button>
                    </div>
                    {isExpanded && (
                      <div id={`areas-${group.grade}`}>
                        {group.areas.length === 0 ? (
                          <div className="px-5 py-7 text-sm text-muted-foreground">
                            No learning areas added for this grade.{" "}
                            <button
                              type="button"
                              className="font-medium text-primary hover:underline"
                              onClick={() => setAreaOpen(true)}
                            >
                              Add learning area
                            </button>
                          </div>
                        ) : (
                          <div className="divide-y">
                            {group.areas.map((area) => (
                              <div
                                key={`${group.grade}-${area.id}`}
                                className="group/row flex items-center gap-3 px-4 py-4 transition-colors hover:bg-accent/35 sm:px-5"
                              >
                                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[1.5fr_0.8fr_0.8fr] sm:items-center">
                                  <div className="min-w-0">
                                    <p className="truncate font-medium">
                                      {area.name.replace(/\b\w/g, (letter) => letter.toUpperCase())}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground sm:hidden">
                                      Learning area
                                    </p>
                                  </div>
                                  <div className="min-w-0">
                                    <Badge
                                      variant="outline"
                                      className="whitespace-nowrap font-mono text-[11px] tracking-wide"
                                    >
                                      {area.code ?? "—"}
                                    </Badge>
                                    <span className="ml-2 text-xs text-muted-foreground sm:hidden">
                                      Code
                                    </span>
                                  </div>
                                  <Badge
                                    variant={area.is_core ? "default" : "secondary"}
                                    className={cn(
                                      "w-fit text-[11px]",
                                      !area.is_core && "border-emerald-200 bg-emerald-50 text-emerald-700",
                                    )}
                                  >
                                    {area.is_core ? "Core" : "Elective"}
                                  </Badge>
                                </div>
                                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-200 group-hover/row:opacity-100 group-focus-within/row:opacity-100 sm:opacity-0">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 text-muted-foreground hover:text-foreground"
                                    aria-label={`View ${area.name}`}
                                    onClick={() => setViewingAreaId(area.id)}
                                  >
                                    <Eye className="size-4" />
                                  </Button>
                                  {isCurriculumManager && (
                                    <>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 text-muted-foreground hover:text-foreground"
                                        aria-label={`Edit ${area.name}`}
                                        onClick={() => openEditArea(area)}
                                      >
                                        <Pencil className="size-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-8 text-destructive hover:text-destructive"
                                        aria-label={`Delete ${area.name}`}
                                        onClick={() => setDeleteAreaId(area.id)}
                                      >
                                        <Trash2 className="size-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
          </div>

          <Dialog open={viewingArea !== null} onOpenChange={(open) => !open && setViewingAreaId(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{viewingArea?.name ?? "Learning area"}</DialogTitle>
              </DialogHeader>
              {viewingArea && (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Name
                      </p>
                      <p className="font-medium">{viewingArea.name}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Code
                      </p>
                      <Badge variant="outline" className="font-mono text-[11px] tracking-wide">
                        {viewingArea.code ?? "—"}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Abbreviation
                      </p>
                      <p className="font-medium">{viewingArea.code ?? "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Type
                      </p>
                      <Badge
                        variant={viewingArea.is_core ? "default" : "secondary"}
                        className={cn("w-fit", !viewingArea.is_core && "border-emerald-200 bg-emerald-50 text-emerald-700")}
                      >
                        {viewingArea.is_core ? "Core" : "Elective"}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Grades / streams assigned
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(streams.data ?? [])
                        .filter((stream) =>
                          (viewingArea.grades ?? []).includes(stream.grade as CbeGrade) &&
                          (allocations.data ?? []).some(
                            (allocation) =>
                              allocation.learning_area_id === viewingArea.id &&
                              allocation.stream_id === stream.id,
                          ),
                        )
                        .map((stream) => (
                          <Badge key={stream.id} variant="secondary">
                            {GRADE_LABELS[stream.grade as CbeGrade]} · {stream.name}
                          </Badge>
                        ))}
                    </div>
                    {!(streams.data ?? []).some(
                      (stream) =>
                        (viewingArea.grades ?? []).includes(stream.grade as CbeGrade) &&
                        (allocations.data ?? []).some(
                          (allocation) =>
                            allocation.learning_area_id === viewingArea.id &&
                            allocation.stream_id === stream.id,
                        ),
                    ) && <p className="text-sm text-muted-foreground">No streams assigned yet.</p>}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Linked assessments
                    </p>
                    {(assessments.data ?? []).filter((item) => item.learning_area_id === viewingArea.id).length > 0 ? (
                      <ul className="space-y-2 text-sm">
                        {(assessments.data ?? [])
                          .filter((item) => item.learning_area_id === viewingArea.id)
                          .map((item) => (
                            <li key={item.id} className="rounded-lg border bg-muted/30 px-3 py-2">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium">{item.title}</span>
                                <Badge variant="outline">{item.status}</Badge>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {GRADE_LABELS[item.grade as CbeGrade]} · {item.assessment_type} · {item.max_score} pts
                              </p>
                            </li>
                          ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No assessments are linked to this learning area.</p>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={editingAreaId !== null} onOpenChange={(open) => { if (!open) closeEditArea(); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit learning area</DialogTitle>
              </DialogHeader>
              {editingArea && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-la-name">Name</Label>
                      <Input
                        id="edit-la-name"
                        value={editAreaName}
                        onChange={(e) => setEditAreaName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-la-code">Code</Label>
                      <Input
                        id="edit-la-code"
                        value={editAreaCode}
                        onChange={(e) => setEditAreaCode(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-la-abbreviation">Abbreviation</Label>
                      <Input
                        id="edit-la-abbreviation"
                        value={editAreaAbbreviation}
                        onChange={(e) => setEditAreaAbbreviation(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-3 pt-7">
                      <Switch id="edit-la-core" checked={editAreaCore} onCheckedChange={setEditAreaCore} />
                      <Label htmlFor="edit-la-core">Core learning area</Label>
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={closeEditArea}>Cancel</Button>
                <Button onClick={() => updateArea.mutate()} disabled={updateArea.isPending}>
                  Save changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog
            open={deleteAreaId !== null}
            onOpenChange={(open) => {
              if (!open) setDeleteAreaId(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete learning area?</AlertDialogTitle>
                <AlertDialogDescription>
                  {areas.data?.find((area) => area.id === deleteAreaId)?.name ?? "This learning area"} will be removed from the curriculum setup.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteAreaId(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    if (!deleteAreaId) return;
                    const area = areas.data?.find((item) => item.id === deleteAreaId);
                    if (!area) {
                      setDeleteAreaId(null);
                      return;
                    }

                    void (async () => {
                      try {
                        await deleteArea.mutateAsync(area.id);
                        setDeleteAreaId(null);
                      } catch {
                        setDeleteAreaId(null);
                      }
                    })();
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>
              {areas.isLoading
                ? "Loading…"
                : `${areaRecordCount} record${areaRecordCount === 1 ? "" : "s"} · page ${currentAreaPage} of ${areaPageCount}`}
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={String(areaPageSize)}
                onValueChange={(value) => {
                  setAreaPageSize(Number(value));
                  setAreaPage(1);
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
                disabled={currentAreaPage <= 1}
                onClick={() => setAreaPage(currentAreaPage - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={currentAreaPage >= areaPageCount}
                onClick={() => setAreaPage(currentAreaPage + 1)}
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pathways">
          <SeniorPathwaysPanel schoolId={schoolId} />
        </TabsContent>

        <TabsContent value="allocations">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">Why allocations matter</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              The timetable generator places every allocation across the week, never double-booking
              a teacher, a class or a room. Set periods per week to match the CBE time allocation
              for each learning area.
            </CardContent>
          </Card>
          <div className="surface-soft mb-4 flex flex-col gap-3 p-3 md:flex-row md:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={allocationQuery} onChange={(event) => setAllocationQuery(event.target.value)} placeholder="Search allocations…" className="bg-card pl-9" aria-label="Search allocations" />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={toggleAllAllocationSections}>
              {allAllocationSectionsExpanded ? "Collapse all" : "Expand all"}
            </Button>
            <Dialog open={allocOpen} onOpenChange={setAllocOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 size-4" /> Allocate teacher
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Allocate a teacher</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Teacher</Label>
                      <Select value={allocStaff} onValueChange={setAllocStaff}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select teacher" />
                        </SelectTrigger>
                        <SelectContent>
                          {(staff.data ?? []).map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.full_name} · {s.staff_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Grade</Label>
                        <Select
                          value={allocGrade}
                          onValueChange={(value) => {
                            setAllocGrade(value as CbeGrade);
                            setAllocStream("");
                            setAllocArea("");
                            setAllocPeriods("4");
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                          <SelectContent>
                            {school.grades.map((grade) => <SelectItem key={grade} value={grade}>{GRADE_LABELS[grade]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className={cn(!allocGrade && "text-muted-foreground")}>Stream</Label>
                        <Select value={allocStream} onValueChange={setAllocStream} disabled={!allocGrade}>
                          <SelectTrigger className={!allocGrade ? "border-muted bg-muted/40 text-muted-foreground" : undefined}><SelectValue placeholder={allocGrade ? "Select stream" : "Select a grade first"} /></SelectTrigger>
                          <SelectContent>
                            {(streams.data ?? []).filter((stream) => stream.grade === allocGrade).map((stream) => <SelectItem key={stream.id} value={stream.id}>{stream.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className={cn(!allocGrade && "text-muted-foreground")}>Learning area</Label>
                      <Select value={allocArea} onValueChange={(value) => { setAllocArea(value); setAllocPeriods("4"); }} disabled={!allocGrade}>
                        <SelectTrigger className={!allocGrade ? "border-muted bg-muted/40 text-muted-foreground" : undefined}>
                          <SelectValue placeholder={allocGrade ? "Select learning area" : "Select a grade first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {allocationAreas.isLoading ? <SelectItem value="loading" disabled>Loading learning areas…</SelectItem> : allocationAreas.data?.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="alloc-periods">Periods per week</Label>
                      <Input
                        id="alloc-periods"
                        type="number"
                        min={1}
                        max={20}
                        value={allocPeriods}
                        onChange={(e) => setAllocPeriods(e.target.value)}
                      />
                      {allocGrade && <p className="text-xs text-muted-foreground">Use the CBE standard for this learning area where available. This value remains editable.</p>}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => createAllocation.mutate()}
                      disabled={createAllocation.isPending || !allocStaff || !allocGrade || !allocStream || !allocArea}
                    >
                      Save allocation
                    </Button>
                  </DialogFooter>
                </DialogContent>
            </Dialog>
          </div>

          {allocations.isLoading ? (
            <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Loading allocations…</div>
          ) : (
            <div className="space-y-3" aria-live="polite">
              {allocationGroups.map((group) => {
                const gradeCount = group.streams.reduce((total, item) => total + item.allocations.length, 0);
                const gradeOpen = allocGradeOpen[group.grade] ?? false;
                return (
                  <section key={group.grade} className="overflow-hidden rounded-xl border bg-card shadow-sm shadow-primary/5">
                    <button type="button" className="flex w-full items-center gap-3 bg-muted/35 px-4 py-4 text-left sm:px-5" aria-expanded={gradeOpen} onClick={() => setAllocGradeOpen((current) => ({ ...current, [group.grade]: !gradeOpen }))}>
                      <ChevronDown className={cn("size-5 shrink-0 transition-transform duration-200", !gradeOpen && "-rotate-90")} />
                      <span className="text-base font-semibold">{GRADE_LABELS[group.grade]}</span>
                      <Badge variant="secondary">{gradeCount} {gradeCount === 1 ? "allocation" : "allocations"}</Badge>
                    </button>
                    {gradeOpen && <div className="space-y-2 border-t p-3 sm:p-4">
                      {group.streams.length === 0 && <div className="px-3 py-4 text-sm text-muted-foreground">No active streams for this grade. <button type="button" className="font-medium text-primary hover:underline" onClick={() => setAllocOpen(true)}>+ Add allocation</button></div>}
                      {group.streams.map(({ stream, allocations: streamAllocations }) => {
                        const streamOpen = allocStreamOpen[stream.id] ?? false;
                        return (
                          <div key={stream.id} className="border-l-2 border-primary/20 pl-3">
                            <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left hover:bg-accent/35" aria-expanded={streamOpen} onClick={() => setAllocStreamOpen((current) => ({ ...current, [stream.id]: !streamOpen }))}>
                              <ChevronDown className={cn("size-4 shrink-0 transition-transform duration-200", !streamOpen && "-rotate-90")} />
                              <span className="font-medium">{stream.name}</span>
                              <Badge variant="outline">{streamAllocations.length} {streamAllocations.length === 1 ? "allocation" : "allocations"}</Badge>
                            </button>
                            {streamOpen && (streamAllocations.length === 0 ? (
                              <div className="px-3 py-4 text-sm text-muted-foreground">No allocations for this stream. <button type="button" className="font-medium text-primary hover:underline" onClick={() => { setAllocStream(stream.id); setAllocOpen(true); }}>+ Add allocation</button></div>
                            ) : (
                              <div className="overflow-hidden rounded-md border">
                                <div className="hidden grid-cols-[1.4fr_1fr_120px_100px] gap-3 bg-muted/35 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid"><span>Learning area</span><span>Teacher</span><span className="text-right">Periods / week</span><span /></div>
                                {streamAllocations.map((allocation) => {
                                  const scheduledCount = allocationSlots.filter((slot) => slot.stream_id === allocation.stream_id && slot.learning_area_id === allocation.learning_area_id).length;
                                  return <div key={allocation.id} className="grid gap-3 border-t px-3 py-3 sm:grid-cols-[1.4fr_1fr_120px_100px] sm:items-center">
                                    <span className="font-medium">{areaName_(allocation.learning_area_id)}</span>
                                    <span className="text-sm text-muted-foreground">{staffName(allocation.staff_id)}</span>
                                    <Badge variant="secondary" className="w-fit justify-self-start font-mono sm:justify-self-end">{allocation.periods_per_week}</Badge>
                                    <div className="flex justify-end gap-1">
                                      <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="View allocation" onClick={() => setViewingAllocationId(allocation.id)}><Eye className="size-4" /></Button>
                                      {isCurriculumManager && <><Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Edit allocation" onClick={() => openAllocationEdit(allocation)}><Pencil className="size-4" /></Button><Button type="button" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" aria-label="Delete allocation" onClick={() => setDeleteAllocationId(allocation.id)}><Trash2 className="size-4" /></Button></>}
                                    </div>
                                  </div>;
                                })}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>}
                  </section>
                );
              })}
            </div>
          )}

          <DetailPanel open={viewingAllocation !== null} onOpenChange={(open) => !open && setViewingAllocationId(null)} entityType="allocation" title={viewingAllocation ? areaName_(viewingAllocation.learning_area_id) : "Allocation"} subtitle={viewingAllocation ? streamLabel(viewingAllocation.stream_id) : undefined}>
            {viewingAllocation && <div className="space-y-4 text-sm"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Learning area</p><p className="font-medium">{areaName_(viewingAllocation.learning_area_id)}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Teacher</p><p className="font-medium">{staffName(viewingAllocation.staff_id)}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Periods / week</p><p className="font-medium">{viewingAllocation.periods_per_week}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Academic year / term</p><p className="font-medium">{school.years.find((year) => year.id === viewingAllocation.academic_year_id)?.name ?? "Current academic year"} · {school.terms.find((term) => term.id === school.termId)?.name ?? "Current term"}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Generated timetable</p><p className="font-medium">{allocationSlots.filter((slot) => slot.stream_id === viewingAllocation.stream_id && slot.learning_area_id === viewingAllocation.learning_area_id).length} scheduled periods</p></div></div>}
          </DetailPanel>

          <Dialog open={editingAllocation !== null} onOpenChange={(open) => !open && setEditingAllocationId(null)}><DialogContent><DialogHeader><DialogTitle>Edit allocation</DialogTitle></DialogHeader>{editingAllocation && <div className="space-y-4"><div className="space-y-1.5"><Label>Teacher</Label><Select value={editStaff} onValueChange={setEditStaff}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(staff.data ?? []).map((member) => <SelectItem key={member.id} value={member.id}>{member.full_name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label htmlFor="edit-alloc-periods">Periods per week</Label><Input id="edit-alloc-periods" type="number" min={1} max={20} value={editPeriods} onChange={(event) => setEditPeriods(event.target.value)} /></div><p className="text-xs text-muted-foreground">Match the CBE time allocation shown above. A different value will be saved, but verify it before generating the timetable.</p></div>}<DialogFooter><Button variant="outline" onClick={() => setEditingAllocationId(null)}>Cancel</Button><Button onClick={() => updateAllocation.mutate()} disabled={updateAllocation.isPending}>Save changes</Button></DialogFooter></DialogContent></Dialog>

          <AlertDialog open={deleteAllocationId !== null} onOpenChange={(open) => !open && setDeleteAllocationId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete allocation?</AlertDialogTitle><AlertDialogDescription>This removes the teacher assignment from this stream and learning area. Allocations with scheduled timetable periods cannot be deleted.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteAllocationId && deleteAllocation.mutate(deleteAllocationId)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        </TabsContent>
      </Tabs>
    </>
  );
}
