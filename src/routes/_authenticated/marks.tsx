import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCheck, ClipboardCheck, Download, Info, Lock, Save, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { RequireSchool } from "@/components/require-school";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSchool } from "@/hooks/use-school";
import { supabase } from "@/lib/supabase";
import { GRADE_LABELS, kjseaLevelFor, markEntryMode, type CbeGrade } from "@/lib/cbe";
import { downloadCsv, parseCsv } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/marks")({
  head: () => ({
    meta: [
      { title: "Marks entry · SHANSCOTT CBE" },
      {
        name: "description",
        content: "Grade-adaptive CBE marks entry with KJSEA and KPSEA rules, approval and locking.",
      },
      { property: "og:title", content: "Marks entry · SHANSCOTT CBE" },
      {
        property: "og:description",
        content: "Enter, submit, approve and lock assessment marks with server-side validation.",
      },
    ],
  }),
  component: () => (
    <RequireSchool roles={["admin", "exam_officer", "principal", "deputy", "teacher", "class_teacher", "super_admin"]}>
      <MarksPage />
    </RequireSchool>
  ),
});

const MODE_LABELS: Record<string, string> = {
  numeric: "Numeric (Grades 7-12)",
  kjsea_competency: "KJSEA competency scale (Grades 1-5)",
  kpsea_sections: "KPSEA sections (Grade 6)",
  observation: "Observation descriptors (PP1-PP2)",
};

const STATUS_TONE: Record<string, "secondary" | "default" | "outline"> = {
  draft: "secondary",
  submitted: "outline",
  approved: "default",
  locked: "default",
};

interface MarkDraft {
  score: string;
  absent: boolean;
  exempt: boolean;
}

function MarksPage() {
  const school = useSchool();
  const qc = useQueryClient();
  const schoolId = school.schoolId!;
  const isAdmin = school.can("admin", "exam_officer", "principal", "deputy", "super_admin");

  const [grade, setGrade] = useState<CbeGrade | "">("");
  const [streamId, setStreamId] = useState("");
  const [assessmentId, setAssessmentId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, MarkDraft>>({});
  const [approveAllOpen, setApproveAllOpen] = useState(false);

  const streams = useQuery({
    queryKey: ["marks-streams", schoolId, grade, school.academicYearId],
    enabled: Boolean(grade),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streams")
        .select("id, name, grade")
        .eq("school_id", schoolId)
        .eq("grade", grade!)
        .order("grade")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const entryMode = grade ? markEntryMode(grade) : "numeric";

  const assessments = useQuery({
    queryKey: ["assessments", schoolId, grade, streamId, school.termId],
    enabled: Boolean(grade && (isAdmin || streamId)),
    queryFn: async () => {
      let query = supabase
        .from("assessments")
        .select("*")
        .eq("school_id", schoolId)
        .eq("grade", grade!)
        .order("assessment_date", { ascending: false });
      query = isAdmin ? query : query.or(`stream_id.is.null,stream_id.eq.${streamId}`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const assessment = assessments.data?.find((a) => a.id === assessmentId) ?? null;
  const editable = assessment ? ["draft", "submitted"].includes(assessment.status) : false;

  const learners = useQuery({
    queryKey: ["grade-learners", schoolId, grade, streamId],
    enabled: Boolean(grade && streamId),
    queryFn: async () => {
      let query = supabase
        .from("learners")
        .select("id, admission_number, first_name, middle_name, last_name")
        .eq("school_id", schoolId)
        .eq("current_grade", grade!)
        .eq("is_archived", false)
        .order("last_name");
      query = query.eq("current_stream_id", streamId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const allGradeLearners = useQuery({
    queryKey: ["all-grade-learners", schoolId, grade],
    enabled: Boolean(grade && assessmentId && isAdmin),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learners")
        .select("id, current_stream_id")
        .eq("school_id", schoolId)
        .eq("current_grade", grade!)
        .eq("is_archived", false);
      if (error) throw error;
      return data;
    },
  });

  const matchingSubmittedAssessments = (assessments.data ?? []).filter(
    (candidate) =>
      candidate.status === "submitted" &&
      candidate.title === assessment?.title &&
      candidate.learning_area_id === assessment?.learning_area_id &&
      candidate.assessment_type === assessment?.assessment_type &&
      candidate.assessment_date === assessment?.assessment_date &&
      candidate.max_score === assessment?.max_score,
  );
  const streamAssessments = matchingSubmittedAssessments.filter((candidate) => candidate.stream_id);
  const approveAllAssessments = streamAssessments.length > 0 ? streamAssessments : matchingSubmittedAssessments;
  const approveAllLearnerCount = approveAllAssessments.reduce(
    (total, candidate) =>
      total +
      (allGradeLearners.data ?? []).filter(
        (learner) => !candidate.stream_id || learner.current_stream_id === candidate.stream_id,
      ).length,
    0,
  );

  const marks = useQuery({
    queryKey: ["marks", assessmentId],
    enabled: Boolean(assessmentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marks")
        .select("*")
        .eq("assessment_id", assessmentId);
      if (error) throw error;
      return data;
    },
  });

  const markFor = (learnerId: string) => marks.data?.find((m) => m.learner_id === learnerId);
  const currentMarked = (learners.data ?? []).filter(
    (learner) =>
      markFor(learner.id)?.raw_score !== null ||
      markFor(learner.id)?.is_absent ||
      markFor(learner.id)?.is_exempt,
  ).length;
  const overallMarked = (allGradeLearners.data ?? []).filter((learner) => {
    const mark = markFor(learner.id);
    return mark?.raw_score !== null || mark?.is_absent || mark?.is_exempt;
  }).length;
  const draftFor = (learnerId: string): MarkDraft => {
    const d = drafts[learnerId];
    if (d) return d;
    const m = markFor(learnerId);
    return {
      score: m?.raw_score !== null && m?.raw_score !== undefined ? String(m.raw_score) : "",
      absent: m?.is_absent ?? false,
      exempt: m?.is_exempt ?? false,
    };
  };
  const setDraft = (learnerId: string, patch: Partial<MarkDraft>) =>
    setDrafts((prev) => ({ ...prev, [learnerId]: { ...draftFor(learnerId), ...patch } }));

  // ---- save marks
  const saveMarks = useMutation({
    mutationFn: async () => {
      if (!assessment) throw new Error("Select an assessment.");
      const rows = (learners.data ?? []).map((l) => {
        const d = draftFor(l.id);
        const score = d.score.trim() === "" ? null : Number(d.score);
        if (
          score !== null &&
          (Number.isNaN(score) || score < 0 || score > Number(assessment.max_score))
        ) {
          throw new Error(
            `${l.first_name} ${l.last_name}: score must be between 0 and ${assessment.max_score}.`,
          );
        }
        return {
          school_id: schoolId,
          assessment_id: assessment.id,
          learner_id: l.id,
          raw_score: score,
          is_absent: d.absent,
          is_exempt: d.exempt,
        };
      });
      const { error } = await supabase
        .from("marks")
        .upsert(rows, { onConflict: "assessment_id,learner_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marks saved successfully.");
      setDrafts({});
      void qc.invalidateQueries({ queryKey: ["marks", assessmentId] });
    },
    onError: (e: Error) => toast.error("Marks were not saved.", { description: e.message }),
  });

  const setStatus = useMutation({
    mutationFn: async (status: "draft" | "submitted" | "approved" | "locked") => {
      if (!assessmentId) throw new Error("Select an assessment.");
      const { data, error } = await supabase
        .from("assessments")
        .update({ status })
        .eq("id", assessmentId)
        .select("id, status");
      if (error) throw error;
      if (!data?.length) throw new Error("The assessment could not be updated. Refresh and try again.");
      return status;
    },
    onSuccess: (status) => {
      toast.success(
        status === "submitted"
          ? "Marks submitted for approval."
          : status === "approved"
            ? "Assessment approved successfully."
            : status === "locked"
              ? "Assessment locked successfully."
              : "Assessment reopened.",
      );
      void qc.invalidateQueries({ queryKey: ["assessments", schoolId] });
    },
    onError: (e: Error) =>
      toast.error("Status change refused by the server.", { description: e.message }),
  });

  const approveAll = useMutation({
    mutationFn: async () => {
      if (!assessment || approveAllAssessments.length === 0) {
        throw new Error("There are no submitted stream assessments to approve.");
      }
      for (const candidate of approveAllAssessments) {
        const { data, error } = await supabase
          .from("assessments")
          .update({ status: "approved" })
          .eq("school_id", schoolId)
          .eq("id", candidate.id)
          .eq("status", "submitted")
          .select("id");
        if (error) throw error;
        if (!data?.length) {
          throw new Error(`${candidate.title} changed before it could be approved.`);
        }
      }
    },
    onSuccess: () => {
      setApproveAllOpen(false);
      toast.success(`${approveAllAssessments.length} assessment${approveAllAssessments.length === 1 ? "" : "s"} approved.`);
      void qc.invalidateQueries({ queryKey: ["assessments", schoolId] });
    },
    onError: (e: Error) => toast.error("Could not approve all marks.", { description: e.message }),
  });

  function exportMarks() {
    if (!assessment) return;
    downloadCsv(
      `marks-${assessment.title.replace(/\s+/g, "-").toLowerCase()}`,
      (learners.data ?? []).map((l) => {
        const m = markFor(l.id);
        return {
          admission_number: l.admission_number,
          learner: `${l.first_name} ${l.last_name}`,
          raw_score: m?.raw_score ?? "",
          percentage: m?.percentage ?? "",
          level: m?.level_code ?? "",
          points: m?.points ?? "",
          descriptor: m?.descriptor ?? "",
        };
      }),
    );
  }

  async function importMarks(file: File) {
    const rows = parseCsv(await file.text());
    if (rows.length === 0) {
      toast.error("That CSV file has no data rows.");
      return;
    }
    let matched = 0;
    const next: Record<string, MarkDraft> = { ...drafts };
    for (const row of rows) {
      const adm = row["admission_number"];
      const learner = (learners.data ?? []).find((l) => l.admission_number === adm);
      if (!learner) continue;
      matched++;
      next[learner.id] = {
        score: row["raw_score"] ?? "",
        absent: (row["absent"] ?? "").toLowerCase() === "true",
        exempt: (row["exempt"] ?? "").toLowerCase() === "true",
      };
    }
    setDrafts(next);
    toast.success(`${matched} learner mark${matched === 1 ? "" : "s"} loaded — review, then save.`);
  }

  const previewLevel = (scoreText: string) => {
    if (!assessment || scoreText.trim() === "") return null;
    const pct = (Number(scoreText) / Number(assessment.max_score)) * 100;
    if (Number.isNaN(pct)) return null;
    if (entryMode === "kjsea_competency" || entryMode === "kpsea_sections") {
      const lv = kjseaLevelFor(pct);
      return lv ? `${lv.code} · ${lv.points} pt${lv.points === 1 ? "" : "s"}` : null;
    }
    return `${pct.toFixed(1)}%`;
  };

  return (
    <>
      <PageHeader
        title="Marks entry"
        description="Entry rules adapt to the grade: KJSEA competency levels for Grades 1-5, KPSEA sections for Grade 6, numeric for Junior and Senior School, and observation descriptors for pre-primary."
        icon={ClipboardCheck}
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Select a class and assessment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="marks-grade">1. Grade</Label>
              <Select
                value={grade}
                onValueChange={(value) => {
                  setGrade(value as CbeGrade);
                  setStreamId("");
                  setAssessmentId("");
                  setDrafts({});
                }}
              >
                <SelectTrigger id="marks-grade">
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent>
                  {school.grades.map((item) => (
                    <SelectItem key={item} value={item}>
                      {GRADE_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/10 px-3 py-2.5 text-sm text-info-foreground">
                <Info className="mt-0.5 size-4 shrink-0" />
                <span>
                  {grade
                    ? `${MODE_LABELS[entryMode]} apply to ${GRADE_LABELS[grade]}.`
                    : "Choose a grade to see the entry rule for this class."}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="marks-stream">2. Stream</Label>
              <Select
                value={streamId}
                onValueChange={(value) => {
                  setStreamId(value);
                  setAssessmentId("");
                  setDrafts({});
                }}
                disabled={!grade}
              >
                <SelectTrigger id="marks-stream">
                  <SelectValue placeholder={isAdmin ? "All streams" : "Select your stream"} />
                </SelectTrigger>
                <SelectContent>
                  {(streams.data ?? []).map((stream) => (
                      <SelectItem key={stream.id} value={stream.id}>
                        {stream.grade} · {stream.name}
                      </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="marks-assessment">3. Assessment</Label>
              <Select
                value={assessmentId}
                onValueChange={(value) => {
                  setAssessmentId(value);
                  setDrafts({});
                }}
                disabled={!grade}
              >
                <SelectTrigger id="marks-assessment">
                  <SelectValue placeholder={grade ? "Select assessment" : "Select a grade first"} />
                </SelectTrigger>
                <SelectContent>
                  {(assessments.data ?? []).map((assessmentOption) => (
                    <SelectItem key={assessmentOption.id} value={assessmentOption.id}>
                      {assessmentOption.title} · {assessmentOption.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {assessment && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">{assessment.title}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Out of {assessment.max_score} ·{" "}
                {MODE_LABELS[assessment.entry_mode] ?? assessment.entry_mode}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={STATUS_TONE[assessment.status] ?? "secondary"}>
                {assessment.status}
              </Badge>
              <Button variant="outline" size="sm" onClick={exportMarks}>
                <Download className="mr-2 size-4" /> Export CSV
              </Button>
              <Button variant="outline" size="sm" asChild disabled={!editable}>
                <label className="cursor-pointer">
                  <Upload className="mr-2 size-4" /> Import CSV
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    disabled={!editable}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void importMarks(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </Button>
              {editable && (
                <Button size="sm" onClick={() => saveMarks.mutate()} disabled={saveMarks.isPending}>
                  <Save className="mr-2 size-4" /> Save marks
                </Button>
              )}
              {assessment.status === "draft" && (
                <Button size="sm" variant="secondary" onClick={() => setStatus.mutate("submitted")}>
                  <Send className="mr-2 size-4" /> Submit for approval
                </Button>
              )}
              {assessment.status === "submitted" && isAdmin && (
                <>
                  <Button size="sm" onClick={() => setStatus.mutate("approved")}>
                    <CheckCheck className="mr-2 size-4" /> Approve
                  </Button>
                  {approveAllAssessments.length > 1 && (
                    <Button size="sm" variant="secondary" onClick={() => setApproveAllOpen(true)}>
                      <CheckCheck className="mr-2 size-4" /> Approve all
                    </Button>
                  )}
                </>
              )}
              {assessment.status === "approved" && isAdmin && (
                <Button size="sm" variant="destructive" onClick={() => setStatus.mutate("locked")}>
                  <Lock className="mr-2 size-4" /> Lock permanently
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <span className="font-medium">
                  {streams.data?.find((item) => item.id === streamId)?.name ?? "Selected stream"}:
                </span>{" "}
                {currentMarked} of {(learners.data ?? []).length} learners marked
              </div>
              {isAdmin && (
                <div className="rounded-md border bg-muted/30 px-3 py-2">
                  <span className="font-medium">{GRADE_LABELS[grade as CbeGrade]} overall:</span>{" "}
                  {overallMarked} of {(allGradeLearners.data ?? []).length} learners marked
                </div>
              )}
            </div>
            {!editable && (
              <p className="mb-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                This assessment is {assessment.status}. Marks are read-only — the server rejects any
                change.
              </p>
            )}
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Adm. no.</TableHead>
                    <TableHead>Learner</TableHead>
                    <TableHead className="w-[120px]">Score</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead className="w-[90px]">Absent</TableHead>
                    <TableHead className="w-[90px]">Exempt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(learners.data ?? []).length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        No learners are assigned to this class yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {(learners.data ?? []).map((l) => {
                    const d = draftFor(l.id);
                    const m = markFor(l.id);
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-xs">{l.admission_number}</TableCell>
                        <TableCell className="font-medium">
                          {l.first_name} {l.last_name}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={Number(assessment.max_score)}
                            value={d.score}
                            disabled={!editable || d.absent || d.exempt}
                            onChange={(e) => setDraft(l.id, { score: e.target.value })}
                            aria-label={`Score for ${l.first_name} ${l.last_name}`}
                          />
                        </TableCell>
                        <TableCell className="text-sm">
                          {d.absent ? (
                            <Badge variant="outline">Absent</Badge>
                          ) : d.exempt ? (
                            <Badge variant="outline">Exempt</Badge>
                          ) : (
                            (previewLevel(d.score) ?? m?.descriptor ?? "—")
                          )}
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={d.absent}
                            disabled={!editable}
                            onCheckedChange={(v) =>
                              setDraft(l.id, { absent: Boolean(v), exempt: false })
                            }
                            aria-label={`Mark ${l.first_name} absent`}
                          />
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={d.exempt}
                            disabled={!editable}
                            onCheckedChange={(v) =>
                              setDraft(l.id, { exempt: Boolean(v), absent: false })
                            }
                            aria-label={`Mark ${l.first_name} exempt`}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Absence and exemption are never converted to zero. Percentages, KJSEA levels and
              points are computed on the server so they cannot be tampered with.
            </p>
          </CardContent>
        </Card>
      )}
      <Dialog open={approveAllOpen} onOpenChange={setApproveAllOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve all submitted marks?</DialogTitle>
            <DialogDescription>
              This final action will approve {assessment?.title} for {GRADE_LABELS[grade as CbeGrade]}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {approveAllAssessments.map((candidate) => {
              const stream = streams.data?.find((item) => item.id === candidate.stream_id);
              const learnerCount = (allGradeLearners.data ?? []).filter(
                (learner) => !candidate.stream_id || learner.current_stream_id === candidate.stream_id,
              ).length;
              return (
                <div key={candidate.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span>{GRADE_LABELS[candidate.grade]} {stream?.name ?? "all streams"}</span>
                  <span className="text-muted-foreground">{learnerCount} learners</span>
                </div>
              );
            })}
            <p className="pt-2 font-medium">{approveAllLearnerCount} learners total</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveAllOpen(false)}>Cancel</Button>
            <Button onClick={() => approveAll.mutate()} disabled={approveAll.isPending}>
              <CheckCheck className="mr-2 size-4" /> Approve all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
