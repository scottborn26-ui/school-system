import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  CheckCircle,
  FileCheck2,
  Lock,
  Printer,
  RefreshCw,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { RequireSchool } from "@/components/require-school";
import { SchoolLogo } from "@/components/school-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ChartContainer } from "@/components/ui/chart";
import { useSchool } from "@/hooks/use-school";
import { supabase } from "@/lib/supabase";
import { GRADE_LABELS, kjseaLevelFor, type CbeGrade } from "@/lib/cbe";
import { printSection } from "@/lib/csv";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/reports")({
  validateSearch: z.object({ card: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Report cards · SHANSCOTT CBE" },
      {
        name: "description",
        content:
          "Generate KJSEA-styled CBE report cards, publish immutable versions and print them as PDF.",
      },
      { property: "og:title", content: "Report cards · SHANSCOTT CBE" },
      {
        property: "og:description",
        content: "Versioned, immutable KJSEA-styled report cards for Kenyan CBE schools.",
      },
    ],
  }),
  component: () => (
    <RequireSchool roles={["admin", "exam_officer", "principal", "deputy", "teacher", "class_teacher", "super_admin"]}>
      <ReportsPage />
    </RequireSchool>
  ),
});

interface AreaResult {
  learning_area: string;
  percentage: number;
  level: string | null;
  points: number | null;
  descriptor: string | null;
}

interface ReportPayload {
  areas: AreaResult[];
  learner: {
    name: string;
    admission_number: string;
    grade: string;
    stream: string;
    pathway?: string | null;
    track?: string | null;
    strand?: string | null;
  };
  term: string;
  school: string;
  ranking?: {
    grade_position: number;
    grade_size: number;
  };
}

function ReportsPage() {
  const search = Route.useSearch();
  const school = useSchool();
  const qc = useQueryClient();
  const schoolId = school.schoolId!;
  const isAdmin = school.can("principal", "deputy", "super_admin");
  const isTeacherScoped =
    school.can("teacher", "class_teacher") &&
    !school.can("principal", "deputy", "super_admin", "admin");

  const [streamId, setStreamId] = useState("");
  const [selectedCardId, setSelectedCardId] = useState("");
  const [classComment, setClassComment] = useState("");
  const [headComment, setHeadComment] = useState("");

  const teacherStreamIds = useQuery({
    queryKey: ["teacher-reports-streams", schoolId, school.userId],
    enabled: isTeacherScoped,
    queryFn: async () => {
      const { data: staffRecord, error: staffError } = await supabase
        .from("staff")
        .select("id")
        .eq("school_id", schoolId)
        .eq("user_id", school.userId)
        .eq("is_archived", false)
        .eq("status", "active")
        .maybeSingle();
      if (staffError) throw staffError;
      if (!staffRecord) return [];

      const { data, error } = await supabase
        .from("teacher_allocations")
        .select("stream_id")
        .eq("school_id", schoolId)
        .eq("staff_id", staffRecord.id)
        .eq("is_active", true);
      if (error) throw error;
      return [...new Set((data ?? []).map((row) => row.stream_id))];
    },
  });

  const streams = useQuery({
    queryKey: ["streams-lite", schoolId, isTeacherScoped ? "teacher" : "all"],
    queryFn: async () => {
      let query = supabase
        .from("streams")
        .select("id, name, grade")
        .eq("school_id", schoolId)
        .order("grade");

      if (isTeacherScoped) {
        const ids = teacherStreamIds.data ?? [];
        if (!ids.length) return [];
        query = query.in("id", ids);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const cards = useQuery({
    queryKey: ["report-cards", schoolId, school.termId],
    queryFn: async () => {
      const q = supabase
        .from("report_cards")
        .select("*")
        .eq("school_id", schoolId)
        .order("version", { ascending: false });
      const [{ data: cards, error: cardsError }, { data: activeLearners, error: learnersError }] =
        await Promise.all([
          school.termId ? q.eq("term_id", school.termId) : q,
          supabase.from("learners").select("id").eq("school_id", schoolId).eq("is_archived", false),
        ]);
      if (cardsError) throw cardsError;
      if (learnersError) throw learnersError;

      const activeLearnerIds = new Set((activeLearners ?? []).map((learner) => learner.id));

      return (cards ?? []).filter(
        (card) => activeLearnerIds.has(card.learner_id) && card.learner_id,
      );
    },
  });

  useEffect(() => {
    if (search.card && cards.data?.some((card) => card.id === search.card)) {
      setSelectedCardId(search.card);
    }
  }, [search.card, cards.data]);

  useEffect(() => {
    if (isTeacherScoped && streamId && teacherStreamIds.data && !teacherStreamIds.data.includes(streamId)) {
      setStreamId(teacherStreamIds.data[0] ?? "");
    }
  }, [isTeacherScoped, streamId, teacherStreamIds.data]);

  const selectedCard = cards.data?.find((c) => c.id === selectedCardId) ?? null;
  const performance = useQuery({
    queryKey: ["learner-performance-history", schoolId, selectedCard?.learner_id],
    enabled: Boolean(selectedCard?.learner_id),
    queryFn: async () => {
      const learnerId = selectedCard!.learner_id;
      const { data: marks, error: marksError } = await supabase
        .from("marks")
        .select("assessment_id, percentage, is_absent, is_exempt")
        .eq("school_id", schoolId)
        .eq("learner_id", learnerId)
        .not("percentage", "is", null);
      if (marksError) throw marksError;
      const usableMarks = (marks ?? []).filter((mark) => !mark.is_absent && !mark.is_exempt);
      const assessmentIds = usableMarks.map((mark) => mark.assessment_id);
      if (!assessmentIds.length) return [];
      const [
        { data: assessments, error: assessmentError },
        { data: terms, error: termsError },
        { data: years, error: yearsError },
      ] = await Promise.all([
        supabase
          .from("assessments")
          .select("id, title, assessment_date, term_id, academic_year_id")
          .in("id", assessmentIds)
          .in("status", ["approved", "locked"]),
        supabase.from("terms").select("id, name, academic_year_id").eq("school_id", schoolId),
        supabase.from("academic_years").select("id, name").eq("school_id", schoolId),
      ]);
      if (assessmentError) throw assessmentError;
      if (termsError) throw termsError;
      if (yearsError) throw yearsError;
      const termMap = new Map((terms ?? []).map((term) => [term.id, term]));
      const yearMap = new Map((years ?? []).map((year) => [year.id, year]));
      return (assessments ?? [])
        .map((assessment) => {
          const mark = usableMarks.find((item) => item.assessment_id === assessment.id);
          const term = assessment.term_id ? termMap.get(assessment.term_id) : null;
          const year = assessment.academic_year_id
            ? yearMap.get(assessment.academic_year_id)
            : null;
          return {
            label: `${year?.name ?? "Year"} · ${term?.name ?? "Term"}`,
            exam: assessment.title,
            score: Number(mark?.percentage ?? 0),
            date: assessment.assessment_date,
          };
        })
        .filter((point) => point.score >= 0)
        .sort((a, b) => a.date.localeCompare(b.date));
    },
  });

  const learners = useQuery({
    queryKey: ["stream-learners", schoolId, streamId],
    enabled: Boolean(streamId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learners")
        .select("id, admission_number, first_name, last_name, current_grade")
        .eq("school_id", schoolId)
        .eq("current_stream_id", streamId)
        .eq("is_archived", false)
        .order("last_name");
      if (error) throw error;
      return data;
    },
  });

  const stream = streams.data?.find((s) => s.id === streamId);

  const generate = useMutation({
    mutationFn: async () => {
      if (!streamId || !stream) throw new Error("Select a class.");
      if (!school.termId) throw new Error("Select a term first.");
      const learnerRows = learners.data ?? [];
      if (learnerRows.length === 0) throw new Error("This class has no learners.");
      const { data: gradeLearnerRows, error: gradeLearnersError } = await supabase
        .from("learners")
        .select("id, admission_number, first_name, last_name, current_grade, current_stream_id")
        .eq("school_id", schoolId)
        .eq("current_grade", stream.grade)
        .eq("is_archived", false)
        .order("last_name");
      if (gradeLearnersError) throw gradeLearnersError;

      const seniorDb = supabase as unknown as { from: (table: string) => any };
      const { data: pathwayAssignments, error: pathwayError } = await seniorDb
        .from("student_pathway_assignments")
        .select("learner_id, pathway_id, track_id, strand_id")
        .eq("school_id", schoolId)
        .eq("status", "current");
      if (pathwayError) throw pathwayError;
      const pathwayIds = [
        ...new Set(
          (pathwayAssignments ?? []).map(
            (assignment: { pathway_id: string }) => assignment.pathway_id,
          ),
        ),
      ];
      const trackIds = [
        ...new Set(
          (pathwayAssignments ?? [])
            .map((assignment: { track_id: string | null }) => assignment.track_id)
            .filter(Boolean),
        ),
      ];
      const strandIds = [
        ...new Set(
          (pathwayAssignments ?? [])
            .map((assignment: { strand_id: string | null }) => assignment.strand_id)
            .filter(Boolean),
        ),
      ];
      const [{ data: pathwayRows }, { data: trackRows }, { data: strandRows }] = await Promise.all([
        pathwayIds.length
          ? seniorDb.from("senior_pathways").select("id, name").in("id", pathwayIds)
          : Promise.resolve({ data: [] }),
        trackIds.length
          ? seniorDb.from("pathway_tracks").select("id, name").in("id", trackIds)
          : Promise.resolve({ data: [] }),
        strandIds.length
          ? seniorDb.from("pathway_strands").select("id, name").in("id", strandIds)
          : Promise.resolve({ data: [] }),
      ]);
      const pathwayMap = new Map(
        (pathwayRows ?? []).map((row: { id: string; name: string }) => [row.id, row.name]),
      );
      const trackMap = new Map(
        (trackRows ?? []).map((row: { id: string; name: string }) => [row.id, row.name]),
      );
      const strandMap = new Map(
        (strandRows ?? []).map((row: { id: string; name: string }) => [row.id, row.name]),
      );
      const assignmentMap = new Map(
        (pathwayAssignments ?? []).map(
          (assignment: {
            learner_id: string;
            pathway_id: string;
            track_id: string | null;
            strand_id: string | null;
          }) => [assignment.learner_id, assignment],
        ),
      );

      const { data: assessments, error: aErr } = await supabase
        .from("assessments")
        .select("id, learning_area_id, max_score, weight, status, stream_id")
        .eq("school_id", schoolId)
        .eq("term_id", school.termId)
        .in("status", ["approved", "locked"]);
      if (aErr) throw aErr;
      if (!assessments || assessments.length === 0) {
        throw new Error("No approved assessments for this class and term yet.");
      }

      const { data: areas, error: laErr } = await supabase
        .from("learning_areas")
        .select("id, name")
        .eq("school_id", schoolId);
      if (laErr) throw laErr;

      const { data: marks, error: mErr } = await supabase
        .from("marks")
        .select("learner_id, assessment_id, percentage, is_absent, is_exempt")
        .in(
          "assessment_id",
          assessments.map((a) => a.id),
        );
      if (mErr) throw mErr;

      // Aggregate per learner and learning area, using only assessments applicable to that learner.
      const summarize = (learnerRowsToSummarize: typeof learnerRows) => learnerRowsToSummarize.map((l) => {
        const byArea = new Map<string, number[]>();
        for (const a of assessments) {
          const assessmentStream = (a as { stream_id?: string | null }).stream_id;
          if (assessmentStream && assessmentStream !== l.current_stream_id) continue;
          const m = (marks ?? []).find((x) => x.learner_id === l.id && x.assessment_id === a.id);
          if (!m || m.is_absent || m.is_exempt || m.percentage === null) continue;
          const list = byArea.get(a.learning_area_id) ?? [];
          list.push(Number(m.percentage));
          byArea.set(a.learning_area_id, list);
        }
        const areaResults: AreaResult[] = [...byArea.entries()]
          .map(([areaId, values]) => {
            const pct = values.reduce((s, v) => s + v, 0) / values.length;
            const lv = kjseaLevelFor(pct);
            return {
              learning_area: areas?.find((x) => x.id === areaId)?.name ?? "Learning area",
              percentage: Math.round(pct * 100) / 100,
              level: lv?.code ?? null,
              points: lv?.points ?? null,
              descriptor: lv?.name ?? null,
            };
          })
          .sort((a, b) => a.learning_area.localeCompare(b.learning_area));

        const mean = areaResults.length
          ? areaResults.reduce((s, a) => s + a.percentage, 0) / areaResults.length
          : 0;
        const points = areaResults.reduce((s, a) => s + (a.points ?? 0), 0);
        return { learner: l, areaResults, mean, points };
      });

      const summaries = summarize(learnerRows);
      const gradeSummaries = summarize(gradeLearnerRows ?? []);
      const ranked = [...summaries].sort((a, b) => b.mean - a.mean);
      const gradeRanked = [...gradeSummaries].sort((a, b) => b.mean - a.mean);
      const gradeRank = new Map(
        gradeRanked.map((summary, index) => [summary.learner.id, index + 1]),
      );

      let created = 0;
      for (const s of summaries) {
        const position = ranked.findIndex((r) => r.learner.id === s.learner.id) + 1;
        const gradePosition = gradeRank.get(s.learner.id) ?? null;
        const { data: existing } = await supabase
          .from("report_cards")
          .select("id, version, status")
          .eq("learner_id", s.learner.id)
          .eq("term_id", school.termId)
          .order("version", { ascending: false })
          .limit(1);
        const prev = existing?.[0];
        const payload: ReportPayload = {
          areas: s.areaResults,
          learner: {
            name: `${s.learner.first_name} ${s.learner.last_name}`,
            admission_number: s.learner.admission_number,
            grade: GRADE_LABELS[s.learner.current_grade as CbeGrade] ?? "—",
            stream: stream.name,
            pathway: assignmentMap.get(s.learner.id)?.pathway_id
              ? pathwayMap.get(assignmentMap.get(s.learner.id)!.pathway_id)
              : null,
            track: assignmentMap.get(s.learner.id)?.track_id
              ? trackMap.get(assignmentMap.get(s.learner.id)!.track_id!)
              : null,
            strand: assignmentMap.get(s.learner.id)?.strand_id
              ? strandMap.get(assignmentMap.get(s.learner.id)!.strand_id!)
              : null,
          },
          term: school.terms.find((t) => t.id === school.termId)?.name ?? "Term",
          school: school.school?.name ?? "School",
          ranking: gradePosition
            ? { grade_position: gradePosition, grade_size: gradeRanked.length }
            : undefined,
        };
        const row = {
          school_id: schoolId,
          learner_id: s.learner.id,
          academic_year_id: school.academicYearId,
          term_id: school.termId,
          grade: s.learner.current_grade,
          version: prev ? (prev.status === "published" ? prev.version + 1 : prev.version) : 1,
          status: "draft" as const,
          payload: payload as unknown as never,
          total_points: s.points,
          mean_percentage: Math.round(s.mean * 100) / 100,
          class_position: position,
          class_size: summaries.length,
          created_by: school.userId,
        };
        if (prev && prev.status === "draft") {
          const { error } = await supabase.from("report_cards").update(row).eq("id", prev.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("report_cards").insert(row);
          if (error) throw error;
        }
        created++;
      }
      return created;
    },
    onSuccess: (n) => {
      toast.success(`${n} report card${n === 1 ? "" : "s"} generated successfully.`, {
        description: "Review and add comments, then publish. Published cards are immutable.",
      });
      void qc.invalidateQueries({ queryKey: ["report-cards", schoolId, school.termId] });
    },
    onError: (e: Error) =>
      toast.error("Could not generate report cards.", { description: e.message }),
  });

  const publish = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("report_cards")
        .update({
          status: "published",
          class_teacher_comment: classComment.trim() || null,
          head_teacher_comment: headComment.trim() || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Report card published successfully.", {
        description: "It is now immutable — regenerate to create a new version.",
      });
      void qc.invalidateQueries({ queryKey: ["report-cards", schoolId, school.termId] });
    },
    onError: (e: Error) => toast.error("Publishing was refused.", { description: e.message }),
  });

  const saveDraft = useMutation({
    mutationFn: async () => {
      if (!selectedCard) throw new Error("Select a report card.");
      if (selectedCard.status !== "draft")
        throw new Error("Published report cards cannot be edited.");
      const { error } = await supabase
        .from("report_cards")
        .update({
          class_teacher_comment: classComment.trim() || null,
          head_teacher_comment: headComment.trim() || null,
        })
        .eq("id", selectedCard.id)
        .eq("status", "draft");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Report card changes saved.");
      void qc.invalidateQueries({ queryKey: ["report-cards", schoolId, school.termId] });
    },
    onError: (e: Error) => toast.error("Could not save report card.", { description: e.message }),
  });

  const deleteDraft = useMutation({
    mutationFn: async () => {
      if (!selectedCard) throw new Error("Select a report card.");
      if (selectedCard.status !== "draft")
        throw new Error("Published report cards cannot be deleted.");
      if (!window.confirm("Delete this draft report card permanently?")) return;
      const { error } = await supabase.rpc("delete_report_card_permanently", {
        _school_id: schoolId,
        _report_card_id: selectedCard.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSelectedCardId("");
      toast.success("Draft report card deleted.");
      void qc.invalidateQueries({ queryKey: ["report-cards", schoolId, school.termId] });
    },
    onError: (e: Error) => toast.error("Could not delete report card.", { description: e.message }),
  });

  const selected = selectedCard;
  const payload = selected ? (selected.payload as unknown as ReportPayload) : null;
  const totalPoints = selected
    ? selected.total_points > 0
      ? selected.total_points
      : (payload?.areas ?? []).reduce(
          (sum, area) => sum + (area.points ?? kjseaLevelFor(area.percentage)?.points ?? 0),
          0,
        )
    : 0;

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="Report cards"
          description="KJSEA-styled report cards built from approved marks only. Publishing freezes a version permanently."
          icon={FileCheck2}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => generate.mutate()} disabled={generate.isPending || !streamId}>
                <RefreshCw className="mr-2 size-4" /> Generate for class
              </Button>
              {selected && (
                <Button variant="outline" onClick={() => printSection("report-print")}>
                  <Printer className="mr-2 size-4" /> Print / save as PDF
                </Button>
              )}
              {isAdmin && (
                <Button variant="outline" asChild>
                  <Link to="/report-card-approvals">
                    <CheckCircle className="mr-2 size-4" /> Approval queue
                  </Link>
                </Button>
              )}
            </div>
          }
        />
      </div>

      <Card className="mb-6 no-print">
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Class / stream</Label>
            <Select value={streamId} onValueChange={setStreamId}>
              <SelectTrigger>
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {(streams.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {GRADE_LABELS[s.grade as CbeGrade]} {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Report card</Label>
            <Select value={selectedCardId} onValueChange={setSelectedCardId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a generated report card" />
              </SelectTrigger>
              <SelectContent>
                {(cards.data ?? []).map((c) => {
                  const p = c.payload as unknown as ReportPayload;
                  return (
                    <SelectItem key={c.id} value={c.id}>
                      {p?.learner?.name ?? "Learner"} · v{c.version} · {c.status}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selected && payload && (
        <>
          <div
            id="report-print"
            className="report-sheet print-page mx-auto max-w-4xl overflow-hidden rounded-xl border shadow-sm"
          >
            {/* Masthead */}
            <div className="report-block border-b bg-gradient-to-r from-[#0b1f3a] via-[#102d5d] to-[#2563eb] px-6 py-3 text-white">
              <div className="flex items-center gap-4">
                <SchoolLogo
                  logoUrl={school.school?.logo_url}
                  schoolName={payload.school}
                  shortName={school.school?.short_name}
                  className="size-14 border border-primary-foreground/30 text-lg"
                  imageClassName="rounded-full"
                />
                <div className="min-w-0 flex-1 text-center">
                  <h2 className="text-xl font-semibold uppercase tracking-wide">
                    {payload.school}
                  </h2>
                  <p className="text-sm opacity-90">
                    Competency Based Education · Learner Progress Report
                  </p>
                  <p className="text-xs uppercase tracking-widest opacity-80">{payload.term}</p>
                </div>
                <div className="hidden w-14 shrink-0 sm:block" />
              </div>
            </div>

            {/* Learner identity strip */}
            <div className="report-block grid gap-x-6 gap-y-1 border-b bg-muted/40 px-6 py-3 text-sm sm:grid-cols-2">
              <p className="flex justify-between gap-2 border-b border-dashed pb-1">
                <span className="text-muted-foreground">Learner</span>
                <strong className="text-right">{payload.learner.name}</strong>
              </p>
              <p className="flex justify-between gap-2 border-b border-dashed pb-1">
                <span className="text-muted-foreground">Admission no.</span>
                <strong className="text-right">{payload.learner.admission_number}</strong>
              </p>
              <p className="flex justify-between gap-2 border-b border-dashed pb-1">
                <span className="text-muted-foreground">Grade / stream</span>
                <strong className="text-right">
                  {payload.learner.grade} {payload.learner.stream}
                </strong>
              </p>
              {payload.learner.pathway && (
                <p className="flex justify-between gap-2 border-b border-dashed pb-1 sm:col-span-2">
                  <span className="text-muted-foreground">Pathway / track / strand</span>
                  <strong className="text-right">
                    {payload.learner.pathway}
                    {payload.learner.track ? ` / ${payload.learner.track}` : ""}
                    {payload.learner.strand ? ` / ${payload.learner.strand}` : ""}
                  </strong>
                </p>
              )}
              <p className="flex justify-between gap-2 border-b border-dashed pb-1">
                <span className="text-muted-foreground">Report version</span>
                <strong className="text-right">
                  v{selected.version} · {selected.status}
                </strong>
              </p>
            </div>

            {/* Learning areas */}
            <div className="report-block px-6 pt-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Performance by learning area
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-foreground">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 text-left">Learning area</th>
                      <th className="px-2 py-2 text-right">Score</th>
                      <th className="px-2 py-2 text-center">Level</th>
                      <th className="px-2 py-2 text-right">Points</th>
                      <th className="px-2 py-2 text-left">Performance descriptor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.areas.map((a) => (
                      <tr key={a.learning_area} className="border-b border-border bg-card/80">
                        <td className="px-2 py-2 font-medium text-foreground">{a.learning_area}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-foreground">{a.percentage.toFixed(1)}%</td>
                        <td className="px-2 py-2 text-center font-semibold text-foreground">
                          {a.level ?? kjseaLevelFor(a.percentage)?.code ?? "—"}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-foreground">
                          {a.points ?? kjseaLevelFor(a.percentage)?.points ?? "—"}
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">
                          {a.descriptor ?? kjseaLevelFor(a.percentage)?.name ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="report-block px-6 pt-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Performance across exams, terms and years
              </h3>
              {performance.data?.length === 1 ? (
                <div className="flex items-center justify-between rounded-md border bg-muted/30 px-4 py-2">
                  <span className="text-sm text-muted-foreground">
                    Latest score · {performance.data[0].label}
                  </span>
                  <strong className="text-lg tabular-nums">
                    {performance.data[0].score.toFixed(1)}%
                  </strong>
                </div>
              ) : performance.data && performance.data.length > 1 ? (
                <ChartContainer
                  config={{ score: { label: "Score", color: "var(--color-primary)" } }}
                  className="h-36 w-full aspect-auto"
                >
                  <LineChart
                    data={performance.data}
                    margin={{ top: 8, right: 12, left: -12, bottom: 24 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis
                      dataKey="label"
                      angle={-35}
                      textAnchor="end"
                      height={58}
                      interval="preserveStartEnd"
                    />
                    <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                    <Tooltip
                      formatter={(value) => [`${Number(value).toFixed(1)}%`, "Score"]}
                      labelFormatter={(label, items) =>
                        `${label} · ${items[0]?.payload?.exam ?? "Exam"}`
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="var(--color-score)"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ChartContainer>
              ) : (
                <p className="rounded-md border border-dashed px-4 py-2 text-sm text-muted-foreground">
                  No approved exam scores are available for this learner yet.
                </p>
              )}
            </div>

            {/* Summary tiles */}
            <div className="report-block grid gap-2 px-6 py-3 sm:grid-cols-4">
              {[
                {
                  label: "Mean score",
                  value: `${Number(selected.mean_percentage ?? 0).toFixed(1)}%`,
                },
                { label: "Total points", value: String(totalPoints) },
                {
                  label: "Class position",
                  value: `${selected.class_position ?? "—"} of ${selected.class_size ?? "—"}`,
                },
                {
                  label: "Grade position",
                  value: payload?.ranking
                    ? `${payload.ranking.grade_position} of ${payload.ranking.grade_size}`
                    : "—",
                },
              ].map((t) => (
                <div key={t.label} className="rounded-lg border bg-muted/30 px-3 py-2 text-center">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.label}</p>
                  <p className="mt-0.5 text-base font-semibold tabular-nums">{t.value}</p>
                </div>
              ))}
            </div>

            {/* Comments */}
            <div className="report-block grid gap-2 border-t px-6 py-3 text-sm sm:grid-cols-2">
              {[
                {
                  title: "Class teacher's comment",
                  body:
                    selected.class_teacher_comment ??
                    (selected.status === "draft" ? classComment : ""),
                },
                {
                  title: "Head teacher's comment",
                  body:
                    selected.head_teacher_comment ??
                    (selected.status === "draft" ? headComment : ""),
                },
              ].map((c) => (
                <div key={c.title} className="rounded-lg border p-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {c.title}
                  </p>
                  <p className="mt-1 min-h-6 leading-relaxed">{c.body || "—"}</p>
                  <div className="mt-2 flex justify-end">
                    <span className="w-48 border-t border-dashed pt-1 text-center text-[11px] text-muted-foreground">
                      Signature &amp; date
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="report-block flex flex-wrap items-center justify-between gap-2 border-t bg-muted/40 px-6 py-2 text-xs text-muted-foreground">
              <span>
                {selected.status === "published"
                  ? `Published ${formatDate(selected.published_at)} · immutable document. Corrections are issued as a new version.`
                  : "Draft — not yet published. Figures may still change."}
              </span>
              <span>{payload.school}</span>
            </div>
          </div>

          <Card className="mt-6 no-print">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Comments & publishing</CardTitle>
              <Badge variant={selected.status === "published" ? "default" : "secondary"}>
                {selected.status}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {selected.status === "published" ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="size-4" /> Published report cards cannot be edited. Regenerate
                  the class to create v{selected.version + 1}.
                </p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="ct-comment">Class teacher's comment</Label>
                    <Textarea
                      id="ct-comment"
                      rows={2}
                      value={classComment}
                      onChange={(e) => setClassComment(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ht-comment">Head teacher's comment</Label>
                    <Textarea
                      id="ht-comment"
                      rows={2}
                      value={headComment}
                      onChange={(e) => setHeadComment(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => saveDraft.mutate()}
                      disabled={saveDraft.isPending}
                    >
                      <Save className="mr-2 size-4" /> Save changes
                    </Button>
                    <Button asChild>
                      <Link to="/report-card-approvals">
                        <Send className="mr-2 size-4" /> Send for approval
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteDraft.mutate()}
                      disabled={deleteDraft.isPending}
                    >
                      <Trash2 className="mr-2 size-4" /> Delete draft
                    </Button>
                  </div>
                  {!isAdmin && (
                    <p className="text-xs text-muted-foreground">
                      Only the principal or deputy can publish reports.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
