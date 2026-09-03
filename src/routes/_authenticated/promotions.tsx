import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, Check, GraduationCap, History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { RequireSchool } from "@/components/require-school";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GRADE_LABELS, LEVEL_GRADES, type CbeGrade } from "@/lib/cbe";
import { supabase } from "@/lib/supabase";
import { useSchool } from "@/hooks/use-school";
import { formatDateTime, initials } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/promotions")({
  component: () => (
    <RequireSchool roles={["principal", "deputy"]}>
      <PromotionsPage />
    </RequireSchool>
  ),
});

type Learner = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  admission_number: string;
  current_grade: CbeGrade | null;
  current_stream_id: string | null;
};
type Stream = { id: string; name: string; grade: CbeGrade };
type Destination = { grade: CbeGrade; streamId: string };
const db = supabase as unknown as {
  from: (table: string) => ReturnType<typeof supabase.from>;
};
const grades = Object.values(LEVEL_GRADES)
  .flat()
  .filter((grade, index, list) => list.indexOf(grade) === index);

function PromotionsPage() {
  const school = useSchool();
  const schoolId = school.schoolId!;
  const qc = useQueryClient();
  const [sourceGrade, setSourceGrade] = useState<CbeGrade>(school.grades[0] ?? "G1");
  const [sourceStream, setSourceStream] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [destinations, setDestinations] = useState<Record<string, Destination>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const streams = useQuery({
    queryKey: ["promotion-streams", schoolId],
    queryFn: async () => {
      const { data, error } = await db
        .from("streams")
        .select("id, name, grade")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Stream[];
    },
  });
  const learners = useQuery({
    queryKey: ["promotion-learners", schoolId, sourceGrade, sourceStream],
    queryFn: async () => {
      const query = supabase
        .from("learners")
        .select(
          "id, first_name, middle_name, last_name, admission_number, current_grade, current_stream_id",
        )
        .eq("school_id", schoolId)
        .eq("current_grade", sourceGrade)
        .eq("is_archived", false)
        .order("last_name");
      const { data, error } =
        sourceStream === "all" ? await query : await query.eq("current_stream_id", sourceStream);
      if (error) throw error;
      return (data ?? []) as Learner[];
    },
  });
  const history = useQuery({
    queryKey: ["promotion-history", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, actor_name, created_at, reason, after_data")
        .eq("school_id", schoolId)
        .eq("action", "bulk_promotion")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
  const visibleStreams = (streams.data ?? []).filter((stream) => stream.grade === sourceGrade);
  const sourceLearners = learners.data ?? [];
  const nextGrade =
    grades[Math.min(grades.indexOf(sourceGrade) + 1, grades.length - 1)] ?? sourceGrade;
  const selectedLearners = sourceLearners.filter((learner) => selected.includes(learner.id));
  const isTransition = sourceGrade === "G9";
  const pathwayOptions = [
    "Senior School · STEM",
    "Senior School · Social Sciences",
    "Senior School · Arts and Sports Science",
  ];

  function selectAll(checked: boolean) {
    setSelected(checked ? sourceLearners.map((learner) => learner.id) : []);
  }
  function destinationFor(learner: Learner): Destination {
    return (
      destinations[learner.id] ?? { grade: isTransition ? "G10" : nextGrade, streamId: "none" }
    );
  }
  function setDestination(id: string, value: Destination) {
    setDestinations((current) => ({ ...current, [id]: value }));
  }

  const summary = selectedLearners
    .map((learner) => destinationFor(learner))
    .reduce<Record<string, number>>((counts, destination) => {
      const label = isTransition
        ? destination.streamId
        : `${GRADE_LABELS[destination.grade]}${destination.streamId !== "none" ? ` · ${streams.data?.find((stream) => stream.id === destination.streamId)?.name ?? "Stream"}` : ""}`;
      counts[label] = (counts[label] ?? 0) + 1;
      return counts;
    }, {});

  const promote = useMutation({
    mutationFn: async () => {
      if (!selectedLearners.length) throw new Error("Select at least one learner.");
      const grouped = Object.entries(summary)
        .map(([destination, count]) => `${count} to ${destination}`)
        .join(", ");
      for (const learner of selectedLearners) {
        const destination = destinationFor(learner);
        const { error: updateError } = await supabase
          .from("learners")
          .update({
            current_grade: destination.grade,
            current_stream_id: destination.streamId === "none" ? null : destination.streamId,
            status: "active",
          })
          .eq("id", learner.id)
          .eq("school_id", schoolId);
        if (updateError) throw updateError;
        await db
          .from("student_class_history")
          .update({
            end_date: new Date().toISOString().slice(0, 10),
            status: "completed",
            promotion_status: "promoted",
            moved_by: school.userId,
          })
          .eq("learner_id", learner.id)
          .eq("status", "active");
        const { error: historyError } = await db.from("student_class_history").insert({
          school_id: schoolId,
          learner_id: learner.id,
          academic_year_id: school.academicYearId,
          grade: destination.grade,
          stream_id: destination.streamId === "none" ? null : destination.streamId,
          enrollment_date: new Date().toISOString().slice(0, 10),
          status: "active",
          promotion_status: isTransition ? "transition" : "promoted",
          movement_reason: `Promoted from ${GRADE_LABELS[sourceGrade]}`,
          moved_by: school.userId,
        });
        if (historyError) throw historyError;
      }
      const { error } = await supabase.from("audit_logs").insert({
        action: "bulk_promotion",
        entity: "learners",
        school_id: schoolId,
        actor_id: school.userId,
        actor_name: school.fullName,
        reason: `Promoted ${selectedLearners.length} learners`,
        after_data: {
          from: sourceGrade,
          source_stream: sourceStream,
          destinations: summary,
          detail: grouped,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(
        `${selectedLearners.length} learner${selectedLearners.length === 1 ? "" : "s"} promoted successfully.`,
      );
      setSelected([]);
      setDestinations({});
      setConfirmOpen(false);
      void Promise.all([
        qc.invalidateQueries({ queryKey: ["promotion-learners"] }),
        qc.invalidateQueries({ queryKey: ["promotion-history"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
        qc.invalidateQueries({ queryKey: ["learner-profile"] }),
      ]);
    },
    onError: (error: Error) =>
      toast.error("Promotion could not be completed.", { description: error.message }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promote Students"
        description="Move learners to their next grade and stream at the end of a term or year."
        icon={GraduationCap}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.7fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Step 1 · Select source</CardTitle>
              <CardDescription>Choose the grade and stream to promote from.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={sourceGrade}
                onValueChange={(value) => {
                  setSourceGrade(value as CbeGrade);
                  setSourceStream("all");
                  setSelected([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {grades.map((grade) => (
                    <SelectItem key={grade} value={grade}>
                      {GRADE_LABELS[grade]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={sourceStream}
                onValueChange={(value) => {
                  setSourceStream(value);
                  setSelected([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All streams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All streams</SelectItem>
                  {visibleStreams.map((stream) => (
                    <SelectItem key={stream.id} value={stream.id}>
                      {stream.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="secondary">
                {sourceLearners.length} learner{sourceLearners.length === 1 ? "" : "s"} available
              </Badge>
              {isTransition && (
                <p className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                  Grade 9 learners will move into Senior School pathways.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <History className="mr-2 inline size-5" /> Promotion History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {history.data?.length ? (
                history.data.map((item) => (
                  <div key={item.id} className="border-b pb-3 text-sm last:border-0">
                    <p className="font-medium">{item.reason}</p>
                    <p className="text-muted-foreground">
                      {item.actor_name ?? "System"} · {formatDateTime(item.created_at)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No promotion batches recorded.</p>
              )}
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Step 2 · Learner list</CardTitle>
            <CardDescription>
              Select learners and confirm each destination before promoting.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex items-center gap-3 border-b px-5 py-3">
              <Checkbox
                checked={selected.length === sourceLearners.length && sourceLearners.length > 0}
                onCheckedChange={(checked) => selectAll(Boolean(checked))}
              />
              <span className="text-sm font-medium">Select all</span>
              <span className="ml-auto text-sm text-muted-foreground">
                {selected.length} selected
              </span>
            </div>
            <div className="divide-y">
              {sourceLearners.map((learner) => {
                const name = [learner.first_name, learner.middle_name, learner.last_name]
                  .filter(Boolean)
                  .join(" ");
                const destination = destinationFor(learner);
                return (
                  <div
                    key={learner.id}
                    className="grid gap-3 px-5 py-4 md:grid-cols-[auto_1fr_1fr] md:items-center"
                  >
                    <Checkbox
                      checked={selected.includes(learner.id)}
                      onCheckedChange={(checked) =>
                        setSelected((current) =>
                          checked
                            ? [...current, learner.id]
                            : current.filter((id) => id !== learner.id),
                        )
                      }
                    />
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {initials(name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{name}</p>
                        <p className="text-xs text-muted-foreground">
                          Adm: {learner.admission_number} ·{" "}
                          {GRADE_LABELS[learner.current_grade ?? sourceGrade]}
                        </p>
                      </div>
                    </div>
                    <div className="md:pl-4">
                      {isTransition ? (
                        <Select
                          value={destination.streamId}
                          onValueChange={(value) =>
                            setDestination(learner.id, { grade: "G10", streamId: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose pathway" />
                          </SelectTrigger>
                          <SelectContent>
                            {pathwayOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Select
                          value={destination.grade}
                          onValueChange={(value) =>
                            setDestination(learner.id, { ...destination, grade: value as CbeGrade })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {grades
                              .slice(Math.max(0, grades.indexOf(sourceGrade) + 1))
                              .map((grade) => (
                                <SelectItem key={grade} value={grade}>
                                  {GRADE_LABELS[grade]}
                                </SelectItem>
                              ))}
                            <SelectItem value={sourceGrade}>
                              Repeat {GRADE_LABELS[sourceGrade]}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                );
              })}
              {!sourceLearners.length && (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  No active learners in this source group.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3 border-t bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                {Object.entries(summary).map(([label, count]) => (
                  <span key={label} className="mr-3 inline-flex items-center gap-1">
                    <Check className="size-3 text-primary" />
                    {count} {label}
                  </span>
                ))}
              </div>
              <Button disabled={!selected.length} onClick={() => setConfirmOpen(true)}>
                Review Promotion <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm promotion</DialogTitle>
            <DialogDescription>
              This action updates official learner records and appends grade history for{" "}
              {selected.length} learner{selected.length === 1 ? "" : "s"}. It cannot be undone from
              this screen.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            {Object.entries(summary).map(([label, count]) => (
              <p key={label}>
                {count} learner{count === 1 ? "" : "s"} from {GRADE_LABELS[sourceGrade]}{" "}
                <ArrowRight className="mx-1 inline size-4" /> {label}
              </p>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button disabled={promote.isPending} onClick={() => promote.mutate()}>
              {promote.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}{" "}
              {promote.isPending ? "Promoting…" : "Promote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
