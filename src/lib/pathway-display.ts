export function isSeniorSchoolGrade(grade: string | null | undefined): boolean {
  return typeof grade === "string" && ["G10", "G11", "G12"].includes(grade);
}

export function formatSeniorPathwaySummary(
  assignment:
    | {
        senior_pathways?: { name?: string | null } | null;
        pathway_tracks?: { name?: string | null } | null;
        pathway_strands?: { name?: string | null } | null;
        subject_combinations?: { name?: string | null } | null;
      }
    | null
    | undefined,
): string {
  if (!assignment) return "Not captured";

  const parts = [
    assignment.senior_pathways?.name,
    assignment.pathway_tracks?.name,
    assignment.pathway_strands?.name,
    assignment.subject_combinations?.name,
  ].filter((part): part is string => Boolean(part && part.trim()));

  return parts.length ? parts.join(" • ") : "Not captured";
}
