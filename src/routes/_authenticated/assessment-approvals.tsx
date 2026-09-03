import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCheck, ClipboardCheck, Eye, Pencil, Trash2 } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export const Route = createFileRoute("/_authenticated/assessment-approvals")({
  head: () => ({
    meta: [
      { title: "Assessment approvals · SHANSCOTT CBE" },
      { name: "description", content: "Review and approve submitted assessments." },
    ],
  }),
  component: () => (
    <RequireSchool roles={["admin", "exam_officer", "principal", "deputy", "super_admin"]}>
      <AssessmentApprovalsPage />
    </RequireSchool>
  ),
});

type ApprovalRow = {
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

function AssessmentApprovalsPage() {
  const school = useSchool();
  const qc = useQueryClient();
  const schoolId = school.schoolId!;
  const [gradeFilter, setGradeFilter] = useState("all");
  const [viewing, setViewing] = useState<ApprovalRow | null>(null);
  const [editing, setEditing] = useState<ApprovalRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState("formative");
  const [editDate, setEditDate] = useState("");
  const [editMaxScore, setEditMaxScore] = useState("100");

  const assessments = useQuery({
    queryKey: ["assessment-approvals", schoolId, school.academicYearId, school.termId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select(
          "id, title, grade, stream_id, learning_area_id, assessment_type, max_score, assessment_date, status",
        )
        .eq("school_id", schoolId)
        .eq("status", "submitted")
        .order("assessment_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ApprovalRow[];
    },
  });

  const streams = useQuery({
    queryKey: ["assessment-approval-streams", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streams")
        .select("id, name, grade")
        .eq("school_id", schoolId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const areas = useQuery({
    queryKey: ["assessment-approval-areas", schoolId],
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
    queryKey: ["assessment-approval-learners", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learners")
        .select(
          "id, admission_number, first_name, middle_name, last_name, current_grade, current_stream_id",
        )
        .eq("school_id", schoolId)
        .eq("is_archived", false);
      if (error) throw error;
      return data ?? [];
    },
  });

  const marks = useQuery({
    queryKey: ["assessment-approval-marks", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marks")
        .select("assessment_id, learner_id, raw_score, is_absent, is_exempt")
        .eq("school_id", schoolId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const approve = useMutation({
    mutationFn: async (assessment: ApprovalRow) => {
      const { error } = await supabase
        .from("assessments")
        .update({ status: "approved" })
        .eq("id", assessment.id)
        .eq("status", "submitted");
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        school_id: schoolId,
        actor_id: school.userId,
        actor_name: school.fullName,
        action: "update",
        entity: "assessment",
        entity_id: assessment.id,
        before_data: { status: "submitted" },
        after_data: { status: "approved" },
      });
    },
    onSuccess: () => {
      toast.success("Assessment approved.");
      void qc.invalidateQueries({ queryKey: ["assessment-approvals", schoolId] });
      void qc.invalidateQueries({ queryKey: ["assessment-browser", schoolId] });
    },
    onError: (error: Error) =>
      toast.error("Could not approve assessment.", { description: error.message }),
  });

  const updateAssessment = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Select an assessment.");
      const title = editTitle.trim();
      const maxScore = Number(editMaxScore);
      if (title.length < 3) throw new Error("Enter an assessment name.");
      if (!Number.isFinite(maxScore) || maxScore <= 0)
        throw new Error("Maximum score must be greater than zero.");
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
        before_data: { status: "submitted", title: editing.title },
        after_data: changes,
      });
    },
    onSuccess: () => {
      toast.success("Assessment updated.");
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["assessment-approvals", schoolId] });
    },
    onError: (error: Error) =>
      toast.error("Could not update assessment.", { description: error.message }),
  });

  const deleteAssessment = useMutation({
    mutationFn: async (assessment: ApprovalRow) => {
      const markCount =
        marks.data?.filter((mark) => mark.assessment_id === assessment.id).length ?? 0;
      if (
        window.prompt(
          `This assessment has marks for ${markCount} learners. Type DELETE to confirm deletion.`,
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
        before_data: {
          title: assessment.title,
          grade: assessment.grade,
          status: assessment.status,
          marks: markCount,
        },
      });
    },
    onSuccess: () => {
      toast.success("Assessment deleted.");
      void qc.invalidateQueries({ queryKey: ["assessment-approvals", schoolId] });
    },
    onError: (error: Error) => {
      if (error.message !== "Deletion cancelled.")
        toast.error("Could not delete assessment.", { description: error.message });
    },
  });

  const areaName = (id: string) =>
    areas.data?.find((area) => area.id === id)?.name ?? "Learning area";
  const streamLabel = (assessment: ApprovalRow) =>
    assessment.stream_id
      ? (streams.data?.find((stream) => stream.id === assessment.stream_id)?.name ?? "Stream")
      : `${streams.data?.filter((stream) => stream.grade === assessment.grade).length ?? 0} streams`;
  const progress = (assessment: ApprovalRow) => {
    const applicable = (learners.data ?? []).filter(
      (learner) =>
        learner.current_grade === assessment.grade &&
        (!assessment.stream_id || learner.current_stream_id === assessment.stream_id),
    );
    const marked = applicable.filter((learner) =>
      marks.data?.some(
        (mark) =>
          mark.assessment_id === assessment.id &&
          mark.learner_id === learner.id &&
          (mark.raw_score !== null || mark.is_absent || mark.is_exempt),
      ),
    ).length;
    return `${marked} / ${applicable.length}`;
  };

  const rows = (assessments.data ?? []).filter(
    (assessment) => gradeFilter === "all" || assessment.grade === gradeFilter,
  );
  const columns: Column<ApprovalRow>[] = [
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
    {
      key: "date",
      header: "Date",
      sortable: true,
      sortValue: (row) => row.assessment_date,
      cell: (row) => row.assessment_date,
    },
    { key: "progress", header: "Marked", cell: progress },
    {
      key: "action",
      header: "Actions",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="View students and marks"
            aria-label={`View ${row.title}`}
            onClick={() => setViewing(row)}
          >
            <Eye className="size-4" />
          </Button>
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
            onClick={() => deleteAssessment.mutate(row)}
          >
            <Trash2 className="size-4" />
          </Button>
          <Button size="sm" onClick={() => approve.mutate(row)} disabled={approve.isPending}>
            <CheckCheck className="mr-2 size-4" /> Approve
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Assessment approvals"
        description="Review assessments submitted by teachers and approve them for reporting."
        icon={ClipboardCheck}
      />
      <DataTable
        rows={rows}
        columns={columns}
        loading={assessments.isLoading}
        rowKey={(row) => row.id}
        searchPlaceholder="Search submitted assessments…"
        searchValue={(row) =>
          `${row.title} ${row.grade} ${areaName(row.learning_area_id)} ${row.assessment_type}`
        }
        onReset={() => setGradeFilter("all")}
        emptyTitle="No assessments awaiting approval"
        emptyDescription="Submitted assessments will appear here for review."
        filters={
          <Select value={gradeFilter} onValueChange={setGradeFilter}>
            <SelectTrigger className="w-[155px]" aria-label="Filter by grade">
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
        }
      />
      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{viewing?.title} · Student marks</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="max-h-[60vh] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Adm. no.</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Stream</TableHead>
                    <TableHead>Mark</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(learners.data ?? [])
                    .filter(
                      (learner) =>
                        learner.current_grade === viewing.grade &&
                        (!viewing.stream_id || learner.current_stream_id === viewing.stream_id),
                    )
                    .map((learner) => {
                      const mark = marks.data?.find(
                        (item) =>
                          item.assessment_id === viewing.id && item.learner_id === learner.id,
                      );
                      const status = mark?.is_absent
                        ? "Absent"
                        : mark?.is_exempt
                          ? "Exempt"
                          : mark?.raw_score !== null && mark?.raw_score !== undefined
                            ? "Marked"
                            : "Not marked";
                      return (
                        <TableRow key={learner.id}>
                          <TableCell className="font-mono text-xs">
                            {learner.admission_number}
                          </TableCell>
                          <TableCell className="font-medium">
                            {learner.first_name} {learner.middle_name ?? ""} {learner.last_name}
                          </TableCell>
                          <TableCell>
                            {streams.data?.find((stream) => stream.id === learner.current_stream_id)
                              ?.name ?? "—"}
                          </TableCell>
                          <TableCell>
                            {mark?.raw_score ?? "—"} / {viewing.max_score}
                          </TableCell>
                          <TableCell>
                            {mark?.percentage !== null && mark?.percentage !== undefined
                              ? `${mark.percentage}%`
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={status === "Marked" ? "default" : "outline"}>
                              {status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
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
            <DialogTitle>Edit submitted assessment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="approval-edit-title">Assessment name</Label>
              <Input
                id="approval-edit-title"
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="approval-edit-type">Assessment type</Label>
              <Input
                id="approval-edit-type"
                value={editType}
                onChange={(event) => setEditType(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="approval-edit-date">Date</Label>
              <Input
                id="approval-edit-date"
                type="date"
                value={editDate}
                onChange={(event) => setEditDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="approval-edit-score">Maximum score</Label>
              <Input
                id="approval-edit-score"
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
