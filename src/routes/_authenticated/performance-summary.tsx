import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BarChart3, Printer } from "lucide-react";
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
import { printSection } from "@/lib/csv";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/performance-summary")({
  head: () => ({
    meta: [
      { title: "Mean score summary · SHANSCOTT CBE" },
      { name: "description", content: "View mean scores by grade and class." },
    ],
  }),
  component: () => (
    <RequireSchool roles={["admin", "exam_officer", "principal", "deputy", "super_admin"]}>
      <PerformanceSummaryPage />
    </RequireSchool>
  ),
});

type ClassSummary = {
  id: string;
  grade: CbeGrade;
  streamId: string;
  stream: string;
  mean: number;
  students: number;
};

type GradeSummary = {
  id: string;
  grade: CbeGrade;
  mean: number;
  students: number;
};

function PerformanceSummaryPage() {
  const school = useSchool();
  const schoolId = school.schoolId!;
  const [gradeFilter, setGradeFilter] = useState("all");
  const [streamFilter, setStreamFilter] = useState("all");

  const summary = useQuery({
    queryKey: ["performance-summary", schoolId, school.termId],
    queryFn: async () => {
      const [{ data: cards, error: cardsError }, { data: learners, error: learnersError }, { data: streams, error: streamsError }] = await Promise.all([
        supabase
          .from("report_cards")
          .select("id, learner_id, grade, mean_percentage, version, status")
          .eq("school_id", schoolId)
          .eq("term_id", school.termId)
          .in("status", ["published", "draft"])
          .order("version", { ascending: false }),
        supabase
          .from("learners")
          .select("id, current_grade, current_stream_id")
          .eq("school_id", schoolId)
          .eq("is_archived", false),
        supabase
          .from("streams")
          .select("id, name, grade")
          .eq("school_id", schoolId)
          .eq("is_active", true),
      ]);
      if (cardsError) throw cardsError;
      if (learnersError) throw learnersError;
      if (streamsError) throw streamsError;

      const learnerMap = new Map((learners ?? []).map((learner) => [learner.id, learner]));
      const streamMap = new Map((streams ?? []).map((stream) => [stream.id, stream]));
      const latestCards = new Map<string, (typeof cards)[number]>();
      for (const card of cards ?? []) if (!latestCards.has(card.learner_id)) latestCards.set(card.learner_id, card);

      const learnerRows = [...latestCards.values()]
        .map((card) => {
          const learner = learnerMap.get(card.learner_id);
          if (!learner || !card.grade) return null;
          const stream = learner.current_stream_id ? streamMap.get(learner.current_stream_id) : null;
          return { grade: card.grade, streamId: stream?.id ?? "none", stream: stream?.name ?? "Unassigned", mean: Number(card.mean_percentage ?? 0) };
        })
        .filter((row): row is { grade: CbeGrade; streamId: string; stream: string; mean: number } => row !== null);

      const gradeRows: GradeSummary[] = [...new Set(learnerRows.map((row) => row.grade))].map((grade) => {
        const rows = learnerRows.filter((row) => row.grade === grade);
        return { id: `grade-${grade}`, grade, mean: rows.reduce((sum, row) => sum + row.mean, 0) / rows.length, students: rows.length };
      });
      const classRows: ClassSummary[] = [...new Set(learnerRows.map((row) => `${row.grade}:${row.streamId}`))].map((key) => {
        const rows = learnerRows.filter((row) => `${row.grade}:${row.streamId}` === key);
        return { id: `class-${key}`, grade: rows[0]!.grade, streamId: rows[0]!.streamId, stream: rows[0]!.stream, mean: rows.reduce((sum, row) => sum + row.mean, 0) / rows.length, students: rows.length };
      });
      return { gradeRows, classRows };
    },
  });

  const gradeRows = useMemo(
    () => (summary.data?.gradeRows ?? []).filter((row) => gradeFilter === "all" || row.grade === gradeFilter).sort((a, b) => b.mean - a.mean),
    [summary.data, gradeFilter],
  );
  const classRows = useMemo(
    () => (summary.data?.classRows ?? []).filter((row) => (gradeFilter === "all" || row.grade === gradeFilter) && (streamFilter === "all" || row.streamId === streamFilter)).sort((a, b) => b.mean - a.mean),
    [summary.data, gradeFilter, streamFilter],
  );
  const classColumns: Column<ClassSummary>[] = [
    { key: "grade", header: "Grade", cell: (row) => GRADE_LABELS[row.grade] },
    { key: "stream", header: "Class / stream", sortable: true, sortValue: (row) => row.stream, cell: (row) => row.stream },
    { key: "mean", header: "Mean score", sortable: true, sortValue: (row) => row.mean, cell: (row) => <Badge variant="default">{row.mean.toFixed(1)}%</Badge> },
    { key: "students", header: "Students", cell: (row) => row.students },
  ];
  const gradeColumns: Column<GradeSummary>[] = [
    { key: "grade", header: "Grade", cell: (row) => GRADE_LABELS[row.grade] },
    { key: "mean", header: "Mean score", sortable: true, sortValue: (row) => row.mean, cell: (row) => <Badge variant="default">{row.mean.toFixed(1)}%</Badge> },
    { key: "students", header: "Students", cell: (row) => row.students },
  ];

  return (
    <div id="performance-summary-print">
      <div className="no-print">
        <PageHeader title="Mean score summary" description="Compare mean scores by grade and class for the selected term." icon={BarChart3} actions={<Button variant="outline" onClick={() => printSection("performance-summary-print")}><Printer className="mr-2 size-4" /> Print summary</Button>} />
      </div>
      <div className="mb-6 flex flex-wrap gap-2 no-print">
        <Select value={gradeFilter} onValueChange={(value) => { setGradeFilter(value); setStreamFilter("all"); }}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Grade" /></SelectTrigger><SelectContent><SelectItem value="all">All grades</SelectItem>{school.grades.map((grade) => <SelectItem key={grade} value={grade}>{GRADE_LABELS[grade]}</SelectItem>)}</SelectContent></Select>
        <Select value={streamFilter} onValueChange={setStreamFilter}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Class / stream" /></SelectTrigger><SelectContent><SelectItem value="all">All classes</SelectItem>{(summary.data?.classRows ?? []).filter((row) => gradeFilter === "all" || row.grade === gradeFilter).map((row) => <SelectItem key={row.streamId} value={row.streamId}>{row.stream}</SelectItem>)}</SelectContent></Select>
      </div>
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">Mean score per grade</h2>
        <DataTable rows={gradeRows} columns={gradeColumns} loading={summary.isLoading} rowKey={(row) => row.id} searchPlaceholder="Search grades" searchValue={(row) => GRADE_LABELS[row.grade]} emptyTitle="No grade scores available" emptyDescription="Publish report cards to calculate grade means." />
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Mean score per class</h2>
        <DataTable rows={classRows} columns={classColumns} loading={summary.isLoading} rowKey={(row) => row.id} searchPlaceholder="Search classes" searchValue={(row) => `${row.stream} ${row.grade}`} emptyTitle="No class scores available" emptyDescription="Publish report cards to calculate class means." />
      </section>
    </div>
  );
}