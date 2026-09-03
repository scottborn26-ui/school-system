import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { ClipboardList, Eye, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { DataTable, type Column } from "@/components/data-table";
import { RequireSchool } from "@/components/require-school";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useSchool } from "@/hooks/use-school";
import { GRADE_LABELS, type CbeGrade } from "@/lib/cbe";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/assessments")({
  head: () => ({
    meta: [
      { title: "Assessments · SHANSCOTT CBE" },
      {
        name: "description",
        content: "Browse school assessments by grade, stream, learning area and status.",
      },
    ],
  }),
  component: () => (
    <RequireSchool roles={["admin", "exam_officer", "principal", "deputy", "teacher", "class_teacher", "super_admin"]}>
      <AssessmentsPage />
    </RequireSchool>
  ),
});

type AssessmentRow = {
  id: string;
  title: string;
  grade: CbeGrade;
  stream_id: string | null;
  learning_area_id: string;
  assessment_type: string;
  max_score: number;
  assessment_date: string;
  status: string;
};

function AssessmentsPage() {
  const school = useSchool();
  const qc = useQueryClient();
  const schoolId = school.schoolId!;
  const isAdmin = school.can("admin", "exam_officer", "principal", "deputy", "super_admin");
  const [gradeFilter, setGradeFilter] = React.useState("all");
  const [streamFilter, setStreamFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [viewing, setViewing] = React.useState<AssessmentRow | null>(null);
  const [editing, setEditing] = React.useState<AssessmentRow | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editType, setEditType] = React.useState("formative");
  const [editDate, setEditDate] = React.useState("");
  const [editMaxScore, setEditMaxScore] = React.useState("100");

  const assessments = useQuery({
    queryKey: ["assessment-browser", schoolId, school.academicYearId, school.termId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select(
          "id, title, grade, stream_id, learning_area_id, assessment_type, max_score, assessment_date, status",
        )
        .eq("school_id", schoolId)
        .order("assessment_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AssessmentRow[];
    },
  });

  const streams = useQuery({
    queryKey: ["assessment-browser-streams", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streams")
        .select("id, name, grade")
        .eq("school_id", schoolId)
        .order("grade")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const areas = useQuery({
    queryKey: ["assessment-browser-areas", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_areas")
        .select("id, name")
        .eq("school_id", schoolId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const learners = useQuery({
    queryKey: ["assessment-browser-learners", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learners")
        .select("id, current_grade, current_stream_id")
        .eq("school_id", schoolId)
        .eq("is_archived", false);
      if (error) throw error;
      return data ?? [];
    },
  });

  const marks = useQuery({
    queryKey: ["assessment-browser-marks", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marks")
        .select("assessment_id, learner_id, raw_score, is_absent, is_exempt")
        .eq("school_id", schoolId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateAssessment = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Select an assessment.");
      const title = editTitle.trim();
      const maxScore = Number(editMaxScore);
      if (title.length < 3) throw new Error("Enter an assessment name.");
      if (!Number.isFinite(maxScore) || maxScore <= 0)
        throw new Error("Maximum score must be greater than zero.");
      const existingMarks =
        marks.data?.filter((mark) => mark.assessment_id === editing.id).length ?? 0;
      if (
        existingMarks > 0 &&
        maxScore !== Number(editing.max_score) &&
        !window.confirm(
          "Marks already exist. Existing scores will remain unchanged and may need review. Continue?",
        )
      )
        return;
      const changes = {
        title,
        assessment_type: editType,
        assessment_date: editDate,
        max_score: maxScore,
      };
      const { error } = await supabase.from("assessments").update(changes).eq("id", editing.id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        school_id: schoolId,
        actor_id: school.userId,
        actor_name: school.fullName,
        action: "update",
        entity: "assessment",
        entity_id: editing.id,
        before_data: {
          title: editing.title,
          assessment_type: editing.assessment_type,
          assessment_date: editing.assessment_date,
          max_score: editing.max_score,
        },
        after_data: changes,
      });
    },
    onSuccess: () => {
      toast.success("Assignment updated.");
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["assessment-browser", schoolId] });
    },
    onError: (error: Error) =>
      toast.error("Could not update assignment.", { description: error.message }),
  });

  const deleteAssessment = useMutation({
    mutationFn: async (assessment: AssessmentRow) => {
      const markCount =
        marks.data?.filter((mark) => mark.assessment_id === assessment.id).length ?? 0;
      if (
        window.prompt(
          `This assignment has marks for ${markCount} learners. Type DELETE to confirm deletion.`,
        ) !== "DELETE"
      )
        throw new Error("Deletion cancelled.");
      const { error } = await supabase.from("assessments").delete().eq("id", assessment.id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        school_id: schoolId,
        actor_id: school.userId,
        actor_name: school.fullName,
        action: "delete",
        entity: "assessment",
        entity_id: assessment.id,
        before_data: { title: assessment.title, grade: assessment.grade, marks: markCount },
      });
    },
    onSuccess: () => {
      toast.success("Assignment deleted.");
      void qc.invalidateQueries({ queryKey: ["assessment-browser", schoolId] });
    },
    onError: (error: Error) => {
      if (error.message !== "Deletion cancelled.")
        toast.error("Could not delete assignment.", { description: error.message });
    },
  });

  const streamName = (streamId: string | null) =>
    streams.data?.find((stream) => stream.id === streamId)?.name ?? "All streams";
  const areaName = (areaId: string) =>
    areas.data?.find((area) => area.id === areaId)?.name ?? "Learning area";
  const filteredRows = (assessments.data ?? []).filter((assessment) => {
    const matchesGrade = gradeFilter === "all" || assessment.grade === gradeFilter;
    const matchesStream =
      streamFilter === "all" ||
      assessment.stream_id === streamFilter ||
      (assessment.stream_id === null &&
        streams.data?.some(
          (stream) => stream.id === streamFilter && stream.grade === assessment.grade,
        ));
    return (
      matchesGrade &&
      matchesStream &&
      (typeFilter === "all" || assessment.assessment_type === typeFilter)
    );
  });

  const progress = (assessment: AssessmentRow) => {
    const applicableLearners = (learners.data ?? []).filter(
      (learner) =>
        learner.current_grade === assessment.grade &&
        (!assessment.stream_id || learner.current_stream_id === assessment.stream_id),
    );
    const marked = applicableLearners.filter((learner) =>
      marks.data?.some(
        (mark) =>
          mark.assessment_id === assessment.id &&
          mark.learner_id === learner.id &&
          (mark.raw_score !== null || mark.is_absent || mark.is_exempt),
      ),
    ).length;
    return { marked, total: applicableLearners.length };
  };

  const columns: Column<AssessmentRow>[] = [
    {
      key: "title",
      header: "Assessment",
      sortable: true,
      sortValue: (row) => row.title,
      cell: (row) => <span className="font-medium">{row.title}</span>,
    },
    {
      key: "grade",
      header: "Grade",
      sortable: true,
      sortValue: (row) => row.grade,
      cell: (row) => <Badge variant="outline">{GRADE_LABELS[row.grade]}</Badge>,
    },
    {
      key: "stream",
      header: "Streams",
      cell: (row) =>
        row.stream_id
          ? streamName(row.stream_id)
          : `${streams.data?.filter((stream) => stream.grade === row.grade).length ?? 0} streams`,
    },
    { key: "area", header: "Learning area", cell: (row) => areaName(row.learning_area_id) },
    {
      key: "type",
      header: "Type",
      cell: (row) => (
        <Badge variant="secondary" className="capitalize">
          {row.assessment_type}
        </Badge>
      ),
    },
    { key: "score", header: "Max score", className: "text-right", cell: (row) => row.max_score },
    {
      key: "progress",
      header: "Marked",
      cell: (row) => {
        const result = progress(row);
        return `${result.marked} / ${result.total}`;
      },
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <Badge variant={row.status === "locked" ? "default" : "outline"} className="capitalize">
          {row.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`View ${row.title}`}
            title="View"
            onClick={() => setViewing(row)}
          >
            <Eye className="size-4" />
          </Button>
          {isAdmin && (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit ${row.title}`}
                title="Edit"
                disabled={row.status === "locked"}
                onClick={() => {
                  setEditing(row);
                  setEditTitle(row.title);
                  setEditType(row.assessment_type);
                  setEditDate(row.assessment_date);
                  setEditMaxScore(String(row.max_score));
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                aria-label={`Delete ${row.title}`}
                title="Delete"
                onClick={() => deleteAssessment.mutate(row)}
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const gradeOptions = school.grades;
  const typeOptions = [
    ...new Set((assessments.data ?? []).map((assessment) => assessment.assessment_type)),
  ];

  return (
    <>
      <PageHeader
        title="Assessments"
        description="Browse assessments by grade, stream, learning area and marking progress."
        icon={ClipboardList}
      />
      <DataTable
        rows={filteredRows}
        columns={columns}
        loading={assessments.isLoading}
        rowKey={(row) => row.id}
        searchPlaceholder="Search assessments…"
        searchValue={(row) =>
          `${row.title} ${row.grade} ${areaName(row.learning_area_id)} ${row.assessment_type}`
        }
        onReset={() => {
          setGradeFilter("all");
          setStreamFilter("all");
          setTypeFilter("all");
        }}
        emptyTitle="No assessments found"
        emptyDescription="Assessments created in Marks Entry will appear here."
        groupBy={(row) => row.grade}
        groupLabel={(grade) => (
          <span>
            {GRADE_LABELS[grade as CbeGrade]}{" "}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {filteredRows.filter((row) => row.grade === grade).length} assessment
              {filteredRows.filter((row) => row.grade === grade).length === 1 ? "" : "s"}
            </span>
          </span>
        )}
        filters={
          <div className="flex flex-wrap gap-2">
            <Select
              value={gradeFilter}
              onValueChange={(value) => {
                setGradeFilter(value);
                setStreamFilter("all");
              }}
            >
              <SelectTrigger className="w-[145px]" aria-label="Filter by grade">
                <SelectValue placeholder="All grades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All grades</SelectItem>
                {gradeOptions.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    {GRADE_LABELS[grade]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={streamFilter} onValueChange={setStreamFilter}>
              <SelectTrigger className="w-[150px]" aria-label="Filter by stream">
                <SelectValue placeholder="All streams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All streams</SelectItem>
                {(streams.data ?? [])
                  .filter((stream) => gradeFilter === "all" || stream.grade === gradeFilter)
                  .map((stream) => (
                    <SelectItem key={stream.id} value={stream.id}>
                      {stream.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[145px]" aria-label="Filter by type">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {typeOptions.map((type) => (
                  <SelectItem key={type} value={type} className="capitalize">
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />
      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Grade</span>
                <p className="font-medium">{GRADE_LABELS[viewing.grade]}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Learning area</span>
                <p className="font-medium">{areaName(viewing.learning_area_id)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Applies to</span>
                <p className="font-medium">
                  {viewing.stream_id
                    ? streamName(viewing.stream_id)
                    : `${streams.data?.filter((stream) => stream.grade === viewing.grade).length ?? 0} streams`}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Maximum score</span>
                <p className="font-medium">{viewing.max_score}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Date</span>
                <p className="font-medium">{viewing.assessment_date}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Marking progress</span>
                <p className="font-medium">
                  {progress(viewing).marked} / {progress(viewing).total}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="assessment-edit-title">Assignment name</Label>
              <Input
                id="assessment-edit-title"
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assessment-edit-type">Assessment type</Label>
              <Input
                id="assessment-edit-type"
                value={editType}
                onChange={(event) => setEditType(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assessment-edit-date">Date</Label>
              <Input
                id="assessment-edit-date"
                type="date"
                value={editDate}
                onChange={(event) => setEditDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assessment-edit-score">Maximum score</Label>
              <Input
                id="assessment-edit-score"
                type="number"
                min={1}
                value={editMaxScore}
                onChange={(event) => setEditMaxScore(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => updateAssessment.mutate()} disabled={updateAssessment.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
