export type GradeBand = "EE" | "ME" | "AE" | "BE";

export type CompetencyCode = "EE1" | "EE2" | "ME1" | "ME2" | "AE1" | "AE2" | "BE1" | "BE2";

export interface GradeLevel {
  code: CompetencyCode;
  descriptor:
    | "Exceptional"
    | "Very Good"
    | "Good"
    | "Fair"
    | "Needs Improvement"
    | "Below Average"
    | "Well Below Average"
    | "Minimal";
  points: 8 | 7 | 6 | 5 | 4 | 3 | 2 | 1;
  band: GradeBand;
  min: number;
  max: number;
  scoreRange: string;
}

export const GRADE_BAND_META: Record<
  GradeBand,
  { label: string; description: string; accent: string; soft: string }
> = {
  EE: {
    label: "EE",
    description: "Exceeding Expectation",
    accent: "#136c42",
    soft: "rgba(19, 108, 66, 0.12)",
  },
  ME: {
    label: "ME",
    description: "Meeting Expectation",
    accent: "#1d4ed8",
    soft: "rgba(29, 78, 216, 0.12)",
  },
  AE: {
    label: "AE",
    description: "Approaching Expectation",
    accent: "#d97706",
    soft: "rgba(217, 119, 6, 0.12)",
  },
  BE: {
    label: "BE",
    description: "Below Expectation",
    accent: "#7c2d12",
    soft: "rgba(124, 45, 18, 0.12)",
  },
};

export const COMPETENCY_LEVELS: GradeLevel[] = [
  {
    code: "EE1",
    descriptor: "Exceptional",
    points: 8,
    band: "EE",
    min: 90,
    max: 100,
    scoreRange: "90–100%",
  },
  {
    code: "EE2",
    descriptor: "Very Good",
    points: 7,
    band: "EE",
    min: 75,
    max: 89.999999,
    scoreRange: "75–89%",
  },
  {
    code: "ME1",
    descriptor: "Good",
    points: 6,
    band: "ME",
    min: 58,
    max: 74.999999,
    scoreRange: "58–74%",
  },
  {
    code: "ME2",
    descriptor: "Fair",
    points: 5,
    band: "ME",
    min: 41,
    max: 57.999999,
    scoreRange: "41–57%",
  },
  {
    code: "AE1",
    descriptor: "Needs Improvement",
    points: 4,
    band: "AE",
    min: 31,
    max: 40.999999,
    scoreRange: "31–40%",
  },
  {
    code: "AE2",
    descriptor: "Below Average",
    points: 3,
    band: "AE",
    min: 21,
    max: 30.999999,
    scoreRange: "21–30%",
  },
  {
    code: "BE1",
    descriptor: "Well Below Average",
    points: 2,
    band: "BE",
    min: 11,
    max: 20.999999,
    scoreRange: "11–20%",
  },
  {
    code: "BE2",
    descriptor: "Minimal",
    points: 1,
    band: "BE",
    min: 0,
    max: 10.999999,
    scoreRange: "1–10%",
  },
];

export function getGradeLevel(score: number | null | undefined): GradeLevel | null {
  if (score === null || score === undefined || Number.isNaN(score)) return null;
  const clamped = Math.max(0, Math.min(100, Number(score)));
  return (
    COMPETENCY_LEVELS.find((level) => clamped >= level.min && clamped <= level.max) ??
    COMPETENCY_LEVELS[COMPETENCY_LEVELS.length - 1]!
  );
}

export function normalizeCompetencyCode(
  rawCode: string | null | undefined,
  score?: number | null,
): CompetencyCode | null {
  if (!rawCode) {
    const level = score == null ? null : getGradeLevel(score);
    return level?.code ?? null;
  }

  const key = rawCode.trim().toUpperCase();
  if (key === "EE" || key === "ME" || key === "AE" || key === "BE") {
    const level = getGradeLevel(score ?? 0);
    return level && level.band === key ? level.code : null;
  }

  if (["EE1", "EE2", "ME1", "ME2", "AE1", "AE2", "BE1", "BE2"].includes(key)) {
    return key as CompetencyCode;
  }

  if (score != null) {
    const level = getGradeLevel(score);
    return level?.code ?? null;
  }

  return null;
}

export function formatGradeSummary(score: number | null | undefined): string {
  const level = getGradeLevel(score);
  if (!level) return "—";
  const percentage = typeof score === "number" ? score : 0;
  return `${Number.isInteger(percentage) ? percentage.toFixed(0) : percentage.toFixed(1)}% · ${level.code} · ${level.descriptor} · ${level.points} pts`;
}
