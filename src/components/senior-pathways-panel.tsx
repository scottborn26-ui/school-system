import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Layers3, Plus, Route as RouteIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";

type SeniorPathway = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
};
type PathwayTrack = {
  id: string;
  pathway_id: string;
  name: string;
  code: string;
  is_active: boolean;
};
type PathwayStrand = {
  id: string;
  track_id: string;
  name: string;
  code: string;
  is_active: boolean;
};

// The generated Supabase types are refreshed from the database separately from migrations.
/* eslint-disable @typescript-eslint/no-explicit-any */
const seniorDb = supabase as unknown as { from: (table: string) => any };
/* eslint-enable @typescript-eslint/no-explicit-any */

export function SeniorPathwaysPanel({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const [pathwayId, setPathwayId] = useState("");
  const [trackId, setTrackId] = useState("");
  const [strandId, setStrandId] = useState("");
  const [pathwayName, setPathwayName] = useState("");
  const [trackName, setTrackName] = useState("");
  const [strandName, setStrandName] = useState("");
  const [areaId, setAreaId] = useState("");
  const [ruleCompulsory, setRuleCompulsory] = useState(false);
  const [ruleMin, setRuleMin] = useState("0");
  const [ruleMax, setRuleMax] = useState("");
  const [assessmentType, setAssessmentType] = useState("numeric");
  const [gradingSystem, setGradingSystem] = useState("percentage");
  const [weighting, setWeighting] = useState("1");

  const pathways = useQuery({
    queryKey: ["senior-pathways", schoolId],
    queryFn: async () => {
      const { data, error } = await seniorDb
        .from("senior_pathways")
        .select("id, name, code, description, is_active")
        .eq("school_id", schoolId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as SeniorPathway[];
    },
  });
  const tracks = useQuery({
    queryKey: ["pathway-tracks", schoolId],
    queryFn: async () => {
      const { data, error } = await seniorDb
        .from("pathway_tracks")
        .select("id, pathway_id, name, code, is_active")
        .eq("school_id", schoolId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as PathwayTrack[];
    },
  });
  const strands = useQuery({
    queryKey: ["pathway-strands", schoolId],
    queryFn: async () => {
      const { data, error } = await seniorDb
        .from("pathway_strands")
        .select("id, track_id, name, code, is_active")
        .eq("school_id", schoolId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as PathwayStrand[];
    },
  });
  const areas = useQuery({
    queryKey: ["learning-areas", schoolId],
    queryFn: async () => {
      const { data, error } = await seniorDb
        .from("learning_areas")
        .select("id, name, code, grades")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; code: string | null; grades: string[] }[];
    },
  });
  const rules = useQuery({
    queryKey: ["senior-learning-area-rules", schoolId],
    queryFn: async () => {
      const { data, error } = await seniorDb
        .from("senior_learning_area_rules")
        .select(
          "id, learning_area_id, pathway_id, track_id, strand_id, is_compulsory, min_selections, max_selections, assessment_type, grading_system, weighting",
        )
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as {
        id: string;
        learning_area_id: string;
        pathway_id: string | null;
        track_id: string | null;
        strand_id: string | null;
        is_compulsory: boolean;
        min_selections: number;
        max_selections: number | null;
        assessment_type: string;
        grading_system: string;
        weighting: number | null;
      }[];
    },
  });

  const selectedPathway = pathways.data?.find((item) => item.id === pathwayId);
  const visibleTracks = useMemo(
    () => (tracks.data ?? []).filter((item) => item.pathway_id === pathwayId),
    [pathwayId, tracks.data],
  );
  const visibleStrands = useMemo(
    () => (strands.data ?? []).filter((item) => item.track_id === trackId),
    [strands.data, trackId],
  );

  const add = useMutation({
    mutationFn: async ({ table, values }: { table: string; values: Record<string, unknown> }) => {
      const { error } = await seniorDb.from(table).insert({ school_id: schoolId, ...values });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success("Senior School configuration saved.");
      void qc.invalidateQueries({
        queryKey: [
          variables.table === "senior_pathways"
            ? "senior-pathways"
            : variables.table === "pathway_tracks"
              ? "pathway-tracks"
              : "pathway-strands",
          schoolId,
        ],
      });
    },
    onError: (error: Error) =>
      toast.error("Could not save configuration.", { description: error.message }),
  });

  function addPathway() {
    const name = pathwayName.trim();
    if (!name) return toast.error("Enter a pathway name.");
    add.mutate({
      table: "senior_pathways",
      values: { name, code: name.toUpperCase().replace(/[^A-Z0-9]+/g, "_") },
    });
    setPathwayName("");
  }

  function addTrack() {
    const name = trackName.trim();
    if (!pathwayId || !name) return toast.error("Select a pathway and enter a track name.");
    add.mutate({
      table: "pathway_tracks",
      values: { pathway_id: pathwayId, name, code: name.toUpperCase().replace(/[^A-Z0-9]+/g, "_") },
    });
    setTrackName("");
  }

  function addStrand() {
    const name = strandName.trim();
    if (!trackId || !name) return toast.error("Select a track and enter a strand name.");
    add.mutate({
      table: "pathway_strands",
      values: { track_id: trackId, name, code: name.toUpperCase().replace(/[^A-Z0-9]+/g, "_") },
    });
    setStrandName("");
  }

  const addRule = useMutation({
    mutationFn: async () => {
      if (!areaId || !pathwayId) throw new Error("Select a pathway and learning area.");
      const { error } = await seniorDb.from("senior_learning_area_rules").insert({
        school_id: schoolId,
        learning_area_id: areaId,
        pathway_id: pathwayId,
        track_id: trackId || null,
        strand_id: strandId || null,
        is_compulsory: ruleCompulsory,
        min_selections: Number(ruleMin) || 0,
        max_selections: ruleMax ? Number(ruleMax) : null,
        assessment_type: assessmentType,
        grading_system: gradingSystem,
        weighting: Number(weighting) || 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Learning area rule saved.");
      setAreaId("");
      void qc.invalidateQueries({ queryKey: ["senior-learning-area-rules", schoolId] });
    },
    onError: (error: Error) =>
      toast.error("Could not save learning area rule.", { description: error.message }),
  });

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" /> Senior School pathways
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Configure the pathways your school offers for Grades 10–12. The hierarchy is
          school-specific and supports Senior School placement only.
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <RouteIcon className="size-4" /> Pathways
              </span>
              <Badge variant="secondary">{pathways.data?.length ?? 0}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={pathwayName}
                onChange={(event) => setPathwayName(event.target.value)}
                placeholder="e.g. STEM"
                aria-label="Pathway name"
              />
              <Button size="icon" onClick={addPathway} aria-label="Add pathway">
                <Plus className="size-4" />
              </Button>
            </div>
            <div className="space-y-1.5">
              {(pathways.data ?? []).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setPathwayId(item.id);
                    setTrackId("");
                    setStrandId("");
                  }}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${item.id === pathwayId ? "border-primary bg-primary/10" : "hover:bg-muted/50"}`}
                >
                  <span>
                    <span className="block font-medium">{item.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.code} · Grades 10–12
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className={!selectedPathway ? "opacity-60" : undefined}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Layers3 className="size-4" /> Tracks
              </span>
              <Badge variant="secondary">{visibleTracks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label className="text-xs text-muted-foreground">
              {selectedPathway ? `Tracks in ${selectedPathway.name}` : "Select a pathway first"}
            </Label>
            <div className="flex gap-2">
              <Input
                value={trackName}
                onChange={(event) => setTrackName(event.target.value)}
                disabled={!selectedPathway}
                placeholder="e.g. Technology"
                aria-label="Track name"
              />
              <Button
                size="icon"
                onClick={addTrack}
                disabled={!selectedPathway}
                aria-label="Add track"
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <div className="space-y-1.5">
              {visibleTracks.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTrackId(item.id);
                    setStrandId("");
                  }}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${item.id === trackId ? "border-primary bg-primary/10" : "hover:bg-muted/50"}`}
                >
                  <span>
                    <span className="block font-medium">{item.name}</span>
                    <span className="text-xs text-muted-foreground">{item.code}</span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className={!trackId ? "opacity-60" : undefined}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Layers3 className="size-4" /> Strands
              </span>
              <Badge variant="secondary">{visibleStrands.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label className="text-xs text-muted-foreground">
              {trackId ? "Strands in selected track" : "Select a track first"}
            </Label>
            <div className="flex gap-2">
              <Input
                value={strandName}
                onChange={(event) => setStrandName(event.target.value)}
                disabled={!trackId}
                placeholder="e.g. Computing"
                aria-label="Strand name"
              />
              <Button size="icon" onClick={addStrand} disabled={!trackId} aria-label="Add strand">
                <Plus className="size-4" />
              </Button>
            </div>
            <div className="space-y-1.5">
              {visibleStrands.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStrandId(item.id)}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <span>
                    <span className="block font-medium">{item.name}</span>
                    <span className="text-xs text-muted-foreground">{item.code}</span>
                  </span>
                  <Badge variant="outline">Active</Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Learning area rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Link learning areas to the selected hierarchy and define the learner selection rules.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={areaId} onValueChange={setAreaId}>
              <SelectTrigger>
                <SelectValue placeholder="Learning area" />
              </SelectTrigger>
              <SelectContent>
                {(areas.data ?? []).map((area) => (
                  <SelectItem key={area.id} value={area.id}>
                    {area.name} {area.code ? `· ${area.code}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 rounded-md border px-3">
              <Switch
                checked={ruleCompulsory}
                onCheckedChange={setRuleCompulsory}
                id="rule-compulsory"
              />
              <Label htmlFor="rule-compulsory">Compulsory</Label>
            </div>
            <Input
              type="number"
              min="0"
              value={ruleMin}
              onChange={(event) => setRuleMin(event.target.value)}
              placeholder="Minimum selections"
              aria-label="Minimum selections"
            />
            <Input
              type="number"
              min="0"
              value={ruleMax}
              onChange={(event) => setRuleMax(event.target.value)}
              placeholder="Maximum selections"
              aria-label="Maximum selections"
            />
            <Select value={assessmentType} onValueChange={setAssessmentType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="numeric">Numeric</SelectItem>
                <SelectItem value="practical">Practical</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="rubric">Rubric</SelectItem>
                <SelectItem value="portfolio">Portfolio</SelectItem>
              </SelectContent>
            </Select>
            <Select value={gradingSystem} onValueChange={setGradingSystem}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="competency">Competency</SelectItem>
                <SelectItem value="points">Points</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={weighting}
              onChange={(event) => setWeighting(event.target.value)}
              placeholder="Weighting"
              aria-label="Assessment weighting"
            />
            <Button onClick={() => addRule.mutate()} disabled={addRule.isPending || !pathwayId}>
              <Plus className="mr-2 size-4" /> Add rule
            </Button>
          </div>
          <div className="divide-y rounded-lg border">
            {(rules.data ?? [])
              .filter((rule) => rule.pathway_id === pathwayId)
              .map((rule) => (
                <div
                  key={rule.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm"
                >
                  <span className="font-medium">
                    {areas.data?.find((area) => area.id === rule.learning_area_id)?.name ??
                      "Learning area"}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant={rule.is_compulsory ? "default" : "secondary"}>
                      {rule.is_compulsory ? "Compulsory" : "Optional"}
                    </Badge>
                    <Badge variant="outline">
                      {rule.assessment_type} · ×{rule.weighting ?? 1}
                    </Badge>
                    <span className="text-muted-foreground">
                      {rule.min_selections}–{rule.max_selections ?? "∞"} selections
                    </span>
                  </span>
                </div>
              ))}
            {!(rules.data ?? []).some((rule) => rule.pathway_id === pathwayId) && (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                Select a pathway above to view its learning area rules.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
