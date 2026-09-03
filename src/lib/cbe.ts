/**
 * Kenyan CBE/CBC structural reference data and the 2025 KJSEA grading engine.
 * Grades are fixed by the national structure — schools may only select from these.
 */

export type CbeLevel =
  "pre_primary" | "lower_primary" | "upper_primary" | "junior_school" | "senior_school";

export type CbeGrade =
  | "PP1"
  | "PP2"
  | "G1"
  | "G2"
  | "G3"
  | "G4"
  | "G5"
  | "G6"
  | "G7"
  | "G8"
  | "G9"
  | "G10"
  | "G11"
  | "G12";

export const LEVEL_LABELS: Record<CbeLevel, string> = {
  pre_primary: "Pre-Primary",
  lower_primary: "Lower Primary",
  upper_primary: "Upper Primary",
  junior_school: "Junior School",
  senior_school: "Senior School",
};

export const GRADE_LABELS: Record<CbeGrade, string> = {
  PP1: "PP1",
  PP2: "PP2",
  G1: "Grade 1",
  G2: "Grade 2",
  G3: "Grade 3",
  G4: "Grade 4",
  G5: "Grade 5",
  G6: "Grade 6",
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};

export const LEVEL_GRADES: Record<CbeLevel, CbeGrade[]> = {
  pre_primary: ["PP1", "PP2"],
  lower_primary: ["G1", "G2", "G3"],
  upper_primary: ["G4", "G5", "G6"],
  junior_school: ["G7", "G8", "G9"],
  senior_school: ["G10", "G11", "G12"],
};

export const ALL_GRADES: CbeGrade[] = Object.values(LEVEL_GRADES).flat();

export const GRADE_LEVEL: Record<CbeGrade, CbeLevel> = ALL_GRADES.reduce(
  (acc, g) => {
    const level = (Object.keys(LEVEL_GRADES) as CbeLevel[]).find((l) =>
      LEVEL_GRADES[l].includes(g),
    )!;
    acc[g] = level;
    return acc;
  },
  {} as Record<CbeGrade, CbeLevel>,
);

export const SENIOR_PATHWAYS = ["STEM", "Social Sciences", "Arts and Sports Science"] as const;

/** Mark-entry behaviour differs by grade band. */
export type MarkEntryMode = "observation" | "kjsea_competency" | "kpsea_sections" | "numeric";

export function markEntryMode(grade: CbeGrade): MarkEntryMode {
  if (grade === "PP1" || grade === "PP2") return "observation";
  if (grade === "G6") return "kpsea_sections";
  if (["G1", "G2", "G3", "G4", "G5"].includes(grade)) return "kjsea_competency";
  return "numeric";
}

/** Grades 1-6 use the 8-level KJSEA achievement scale. */
export function usesKjsea(grade: CbeGrade): boolean {
  return ["G1", "G2", "G3", "G4", "G5", "G6"].includes(grade);
}

export interface KjseaLevel {
  code: "EE1" | "EE2" | "ME1" | "ME2" | "AE1" | "AE2" | "BE1" | "BE2";
  name: string;
  min: number;
  max: number;
  points: number;
  tone: "success" | "info" | "warning" | "destructive";
}

/**
 * 2025 KJSEA eight-level scale.
 * NOTE: BE2's lower bound is implemented as inclusive of 0% (published bands start
 * at 1%), because the rule states every learner earns at least one point — a raw
 * score of 0% must therefore still map to BE2 / 1 point.
 */
export const KJSEA_LEVELS: KjseaLevel[] = [
  { code: "EE1", name: "Exceeding Expectations 1", min: 90, max: 100, points: 8, tone: "success" },
  {
    code: "EE2",
    name: "Exceeding Expectations 2",
    min: 75,
    max: 89.999999,
    points: 7,
    tone: "success",
  },
  { code: "ME1", name: "Meeting Expectations 1", min: 58, max: 74.999999, points: 6, tone: "info" },
  { code: "ME2", name: "Meeting Expectations 2", min: 41, max: 57.999999, points: 5, tone: "info" },
  {
    code: "AE1",
    name: "Approaching Expectations 1",
    min: 31,
    max: 40.999999,
    points: 4,
    tone: "warning",
  },
  {
    code: "AE2",
    name: "Approaching Expectations 2",
    min: 21,
    max: 30.999999,
    points: 3,
    tone: "warning",
  },
  {
    code: "BE1",
    name: "Below Expectations 1",
    min: 11,
    max: 20.999999,
    points: 2,
    tone: "destructive",
  },
  {
    code: "BE2",
    name: "Below Expectations 2",
    min: 0,
    max: 10.999999,
    points: 1,
    tone: "destructive",
  },
];

/** Generic 4-level CBE observation descriptors (PP1-PP2 and rubric use). */
export const CBE_DESCRIPTORS = [
  { code: "EE", name: "Exceeding Expectations", tone: "success" as const },
  { code: "ME", name: "Meeting Expectations", tone: "info" as const },
  { code: "AE", name: "Approaching Expectations", tone: "warning" as const },
  { code: "BE", name: "Below Expectations", tone: "destructive" as const },
];

/**
 * Maps a percentage to a KJSEA level. Returns null for absent/exempt marks —
 * absence must NEVER be converted to 0% or a forced point value.
 */
export function kjseaLevelFor(percentage: number | null | undefined): KjseaLevel | null {
  if (percentage === null || percentage === undefined || Number.isNaN(percentage)) return null;
  const pct = Math.max(0, Math.min(100, percentage));
  return (
    KJSEA_LEVELS.find((l) => pct >= l.min && pct <= l.max) ?? KJSEA_LEVELS[KJSEA_LEVELS.length - 1]!
  );
}

export function kjseaPoints(percentage: number | null | undefined): number | null {
  return kjseaLevelFor(percentage)?.points ?? null;
}

export const CORE_COMPETENCIES = [
  "Communication and Collaboration",
  "Critical Thinking and Problem Solving",
  "Creativity and Imagination",
  "Citizenship",
  "Digital Literacy",
  "Learning to Learn",
  "Self-Efficacy",
] as const;

export const CBE_VALUES = [
  "Love",
  "Responsibility",
  "Respect",
  "Unity",
  "Peace",
  "Patriotism",
  "Integrity",
  "Social Justice",
] as const;

export const KENYAN_COUNTIES = [
  "Baringo",
  "Bomet",
  "Bungoma",
  "Busia",
  "Elgeyo-Marakwet",
  "Embu",
  "Garissa",
  "Homa Bay",
  "Isiolo",
  "Kajiado",
  "Kakamega",
  "Kericho",
  "Kiambu",
  "Kilifi",
  "Kirinyaga",
  "Kisii",
  "Kisumu",
  "Kitui",
  "Kwale",
  "Laikipia",
  "Lamu",
  "Machakos",
  "Makueni",
  "Mandera",
  "Marsabit",
  "Meru",
  "Migori",
  "Mombasa",
  "Murang'a",
  "Nairobi",
  "Nakuru",
  "Nandi",
  "Narok",
  "Nyamira",
  "Nyandarua",
  "Nyeri",
  "Samburu",
  "Siaya",
  "Taita-Taveta",
  "Tana River",
  "Tharaka-Nithi",
  "Trans Nzoia",
  "Turkana",
  "Uasin Gishu",
  "Vihiga",
  "Wajir",
  "West Pokot",
];
