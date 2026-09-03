import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
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

type AssignmentRow = {
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

export const Route = createFileRoute("/_authenticated/approved-assignments")({
  head: () => ({
    meta: [
      { title: "Approved assignments · SHANSCOTT CBE" },
      { name: "description", content: "View approved assignments grouped by grade." },
    ],
  }),
  component: () => (
    <RequireSchool roles={["principal", "deputy", "teacher", "class_teacher", "super_admin"]}>
      <ApprovedAssignmentsPage />
    </RequireSchool>
  ),
});

function ApprovedAssignmentsPage() {
  const school = useSchool();
  const qc = useQueryClient();
  const schoolId = school.schoolId!;
  const isAdmin = school.can("principal", "deputy", "super_admin");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewing, setViewing] = useState<AssignmentRow | null>(null);
  const [editing, setEditing] = useState<AssignmentRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState("formative");
  const [editDate, setEditDate] = useState("");
  const [editMaxScore, setEditMaxScore] = useState("100");

  const assignments = useQuery({
    queryKey: ["approved-assignments", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select(
          "id, title, grade, stream_id, learning_area_id, assessment_type, max_score, assessment_date, status",
        )
        .eq("school_id", schoolId)
        .eq("status", "approved")
        .order("assessment_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AssignmentRow[];
    },
  });

  const areas = useQuery({
    queryKey: ["approved-assignment-areas", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_areas")
        .select("id, name")
        .eq("school_id", schoolId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const streams = useQuery({
    queryKey: ["approved-assignment-streams", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streams")
        .select("id, name, grade")
        .eq("school_id", schoolId)
        .eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const marks = useQuery({
    queryKey: ["approved-assignment-marks", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marks")
        .select("assessment_id, learner_id, raw_score, is_absent, is_exempt")
        .eq("school_id", schoolId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateAssignment = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Select an assignment.");
      const title = editTitle.trim();
      const maxScore = Number(editMaxScore);
      if (title.length < 3) throw new Error("Enter an assignment name.");
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
        before_data: { status: "approved", title: editing.title },
        after_data: changes,
      });
    },
    onSuccess: () => {
      toast.success("Approved assignment updated.");
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["approved-assignments", schoolId] });
    },
    onError: (error: Error) =>
      toast.error("Could not update assignment.", { description: error.message }),
  });

  const deleteAssignment = useMutation({
    mutationFn: async (assignment: AssignmentRow) => {
      const markCount =
        marks.data?.filter((mark) => mark.assessment_id === assignment.id).length ?? 0;
      if (
        window.prompt(
          `This approved assignment has marks for ${markCount} learners. Type DELETE to confirm deletion.`,
        ) !== "DELETE"
      )
        throw new Error("Deletion cancelled.");
      const { error } = await supabase.from("assessments").delete().eq("id", assignment.id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        school_id: schoolId,
        actor_id: school.userId,
        actor_name: school.fullName,
        action: "delete",
        entity: "assessment",
        entity_id: assignment.id,
        before_data: {
          title: assignment.title,
          grade: assignment.grade,
          status: assignment.status,
          marks: markCount,
        },
      });
    },
    onSuccess: () => {
      toast.success("Approved assignment deleted.");
      void qc.invalidateQueries({ queryKey: ["approved-assignments", schoolId] });
    },
    onError: (error: Error) => {
      if (error.message !== "Deletion cancelled.")
        toast.error("Could not delete assignment.", { description: error.message });
    },
  });

  const areaName = (id: string) =>
    areas.data?.find((area) => area.id === id)?.name ?? "Learning area";
  const streamLabel = (assignment: AssignmentRow) =>
    assignment.stream_id
      ? (streams.data?.find((stream) => stream.id === assignment.stream_id)?.name ?? "Stream")
      : `${streams.data?.filter((stream) => stream.grade === assignment.grade).length ?? 0} streams`;
  const progress = (assignment: AssignmentRow) => {
    const learnerIds =
      marks.data
        ?.filter(
          (mark) =>
            mark.assessment_id === assignment.id &&
            (mark.raw_score !== null || mark.is_absent || mark.is_exempt),
        )
        .map((mark) => mark.learner_id) ?? [];
    return learnerIds.length;
  };
  const rows = (assignments.data ?? []).filter(
    (assignment) =>
      (gradeFilter === "all" || assignment.grade === gradeFilter) &&
      (typeFilter === "all" || assignment.assessment_type === typeFilter),
  );
  const columns: Column<AssignmentRow>[] = [
    {
      key: "title",
      header: "Assignment",
      sortable: true,
      sortValue: (row) => row.title,
      cell: (row) => <span className="font-medium">{row.title}</span>,
    },
    {
      key: "grade",
      header: "Grade",
      cell: (row) => <Badge variant="outline">{GRADE_LABELS[row.grade]}</Badge>,
    },
    { key: "stream", header: "Applies to", cell: streamLabel },
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
    { key: "score", header: "Max score", cell: (row) => row.max_score },
    { key: "marked", header: "Marked", cell: (row) => progress(row) },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="View"
            aria-label={`View ${row.title}`}
            onClick={() => setViewing(row)}
          >
            <Eye className="size-4" />
          </Button>
          {isAdmin && (
            <>
              <Button
                variant="ghost"
                size="icon"
                title="Edit"
                aria-label={`Edit ${row.title}`}
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
                title="Delete"
                aria-label={`Delete ${row.title}`}
                className="text-destructive hover:text-destructive"
                onClick={() => deleteAssignment.mutate(row)}
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];
  const typeOptions = [
    ...new Set((assignments.data ?? []).map((assignment) => assignment.assessment_type)),
  ];

  return (
    <>
      <PageHeader
        title="Approved assignments"
        description="View approved assignments grouped by grade."
        icon={ClipboardCheck}
        actions={
          <Button asChild>
            <Link to="/assignments">
              <Plus className="mr-2 size-4" /> Add assignment
            </Link>
          </Button>
        }
      />
      <DataTable
        rows={rows}
        columns={columns}
        loading={assignments.isLoading}
        rowKey={(row) => row.id}
        searchPlaceholder="Search approved assignments…"
        searchValue={(row) =>
          `${row.title} ${row.grade} ${areaName(row.learning_area_id)} ${row.assessment_type}`
        }
        onReset={() => {
          setGradeFilter("all");
          setTypeFilter("all");
        }}
        emptyTitle="No approved assignments"
        emptyDescription="Approved assignments will appear here."
        groupBy={(row) => row.grade}
        groupLabel={(grade) => (
          <span>
            {GRADE_LABELS[grade as CbeGrade]}{" "}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {rows.filter((row) => row.grade === grade).length} assignment
              {rows.filter((row) => row.grade === grade).length === 1 ? "" : "s"}
            </span>
          </span>
        )}
        filters={
          <div className="flex flex-wrap gap-2">
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger className="w-[145px]" aria-label="Filter by grade">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All grades</SelectItem>
                {school.grades.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    {GRADE_LABELS[grade]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[145px]" aria-label="Filter by type">
                <SelectValue />
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
                <p className="font-medium">{streamLabel(viewing)}</p>
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
                <span className="text-muted-foreground">Status</span>
                <p className="font-medium capitalize">{viewing.status}</p>
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
            <DialogTitle>Edit approved assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="approved-edit-title">Assignment name</Label>
              <Input
                id="approved-edit-title"
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="approved-edit-type">Assessment type</Label>
              <Input
                id="approved-edit-type"
                value={editType}
                onChange={(event) => setEditType(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="approved-edit-date">Date</Label>
              <Input
                id="approved-edit-date"
                type="date"
                value={editDate}
                onChange={(event) => setEditDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="approved-edit-score">Maximum score</Label>
              <Input
                id="approved-edit-score"
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
            <Button onClick={() => updateAssignment.mutate()} disabled={updateAssignment.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
