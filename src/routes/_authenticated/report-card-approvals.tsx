import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { DataTable, type Column } from "@/components/data-table";
import { RequireSchool } from "@/components/require-school";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSchool } from "@/hooks/use-school";
import { GRADE_LABELS, type CbeGrade } from "@/lib/cbe";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/report-card-approvals")({
  head: () => ({
    meta: [
      { title: "Report card approvals · SHANSCOTT CBE" },
      { name: "description", content: "Review and approve draft report cards." },
    ],
  }),
  component: () => (
    <RequireSchool roles={["principal", "deputy", "super_admin"]}>
      <ReportCardApprovalsPage />
    </RequireSchool>
  ),
});

type ReportCardRow = {
  id: string;
  learner_id: string;
  grade: CbeGrade | null;
  version: number;
  status: string;
  mean_percentage: number | null;
  class_position: number | null;
  class_size: number | null;
  payload: { learner?: { name?: string; admission_number?: string } };
};

type LearnerRow = {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
};

function ReportCardApprovalsPage() {
  const school = useSchool();
  const qc = useQueryClient();
  const schoolId = school.schoolId!;

  const cards = useQuery({
    queryKey: ["report-card-approvals", schoolId, school.termId],
    queryFn: async () => {
      let query = supabase
        .from("report_cards")
        .select(
          "id, learner_id, grade, version, status, mean_percentage, class_position, class_size, payload",
        )
        .eq("school_id", schoolId)
        .eq("status", "draft")
        .order("updated_at", { ascending: false });
      if (school.termId) query = query.eq("term_id", school.termId);
      const [{ data, error }, { data: learners, error: learnersError }] = await Promise.all([
        query,
        supabase
          .from("learners")
          .select("id, first_name, last_name, admission_number")
          .eq("school_id", schoolId)
          .eq("is_archived", false),
      ]);
      if (error) throw error;
      if (learnersError) throw learnersError;

      const activeLearnerIds = new Set((learners ?? []).map((learner) => learner.id));
      const learnerMap = new Map((learners ?? []).map((learner) => [learner.id, learner]));

      return (data ?? [])
        .filter((card) => activeLearnerIds.has(card.learner_id))
        .map((card) => ({ ...card, learner: learnerMap.get(card.learner_id) }))
        .filter((card) => card.learner) as (ReportCardRow & { learner: LearnerRow })[];
    },
  });

  const approve = useMutation({
    mutationFn: async (card: ReportCardRow) => {
      const { error } = await supabase
        .from("report_cards")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          published_by: school.userId,
        })
        .eq("id", card.id)
        .eq("status", "draft");
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        school_id: schoolId,
        actor_id: school.userId,
        actor_name: school.fullName,
        action: "update",
        entity: "report_card",
        entity_id: card.id,
        before_data: { status: "draft" },
        after_data: { status: "published" },
      });
    },
    onSuccess: () => {
      toast.success("Report card approved and published.");
      void qc.invalidateQueries({ queryKey: ["report-card-approvals", schoolId] });
      void qc.invalidateQueries({ queryKey: ["report-cards", schoolId] });
    },
    onError: (error: Error) =>
      toast.error("Could not approve report card.", { description: error.message }),
  });

  const rows = cards.data ?? [];
  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: "learner",
      header: "Learner",
      sortable: true,
      sortValue: (row) => `${row.learner.last_name} ${row.learner.first_name}`,
      cell: (row) => (
        <div>
          <p className="font-medium">
            {row.learner.first_name} {row.learner.last_name}
          </p>
          <p className="text-xs text-muted-foreground">{row.learner.admission_number}</p>
        </div>
      ),
    },
    {
      key: "grade",
      header: "Grade",
      cell: (row) => (row.grade ? <Badge variant="outline">{GRADE_LABELS[row.grade]}</Badge> : "—"),
    },
    { key: "version", header: "Version", cell: (row) => `v${row.version}` },
    {
      key: "mean",
      header: "Mean",
      cell: (row) => `${Number(row.mean_percentage ?? 0).toFixed(1)}%`,
    },
    {
      key: "position",
      header: "Position",
      cell: (row) => `${row.class_position ?? "—"} / ${row.class_size ?? "—"}`,
    },
    {
      key: "status",
      header: "Status",
      cell: () => <Badge variant="secondary">Draft awaiting approval</Badge>,
    },
    {
      key: "action",
      header: "Actions",
      className: "text-right",
      cell: (row) => (
        <Button size="sm" onClick={() => approve.mutate(row)} disabled={approve.isPending}>
          <CheckCheck className="mr-2 size-4" /> Approve
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Report card approvals"
        description="Review draft report cards and publish approved cards for learners and families."
        icon={FileCheck2}
      />
      <DataTable
        rows={rows}
        columns={columns}
        loading={cards.isLoading}
        rowKey={(row) => row.id}
        searchPlaceholder="Search report cards…"
        searchValue={(row) =>
          `${row.learner.first_name} ${row.learner.last_name} ${row.learner.admission_number}`
        }
        emptyTitle="No report cards awaiting approval"
        emptyDescription="Generated draft report cards will appear here."
      />
    </>
  );
}
