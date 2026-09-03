import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardPlus } from "lucide-react";
import { useState } from "react";
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
import { useSchool } from "@/hooks/use-school";
import { GRADE_LABELS, markEntryMode, type CbeGrade } from "@/lib/cbe";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/assignments")({
  head: () => ({
    meta: [
      { title: "Add assessment · SHANSCOTT CBE" },
      { name: "description", content: "Create grade-scoped exams, CATs, and assessments." },
    ],
  }),
  component: () => (
    <RequireSchool roles={["admin", "exam_officer", "principal", "deputy", "super_admin"]}>
      <AssignmentsPage />
    </RequireSchool>
  ),
});

function AssignmentsPage() {
  const school = useSchool();
  const qc = useQueryClient();
  const schoolId = school.schoolId!;
  const [grade, setGrade] = useState<CbeGrade | "">("");
  const [title, setTitle] = useState("");
  const [areaId, setAreaId] = useState("");
  const [allAreas, setAllAreas] = useState(false);
  const [bulkAreaIds, setBulkAreaIds] = useState<string[]>([]);
  const [type, setType] = useState("formative");
  const [maxScore, setMaxScore] = useState("100");
  const [bulkTitles, setBulkTitles] = useState<Record<string, string>>({});
  const [bulkMaxScores, setBulkMaxScores] = useState<Record<string, string>>({});
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().slice(0, 10));

  const areas = useQuery({
    queryKey: ["assignment-learning-areas", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_areas")
        .select("id, name, grades")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const createAssignment = useMutation({
    mutationFn: async () => {
      if (!grade) throw new Error("Select a grade.");
      const { data: configuredStreams, error: streamError } = await supabase
        .from("streams")
        .select("id")
        .eq("school_id", schoolId)
        .eq("grade", grade)
        .eq("is_active", true);
      if (streamError) throw streamError;
      if (!configuredStreams?.length) {
        throw new Error("Configure at least one active stream for this grade before creating an assessment.");
      }
      const selectedAreas = allAreas
        ? offeredAreas.filter((area) => bulkAreaIds.includes(area.id))
        : offeredAreas.filter((area) => area.id === areaId);
      if (selectedAreas.length === 0)
        throw new Error(
          allAreas ? "Select at least one learning area." : "Select a learning area.",
        );
      const assignmentDetails = selectedAreas.map((area) => ({
        area,
        title: allAreas ? (bulkTitles[area.id] ?? "").trim() : title.trim(),
        maximum: Number(allAreas ? bulkMaxScores[area.id] : maxScore),
      }));
      const invalid = assignmentDetails.find(
        (detail) =>
          detail.title.length < 3 || !Number.isFinite(detail.maximum) || detail.maximum <= 0,
      );
      if (invalid)
        throw new Error(
          `${invalid.area.name}: enter an assignment name and a maximum score greater than zero.`,
        );
      const { data, error } = await supabase
        .from("assessments")
        .insert(
          selectedAreas.map((area) => ({
            school_id: schoolId,
            academic_year_id: school.academicYearId,
            term_id: school.termId,
            grade,
            stream_id: null,
            learning_area_id: area.id,
            title: assignmentDetails.find((detail) => detail.area.id === area.id)!.title,
            assessment_type: type,
            entry_mode: markEntryMode(grade),
            max_score: assignmentDetails.find((detail) => detail.area.id === area.id)!.maximum,
            assessment_date: assessmentDate,
            created_by: school.userId,
          })),
        )
        .select("id, learning_area_id");
      if (error) throw error;
      await supabase.from("audit_logs").insert(
        (data ?? []).map((assessment) => ({
          school_id: schoolId,
          actor_id: school.userId,
          actor_name: school.fullName,
          action: "create",
          entity: "assessment",
          entity_id: assessment.id,
          after_data: {
            title: assignmentDetails.find(
              (detail) => detail.area.id === assessment.learning_area_id,
            )!.title,
            grade,
            learning_area_id: assessment.learning_area_id,
            assessment_type: type,
            max_score: assignmentDetails.find(
              (detail) => detail.area.id === assessment.learning_area_id,
            )!.maximum,
            assessment_date: assessmentDate,
          },
        })),
      );
      return selectedAreas.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} assessment${count === 1 ? "" : "s"} created.`, {
        description: "Each assessment is available for every active stream in the selected grade.",
      });
      setTitle("");
      setAreaId("");
      setAllAreas(false);
      setBulkAreaIds([]);
      setBulkTitles({});
      setBulkMaxScores({});
      setMaxScore("100");
      setAssessmentDate(new Date().toISOString().slice(0, 10));
      void qc.invalidateQueries({ queryKey: ["assessment-browser"] });
      void qc.invalidateQueries({ queryKey: ["assessments"] });
    },
    onError: (error: Error) =>
      toast.error("Could not create assessment.", { description: error.message }),
  });

  const offeredAreas = (areas.data ?? []).filter(
    (area) => !grade || (area.grades ?? []).includes(grade),
  );

  return (
    <>
      <PageHeader
        title="Add assessment"
        description="Create an exam, CAT, or other grade-level assessment for every active stream in the grade."
        icon={ClipboardPlus}
      />
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="text-base">Assessment details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-md border border-info/30 bg-info/10 p-3 text-sm text-info-foreground">
            Select a grade, not a stream. New streams added to the grade will automatically be
            included.
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Grade</Label>
              <Select
                value={grade}
                onValueChange={(value) => {
                  setGrade(value as CbeGrade);
                  setAreaId("");
                  setBulkAreaIds([]);
                  setBulkTitles({});
                  setBulkMaxScores({});
                }}
              >
                <SelectTrigger>
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
            </div>
            <div className="space-y-1.5">
              <Label>Learning area</Label>
              <Select value={areaId} onValueChange={setAreaId} disabled={!grade || allAreas}>
                <SelectTrigger>
                  <SelectValue placeholder={allAreas ? "All learning areas" : "Select subject"} />
                </SelectTrigger>
                <SelectContent>
                  {offeredAreas.map((area) => (
                    <SelectItem key={area.id} value={area.id}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm">
            <Checkbox
              checked={allAreas}
              onCheckedChange={(checked) => {
                const enabled = Boolean(checked);
                setAllAreas(enabled);
                setAreaId("");
                setBulkAreaIds(enabled ? offeredAreas.map((area) => area.id) : []);
              }}
              disabled={!grade}
            />
            <span>
              <span className="font-medium">Select learning areas in bulk</span>
              <span className="block text-muted-foreground">
                All subjects start selected. Deselect any subject you do not want to add.
              </span>
            </span>
          </label>
          {!allAreas && (
            <div className="space-y-1.5">
              <Label htmlFor="assignment-title">Assessment name</Label>
              <Input
                id="assignment-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Term 2 Mathematics CAT"
              />
            </div>
          )}
          {allAreas && grade && (
            <div className="space-y-3 rounded-md border p-4">
              <div>
                <p className="font-medium">Assignment details by learning area</p>
                <p className="text-sm text-muted-foreground">
                  Deselect subjects you do not want to include, then configure each selected
                  assignment.
                </p>
              </div>
              {offeredAreas.map((area) => {
                const selected = bulkAreaIds.includes(area.id);
                return (
                  <div
                    key={area.id}
                    className={`grid gap-3 rounded-md p-3 sm:grid-cols-[auto_1fr_160px] ${selected ? "bg-muted/30" : "bg-muted/10 opacity-70"}`}
                  >
                    <div className="flex items-start pt-2">
                      <Checkbox
                        checked={selected}
                        onCheckedChange={(checked) =>
                          setBulkAreaIds((current) =>
                            checked
                              ? [...current, area.id]
                              : current.filter((id) => id !== area.id),
                          )
                        }
                        aria-label={`Include ${area.name}`}
                      />
                    </div>
                    {selected ? (
                      <>
                        <div className="space-y-1.5">
                          <Label htmlFor={`bulk-title-${area.id}`}>
                            {area.name} assessment name
                          </Label>
                          <Input
                            id={`bulk-title-${area.id}`}
                            value={bulkTitles[area.id] ?? ""}
                            onChange={(event) =>
                              setBulkTitles((current) => ({
                                ...current,
                                [area.id]: event.target.value,
                              }))
                            }
                            placeholder={`${area.name} assessment`}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`bulk-score-${area.id}`}>Maximum score</Label>
                          <Input
                            id={`bulk-score-${area.id}`}
                            type="number"
                            min={1}
                            value={bulkMaxScores[area.id] ?? "100"}
                            onChange={(event) =>
                              setBulkMaxScores((current) => ({
                                ...current,
                                [area.id]: event.target.value,
                              }))
                            }
                          />
                        </div>
                      </>
                    ) : (
                      <div className="py-2 text-sm text-muted-foreground">{area.name} excluded</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Assessment type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "exam",
                    "cat",
                    "assessment",
                    "formative",
                    "summative",
                    "project",
                    "observation",
                    "kpsea",
                    "kjsea",
                  ].map((item) => (
                    <SelectItem key={item} value={item} className="capitalize">
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assignment-date">Date</Label>
              <Input
                id="assignment-date"
                type="date"
                value={assessmentDate}
                onChange={(event) => setAssessmentDate(event.target.value)}
              />
            </div>
            {!allAreas && (
              <div className="space-y-1.5">
                <Label htmlFor="assignment-score">Maximum score</Label>
                <Input
                  id="assignment-score"
                  type="number"
                  min={1}
                  value={maxScore}
                  onChange={(event) => setMaxScore(event.target.value)}
                />
              </div>
            )}
          </div>
          {grade && <Badge variant="outline">Entry mode: {markEntryMode(grade)}</Badge>}
          <div className="flex justify-end">
            <Button onClick={() => createAssignment.mutate()} disabled={createAssignment.isPending}>
              {createAssignment.isPending ? "Creating…" : "Create assessment"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
