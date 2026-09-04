import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/student-positions")({
  head: () => ({
    meta: [
      { title: "Student positions · SHANSCOTT CBE" },
      { name: "description", content: "View and print student positions by grade and stream." },
    ],
  }),
  component: () => (
    <RequireSchool roles={["admin", "exam_officer", "principal", "deputy", "super_admin"]}>
      <StudentPositionsPage />
    </RequireSchool>
  ),
});

type PositionRow = {
  id: string;
  name: string;
  admissionNumber: string;
  grade: CbeGrade;
  stream: string;
  mean: number;
  classPosition: number | null;
  classSize: number | null;
  gradePosition: number;
  gradeSize: number;
};

function StudentPositionsPage() {
  const school = useSchool();
  const schoolId = school.schoolId!;
  const [gradeFilter, setGradeFilter] = useState("all");
  const [streamFilter, setStreamFilter] = useState("all");

  const data = useQuery({
    queryKey: ["student-positions", schoolId, school.termId],
    queryFn: async () => {
      const [{ data: cards, error: cardsError }, { data: learners, error: learnersError }, { data: streams, error: streamsError }] = await Promise.all([
        supabase
          .from("report_cards")
          .select("id, learner_id, grade, mean_percentage, class_position, class_size, payload, version, status")
          .eq("school_id", schoolId)
          .eq("status", "published")
          .eq("term_id", school.termId)
          .order("version", { ascending: false }),
        supabase
          .from("learners")
          .select("id, first_name, middle_name, last_name, admission_number, current_grade, current_stream_id")
          .eq("school_id", schoolId)
          .eq("is_archived", false),
        supabase.from("streams").select("id, name, grade").eq("school_id", schoolId).eq("is_active", true),
      ]);
      if (cardsError) throw cardsError;
      if (learnersError) throw learnersError;
      if (streamsError) throw streamsError;

      const learnerMap = new Map((learners ?? []).map((learner) => [learner.id, learner]));
      const streamMap = new Map((streams ?? []).map((stream) => [stream.id, stream]));
      const latestCards = new Map<string, (typeof cards)[number]>();
      for (const card of cards ?? []) if (!latestCards.has(card.learner_id)) latestCards.set(card.learner_id, card);
      const rows = [...latestCards.values()]
        .map((card) => {
          const learner = learnerMap.get(card.learner_id);
          if (!learner || !card.grade) return null;
          const stream = learner.current_stream_id ? streamMap.get(learner.current_stream_id) : null;
          const payload = card.payload as { ranking?: { grade_position?: number; grade_size?: number } };
          return {
            id: card.id,
            name: `${learner.first_name} ${learner.middle_name ?? ""} ${learner.last_name}`.replace(/\s+/g, " ").trim(),
            admissionNumber: learner.admission_number,
            grade: card.grade,
            stream: stream?.name ?? "—",
            mean: Number(card.mean_percentage ?? 0),
            classPosition: card.class_position,
            classSize: card.class_size,
            gradePosition: payload.ranking?.grade_position ?? 0,
            gradeSize: payload.ranking?.grade_size ?? 0,
          } satisfies PositionRow;
        })
        .filter((row): row is PositionRow => row !== null);

      for (const grade of new Set(rows.map((row) => row.grade))) {
        const gradeRows = rows.filter((row) => row.grade === grade).sort((a, b) => b.mean - a.mean || a.name.localeCompare(b.name));
        gradeRows.forEach((row, index) => {
          if (!row.gradePosition) row.gradePosition = index + 1;
          if (!row.gradeSize) row.gradeSize = gradeRows.length;
        });
      }
      return { rows, streams: streams ?? [] };
    },
  });

  const rows = useMemo(
    () =>
      (data.data?.rows ?? [])
        .filter(
          (row) =>
            (gradeFilter === "all" || row.grade === gradeFilter) &&
            (streamFilter === "all" ||
              data.data?.streams.find((stream) => stream.name === row.stream)?.id === streamFilter),
        )
        .sort((left, right) => left.gradePosition - right.gradePosition || left.name.localeCompare(right.name)),
    [data.data, gradeFilter, streamFilter],
  );
  const columns: Column<PositionRow>[] = [
    { key: "position", header: "Grade position", sortable: true, sortValue: (row) => row.gradePosition, cell: (row) => <Badge variant="default">{row.gradePosition} / {row.gradeSize}</Badge> },
    { key: "learner", header: "Student", sortable: true, sortValue: (row) => row.name, cell: (row) => <div><p className="font-medium">{row.name}</p><p className="text-xs text-muted-foreground">{row.admissionNumber}</p></div> },
    { key: "grade", header: "Grade", cell: (row) => GRADE_LABELS[row.grade] },
    { key: "stream", header: "Stream", cell: (row) => row.stream },
    { key: "mean", header: "Mean", sortable: true, sortValue: (row) => row.mean, cell: (row) => `${row.mean.toFixed(1)}%` },
    { key: "class", header: "Class position", cell: (row) => `${row.classPosition ?? "—"} / ${row.classSize ?? "—"}` },
  ];

  return (
    <div id="student-positions-print">
      <div className="no-print">
        <PageHeader
          title="Student positions"
          description="View grade-wide and class positions for published report cards."
          icon={Download}
          actions={<Button variant="outline" onClick={() => printSection("student-positions-print")}><Printer className="mr-2 size-4" /> Print positions</Button>}
        />
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        loading={data.isLoading}
        rowKey={(row) => row.id}
        searchPlaceholder="Search student or admission number"
        searchValue={(row) => `${row.name} ${row.admissionNumber} ${row.stream}`}
        filters={<div className="flex flex-wrap gap-2 no-print"><Select value={gradeFilter} onValueChange={(value) => { setGradeFilter(value); setStreamFilter("all"); }}><SelectTrigger className="w-[145px]"><SelectValue placeholder="Grade" /></SelectTrigger><SelectContent><SelectItem value="all">All grades</SelectItem>{school.grades.map((grade) => <SelectItem key={grade} value={grade}>{GRADE_LABELS[grade]}</SelectItem>)}</SelectContent></Select><Select value={streamFilter} onValueChange={setStreamFilter}><SelectTrigger className="w-[145px]"><SelectValue placeholder="Stream" /></SelectTrigger><SelectContent><SelectItem value="all">All streams</SelectItem>{(data.data?.streams ?? []).filter((stream) => gradeFilter === "all" || stream.grade === gradeFilter).map((stream) => <SelectItem key={stream.id} value={stream.id}>{stream.name}</SelectItem>)}</SelectContent></Select></div>}
        onReset={() => { setGradeFilter("all"); setStreamFilter("all"); }}
        emptyTitle="No published positions"
        emptyDescription="Publish report cards to calculate and display student positions."
      />
    </div>
  );
}