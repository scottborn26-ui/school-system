import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Check, GraduationCap, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { RequireSchool } from "@/components/require-school";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSchool } from "@/hooks/use-school";
import { ALL_GRADES, GRADE_LABELS, type CbeGrade } from "@/lib/cbe";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/transition")({
  component: () => (
    <RequireSchool roles={["principal", "deputy", "super_admin"]}>
      <TransitionPage />
    </RequireSchool>
  ),
});

type Row = { id: string; name: string; code: string; pathway_id?: string; track_id?: string };
// The generated Supabase types do not include the additive Senior School tables yet.
/* eslint-disable @typescript-eslint/no-explicit-any */
const db = supabase as unknown as {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => any;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

function TransitionPage() {
  const school = useSchool();
  const qc = useQueryClient();
  const schoolId = school.schoolId!;
  const [step, setStep] = useState(1);
  const [learnerId, setLearnerId] = useState("");
  const [destination, setDestination] = useState<"senior_school">("senior_school");
  const [pathwayId, setPathwayId] = useState("");
  const [trackId, setTrackId] = useState("");
  const [strandId, setStrandId] = useState("");
  const [combinationId, setCombinationId] = useState("");
  const [nextGrade, setNextGrade] = useState<CbeGrade>("G10");
  const [nextStreamId, setNextStreamId] = useState("");
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [careerAspirations, setCareerAspirations] = useState("");

  const learners = useQuery({
    queryKey: ["transition-learners", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learners")
        .select("id, admission_number, first_name, last_name, current_grade")
        .eq("school_id", schoolId)
        .eq("current_grade", "G9")
        .eq("is_archived", false)
        .order("last_name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const pathways = useQuery({
    queryKey: ["senior-pathways", schoolId],
    queryFn: async () => {
      const { data, error } = await db
        .from("senior_pathways")
        .select("id, name, code")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Row[];
    },
  });
  const streams = useQuery({
    queryKey: ["school-streams", schoolId],
    queryFn: async () => {
      const { data, error } = await db
        .from("streams")
        .select("id, name, grade")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("grade")
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; grade: CbeGrade }[];
    },
  });
  const tracks = useQuery({
    queryKey: ["pathway-tracks", schoolId],
    queryFn: async () => {
      const { data, error } = await db
        .from("pathway_tracks")
        .select("id, name, code, pathway_id")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Row[];
    },
  });
  const strands = useQuery({
    queryKey: ["pathway-strands", schoolId],
    queryFn: async () => {
      const { data, error } = await db
        .from("pathway_strands")
        .select("id, name, code, track_id")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Row[];
    },
  });
  const selectedLearner = learners.data?.find((item) => item.id === learnerId);
  useEffect(() => {
    if (!selectedLearner?.current_grade) return;
    const currentIndex = ALL_GRADES.indexOf(selectedLearner.current_grade as CbeGrade);
    const nextAvailableGrade = (school.grades ?? ALL_GRADES).find(
      (grade) => ALL_GRADES.indexOf(grade as CbeGrade) > currentIndex,
    ) as CbeGrade | undefined;
    setNextGrade(nextAvailableGrade ?? ((school.grades ?? ["G10"])[0] as CbeGrade));
    setNextStreamId("");
  }, [school.grades, selectedLearner?.current_grade]);
  const visibleTracks = useMemo(
    () => (tracks.data ?? []).filter((item) => item.pathway_id === pathwayId),
    [pathwayId, tracks.data],
  );
  const visibleStrands = useMemo(
    () => (strands.data ?? []).filter((item) => item.track_id === trackId),
    [strands.data, trackId],
  );
  const availableStreams = useMemo(
    () => (streams.data ?? []).filter((stream) => stream.grade === nextGrade),
    [nextGrade, streams.data],
  );
  const combinations = useQuery({
    queryKey: ["subject-combinations", schoolId, pathwayId, trackId],
    enabled: Boolean(pathwayId && trackId),
    queryFn: async () => {
      const { data, error } = await db
        .from("subject_combinations")
        .select("id, name, code, pathway_id, track_id")
        .eq("school_id", schoolId)
        .eq("pathway_id", pathwayId)
        .eq("track_id", trackId)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data as Row[];
    },
  });
  const selectedPathway = pathways.data?.find((item) => item.id === pathwayId);
  const areas = useQuery({
    queryKey: ["transition-learning-areas", schoolId],
    queryFn: async () => {
      const { data, error } = await db
        .from("learning_areas")
        .select("id, name, code")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; code: string | null }[];
    },
  });
  const rules = useQuery({
    queryKey: ["transition-learning-area-rules", schoolId],
    queryFn: async () => {
      const { data, error } = await db
        .from("senior_learning_area_rules")
        .select(
          "learning_area_id, pathway_id, track_id, strand_id, is_compulsory, min_selections, max_selections",
        )
        .eq("school_id", schoolId)
        .eq("is_active", true);
      if (error) throw error;
      return data as {
        learning_area_id: string;
        pathway_id: string;
        track_id: string | null;
        strand_id: string | null;
        is_compulsory: boolean;
        min_selections: number;
        max_selections: number | null;
      }[];
    },
  });
  const visibleRules = (rules.data ?? []).filter(
    (rule) =>
      rule.pathway_id === pathwayId &&
      (!rule.track_id || rule.track_id === trackId) &&
      (!rule.strand_id || rule.strand_id === strandId),
  );
  const requiredAreaIds = visibleRules
    .filter((rule) => rule.is_compulsory || rule.min_selections > 0)
    .map((rule) => rule.learning_area_id);

  const submit = useMutation({
    mutationFn: async () => {
      if (!learnerId) throw new Error("Select a Grade 9 learner.");
      if (!school.academicYearId) throw new Error("Select the current academic year first.");
      if (!pathwayId) throw new Error("Select a Senior School pathway.");
      if (!trackId || !combinationId) throw new Error("Select a track and subject combination.");
      if (!nextGrade) throw new Error("Select the learner's next grade.");
      const { error } = await db.rpc("assign_senior_school_placement", {
        _school_id: schoolId,
        _learner_id: learnerId,
        _academic_year_id: school.academicYearId,
        _pathway_id: pathwayId,
        _track_id: trackId,
        _strand_id: strandId || null,
        _combination_id: combinationId,
        _next_grade: nextGrade,
        _stream_id: nextStreamId || null,
        _learning_area_ids: selectedAreaIds,
        _reason: "Grade 9 transition",
      });
      if (error) throw error;
      for (const [index, preference] of preferences.slice(0, 3).entries()) {
        const { error: preferenceError } = await db.from("student_pathway_preferences").insert({
          school_id: schoolId,
          learner_id: learnerId,
          academic_year_id: school.academicYearId,
          preference_rank: index + 1,
          pathway_id: preference,
          status: "approved",
          career_aspirations: careerAspirations,
        });
        if (preferenceError) throw preferenceError;
      }
    },
    onSuccess: () => {
      toast.success("Grade 9 transition recorded.");
      setStep(1);
      setLearnerId("");
      setPathwayId("");
      setTrackId("");
      setStrandId("");
      setCombinationId("");
      setNextGrade((school.grades?.[0] as CbeGrade) ?? "G10");
      setNextStreamId("");
      setSelectedAreaIds([]);
      setPreferences([]);
      void qc.invalidateQueries({ queryKey: ["transition-learners", schoolId] });
    },
    onError: (error: Error) =>
      toast.error("Transition could not be recorded.", { description: error.message }),
  });

  const canContinue =
    step === 1
      ? Boolean(learnerId)
      : step === 2
        ? Boolean(destination)
        : Boolean(pathwayId && trackId && combinationId && nextGrade) &&
          (availableStreams.length === 0 || Boolean(nextStreamId)) &&
          requiredAreaIds.every((id) => selectedAreaIds.includes(id));
  return (
    <>
      <PageHeader
        title="Grade 9 transition"
        description="Record a learner's approved destination and preserve the transition history."
        icon={GraduationCap}
      />
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="grid grid-cols-4 gap-2">
          {[
            "Learner",
            "Destination",
            "Pathway",
            "Review",
          ].map((label, index) => (
            <div
              key={label}
              className={`border-t-2 pt-2 text-xs font-medium ${step >= index + 1 ? "border-primary text-foreground" : "border-muted text-muted-foreground"}`}
            >
              <span className="mr-1">{index + 1}.</span>
              {label}
            </div>
          ))}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>
              {step === 1
                ? "Select Grade 9 learner"
                : step === 2
                  ? "Choose destination"
                  : step === 3
                    ? "Senior School placement"
                    : "Review and confirm"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {step === 1 && (
              <div className="space-y-2">
                <Label>Learner</Label>
                <Select value={learnerId} onValueChange={setLearnerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a learner completing Grade 9" />
                  </SelectTrigger>
                  <SelectContent>
                    {(learners.data ?? []).map((learner) => (
                      <SelectItem key={learner.id} value={learner.id}>
                        {learner.first_name} {learner.last_name} · {learner.admission_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {learners.data?.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No active Grade 9 learners are available.
                  </p>
                )}
              </div>
            )}
            {step === 2 && (
              <div className="grid gap-3 sm:grid-cols-1">
                <button
                  type="button"
                  onClick={() => setDestination("senior_school")}
                  className={`rounded-xl border p-5 text-left ${destination === "senior_school" ? "border-primary bg-primary/10" : "hover:bg-muted/40"}`}
                >
                  <GraduationCap className="mb-3 size-6 text-primary" />
                  <p className="font-semibold">Continue to Senior School</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Assign a pathway, track, and strand for Grade 10.
                  </p>
                </button>
              </div>
            )}
            {step === 3 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Pathway *</Label>
                  <Select
                    value={pathwayId}
                    onValueChange={(value) => {
                      setPathwayId(value);
                      setTrackId("");
                      setStrandId("");
                      setCombinationId("");
                      setSelectedAreaIds([]);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select pathway" />
                    </SelectTrigger>
                    <SelectContent>
                      {(pathways.data ?? []).map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Track</Label>
                  <Select
                    value={trackId}
                    onValueChange={(value) => {
                      setTrackId(value);
                      setStrandId("");
                      setCombinationId("");
                      setSelectedAreaIds([]);
                    }}
                    disabled={!pathwayId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select track" />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleTracks.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Strand / specialization</Label>
                  <Select
                    value={strandId}
                    onValueChange={(value) => {
                      setStrandId(value);
                      setSelectedAreaIds([]);
                    }}
                    disabled={!trackId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select strand" />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleStrands.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Subject combination *</Label>
                  <Select
                    value={combinationId}
                    onValueChange={(value) => {
                      setCombinationId(value);
                      setSelectedAreaIds([]);
                    }}
                    disabled={!trackId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject combination" />
                    </SelectTrigger>
                    <SelectContent>
                      {(combinations.data ?? []).map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} · {item.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Next grade *</Label>
                  <Select
                   value={nextGrade}
                   onValueChange={(value) => {
                     setNextGrade(value as CbeGrade);
                     setNextStreamId("");
                   }}
                  >
                   <SelectTrigger>
                     <SelectValue placeholder="Select next grade" />
                   </SelectTrigger>
                   <SelectContent>
                     {(school.grades ?? ["G10", "G11", "G12"]).map((grade) => (
                       <SelectItem key={grade} value={grade}>
                         {GRADE_LABELS[grade as CbeGrade]}
                       </SelectItem>
                     ))}
                   </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Next stream *</Label>
                  <Select
                   value={nextStreamId}
                   onValueChange={setNextStreamId}
                   disabled={availableStreams.length === 0}
                  >
                   <SelectTrigger>
                     <SelectValue placeholder="Select stream" />
                   </SelectTrigger>
                   <SelectContent>
                     {(availableStreams ?? []).map((stream) => (
                       <SelectItem key={stream.id} value={stream.id}>
                         {stream.name}
                       </SelectItem>
                     ))}
                   </SelectContent>
                  </Select>
                  {availableStreams.length === 0 && (
                   <p className="text-xs text-muted-foreground">
                     No streams are configured for {GRADE_LABELS[nextGrade]}.
                   </p>
                  )}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Learning areas</Label>
                  <div className="flex flex-wrap gap-2">
                    {visibleRules.map((rule) => {
                      const area = areas.data?.find((item) => item.id === rule.learning_area_id);
                      if (!area) return null;
                      const selected = selectedAreaIds.includes(area.id);
                      return (
                        <Button
                          key={area.id}
                          type="button"
                          variant={selected ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            setSelectedAreaIds((current) =>
                              selected
                                ? current.filter((id) => id !== area.id)
                                : [...current, area.id],
                            )
                          }
                        >
                          {selected && <Check className="mr-1 size-3" />}
                          {area.name}
                          {rule.is_compulsory && (
                            <Badge className="ml-1" variant="secondary">
                              Core
                            </Badge>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Compulsory areas must be selected before continuing.
                  </p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Pathway preferences</Label>
                  <div className="flex flex-wrap gap-2">
                    {(pathways.data ?? []).map((item) => (
                      <Button
                        key={item.id}
                        type="button"
                        variant={preferences.includes(item.id) ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          setPreferences((current) =>
                            current.includes(item.id)
                              ? current.filter((id) => id !== item.id)
                              : current.length < 3
                                ? [...current, item.id]
                                : current,
                          )
                        }
                      >
                        {preferences.includes(item.id) && <Check className="mr-1 size-3" />}
                        {preferences.indexOf(item.id) + 1 || ""} {item.name}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Career aspirations</Label>
                  <Textarea
                    value={careerAspirations}
                    onChange={(event) => setCareerAspirations(event.target.value)}
                    placeholder="Interests, talents, and career goals"
                  />
                </div>
              </div>
            )}
            {step === 4 && (
              <div className="rounded-xl border bg-muted/20 p-4 text-sm">
                <p className="font-semibold">
                  {selectedLearner?.first_name} {selectedLearner?.last_name}
                </p>
                <p className="mt-2 text-muted-foreground">
                  Destination:{" "}
                  <span className="font-medium text-foreground">{selectedPathway?.name}</span>
                </p>
                <p className="text-muted-foreground">
                  Track and strand:{" "}
                  <span className="font-medium text-foreground">
                    {visibleTracks.find((item) => item.id === trackId)?.name ?? "Not specified"} /{" "}
                    {visibleStrands.find((item) => item.id === strandId)?.name ?? "Not specified"}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Next placement:{" "}
                  <span className="font-medium text-foreground">
                    {GRADE_LABELS[nextGrade]} / {availableStreams.find((stream) => stream.id === nextStreamId)?.name ?? "No stream selected"}
                  </span>
                </p>
                <Badge className="mt-3" variant="outline">
                  Ready to record
                </Badge>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((current) => Math.max(1, current - 1))}
                disabled={step === 1}
              >
                Back
              </Button>
              {step < 4 ? (
                <Button
                  type="button"
                  onClick={() => setStep((current) => current + 1)}
                  disabled={!canContinue}
                >
                  Continue
                </Button>
              ) : (
                <Button type="button" onClick={() => submit.mutate()} disabled={submit.isPending}>
                  <Send className="mr-2 size-4" />
                  Record transition
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
