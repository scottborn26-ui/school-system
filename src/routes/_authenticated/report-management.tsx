import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Eye, FileCheck2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/app-shell";
import { DataTable, type Column } from "@/components/data-table";
import { RequireSchool } from "@/components/require-school";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/_authenticated/report-management")({
  head: () => ({ meta: [{ title: "Report office · SHANSCOTT CBE" }] }),
  component: () => (
    <RequireSchool roles={["admin", "exam_officer"]}>
      <ReportManagementPage />
    </RequireSchool>
  ),
});

type ReportCardRow = {
  id: string;
  learner_id: string;
  grade: CbeGrade | null;
  term_id: string | null;
  version: number;
  status: string;
  mean_percentage: number | null;
  updated_at: string;
  payload: { learner?: { name?: string; admission_number?: string; stream?: string } };
};

function ReportManagementPage() {
  const school = useSchool();
  const qc = useQueryClient();
  const schoolId = school.schoolId!;
  const [status, setStatus] = useState("all");
  const [grade, setGrade] = useState("all");
  const [term, setTerm] = useState(school.termId ?? "all");

  const cards = useQuery({
    queryKey: ["report-management", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_cards")
        .select(
          "id, learner_id, grade, term_id, version, status, mean_percentage, updated_at, payload",
        )
        .eq("school_id", schoolId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReportCardRow[];
    },
  });

  const remove = useMutation({
    mutationFn: async (card: ReportCardRow) => {
      const learner = card.payload.learner?.name ?? "this learner";
      if (!window.confirm(`Permanently delete the report for ${learner}? This cannot be undone.`))
        return;
      const { error } = await supabase.rpc("delete_report_card_permanently", {
        _school_id: schoolId,
        _report_card_id: card.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Report card permanently deleted.");
      void qc.invalidateQueries({ queryKey: ["report-management", schoolId] });
      void qc.invalidateQueries({ queryKey: ["report-cards", schoolId] });
    },
    onError: (error: Error) =>
      toast.error("Could not delete report card.", { description: error.message }),
  });

  const rows = (cards.data ?? []).filter(
    (card) =>
      (status === "all" || card.status === status) &&
      (grade === "all" || card.grade === grade) &&
      (term === "all" || card.term_id === term),
  );
  const columns: Column<ReportCardRow>[] = [
    {
      key: "learner",
      header: "Learner",
      sortable: true,
      sortValue: (row) => row.payload.learner?.name ?? "",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.payload.learner?.name ?? "Unknown learner"}</p>
          <p className="text-xs text-muted-foreground">
            {row.payload.learner?.admission_number ?? "No admission number"}
          </p>
        </div>
      ),
    },
    { key: "grade", header: "Grade", cell: (row) => (row.grade ? GRADE_LABELS[row.grade] : "—") },
    { key: "stream", header: "Stream", cell: (row) => row.payload.learner?.stream ?? "—" },
    { key: "version", header: "Version", cell: (row) => `v${row.version}` },
    {
      key: "mean",
      header: "Mean",
      cell: (row) => `${Number(row.mean_percentage ?? 0).toFixed(1)}%`,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <Badge variant={row.status === "published" ? "default" : "secondary"}>{row.status}</Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button asChild variant="ghost" size="sm" title="View report">
            <Link to="/reports" search={{ card: row.id }}>
              <Eye className="size-4" /> <span className="sr-only">View</span>
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            title="Edit report"
            disabled={row.status !== "draft"}
          >
            <Link to="/reports" search={{ card: row.id }}>
              <Pencil className="size-4" /> <span className="sr-only">Edit</span>
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            title="Permanently delete report"
            className="text-destructive hover:text-destructive"
            onClick={() => remove.mutate(row)}
            disabled={remove.isPending}
          >
            <Trash2 className="size-4" /> <span className="sr-only">Delete</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Exam office · Report cards"
        description="View, edit drafts, and permanently delete report cards."
        icon={FileCheck2}
      />
      <DataTable
        rows={rows}
        columns={columns}
        loading={cards.isLoading}
        rowKey={(row) => row.id}
        searchPlaceholder="Search learner or admission number"
        searchValue={(row) =>
          `${row.payload.learner?.name ?? ""} ${row.payload.learner?.admission_number ?? ""}`
        }
        filters={
          <>
            <Select value={term} onValueChange={setTerm}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Term" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All terms</SelectItem>
                {school.terms.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={grade} onValueChange={setGrade}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All grades</SelectItem>
                {school.grades.map((item) => (
                  <SelectItem key={item} value={item}>
                    {GRADE_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        onReset={() => {
          setTerm(school.termId ?? "all");
          setGrade("all");
          setStatus("all");
        }}
        emptyTitle="No report cards found"
        emptyDescription="Adjust the filters or generate report cards from the Report Cards page."
      />
    </>
  );
}
