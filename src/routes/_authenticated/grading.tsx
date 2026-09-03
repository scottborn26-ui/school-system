import { createFileRoute } from "@tanstack/react-router";
import {
  Accessibility,
  BadgeCheck,
  BookOpenCheck,
  Brain,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Cloud,
  Compass,
  Fingerprint,
  HeartHandshake,
  Info,
  KeyRound,
  Laptop,
  Lightbulb,
  LockKeyhole,
  MessageCircle,
  Palette,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { RequireSchool } from "@/components/require-school";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSchool } from "@/hooks/use-school";
import {
  CBE_DESCRIPTORS,
  CBE_VALUES,
  CORE_COMPETENCIES,
  GRADE_LABELS,
  KJSEA_LEVELS,
  markEntryMode,
  type CbeGrade,
} from "@/lib/cbe";

export const Route = createFileRoute("/_authenticated/grading")({
  head: () => ({
    meta: [
      { title: "Grading scheme · SHANSCOTT CBE" },
      {
        name: "description",
        content:
          "The KJSEA 8-level achievement scale, CBE descriptors, core competencies and values used across assessment and reports.",
      },
      { property: "og:title", content: "Grading scheme · SHANSCOTT CBE" },
      {
        property: "og:description",
        content: "KJSEA 8-level scale (EE1–BE2), competencies and values used in CBE reporting.",
      },
    ],
  }),
  component: () => (
    <RequireSchool roles={["principal", "deputy", "teacher", "class_teacher"]}>
      <GradingPage />
    </RequireSchool>
  ),
});

const MODE_LABELS: Record<string, string> = {
  observation: "Observation checklist (descriptors only)",
  kpsea_sections: "KPSEA-style section scoring",
  kjsea_competency: "KJSEA competency scoring (8-level scale)",
  numeric: "Numeric scoring with performance level",
};

const MODE_STYLES: Record<string, { label: string; className: string }> = {
  observation: { label: "Observation", className: "border-l-amber-400 bg-amber-50/60" },
  kjsea_competency: { label: "KJSEA competency", className: "border-l-sky-500 bg-sky-50/60" },
  kpsea_sections: { label: "KPSEA sections", className: "border-l-violet-500 bg-violet-50/60" },
  numeric: { label: "Numeric scoring", className: "border-l-emerald-500 bg-emerald-50/60" },
};

const COMPETENCY_ICONS = [
  MessageCircle,
  Brain,
  Lightbulb,
  Users,
  Laptop,
  BookOpenCheck,
  ShieldCheck,
  HeartHandshake,
] as const;

const COMPETENCIES = [...CORE_COMPETENCIES, "Values"] as const;

const VALUE_ICONS = [
  HeartHandshake,
  CheckCircle2,
  Scale,
  Users,
  Cloud,
  Compass,
  Fingerprint,
  Accessibility,
] as const;

function GradingPage() {
  const school = useSchool();
  const offeredGrades = school.grades;

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-8">
      <header className="border-b border-border/70 pb-6">
        <div className="flex items-start gap-3">
          <div className="mt-1 grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <BookOpenCheck className="size-5" />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Assessment reference
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Grading scheme</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Assessment follows the Kenyan Competency Based Education framework. The KJSEA
              achievement scale is locked so reports remain comparable across terms and schools.{" "}
              <LockKeyhole className="mb-0.5 ml-1 inline size-3.5" aria-label="Locked" />
            </p>
          </div>
        </div>
      </header>

      <Card className="overflow-hidden border-slate-200/80 bg-slate-50/45 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:shadow-none">
        <CardHeader className="border-b border-border/70 pb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">KJSEA achievement scale</CardTitle>
              <CardDescription className="mt-1 max-w-2xl">
                Eight performance levels from Exceeding Expectation to Below Expectation, each
                carrying achievement points.
              </CardDescription>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 dark:border-slate-600 dark:bg-slate-950/70 dark:text-slate-300">
              <LockKeyhole className="size-3.5" /> Locked reference
            </span>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-slate-100/80 text-left text-[0.68rem] uppercase tracking-[0.14em] text-slate-500 dark:bg-background/70 dark:text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-semibold">Level</th>
                <th className="px-4 py-3 font-semibold">Descriptor</th>
                <th className="px-4 py-3 font-semibold">Score range</th>
                <th className="px-6 py-3 text-right font-semibold">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-border/60">
              {KJSEA_LEVELS.map((l) => (
                <tr
                  key={l.code}
                  className="bg-white/55 transition-colors hover:bg-white dark:bg-card/35 dark:hover:bg-card"
                >
                  <td className="px-6 py-3.5">
                    <span
                      className={`inline-flex min-w-11 justify-center rounded-md px-2 py-1 text-xs font-bold tracking-wide ${
                        l.code.startsWith("EE")
                          ? "bg-emerald-100 text-emerald-800"
                          : l.code.startsWith("ME")
                            ? "bg-sky-100 text-sky-800"
                            : l.code.startsWith("AE")
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {l.code}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-medium text-slate-700 dark:text-foreground">
                    {l.name}
                  </td>
                  <td className="px-4 py-3.5 text-slate-500 dark:text-muted-foreground">
                    {Math.round(l.min)}% – {Math.round(l.max)}%
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <span className="ml-auto grid size-7 place-items-center rounded-full bg-slate-100 font-bold text-slate-700 dark:bg-background dark:text-foreground">
                      {l.points}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="flex items-start gap-2 px-6 py-4 text-xs leading-5 text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" /> Every learner who sits an
            assessment earns at least one achievement point, in line with national reporting
            practice.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Mark entry mode by grade</CardTitle>
          <CardDescription>
            How teachers record achievement for each grade you offer.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {offeredGrades.map((g) => {
            const mode = markEntryMode(g as CbeGrade);
            const style = MODE_STYLES[mode] ?? MODE_STYLES.numeric;
            return (
              <div
                key={g}
                className={`flex min-h-[66px] flex-col justify-center gap-1 rounded-lg border border-border/70 border-l-4 px-4 py-2.5 ${style.className}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-800 dark:text-foreground">
                    {GRADE_LABELS[g as CbeGrade]}
                  </span>
                  <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
                    {style.label}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{MODE_LABELS[mode]}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-7 lg:grid-cols-2">
        <ReferenceCard
          title="General CBE descriptors"
          description="Used for pre-primary and lower primary observation reporting."
        >
          <div className="flex flex-wrap gap-2">
            {CBE_DESCRIPTORS.map((d) => (
              <span
                key={d.code}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${tierClass(d.code)}`}
              >
                {d.code} <span className="font-normal opacity-80">— {d.name}</span>
              </span>
            ))}
          </div>
        </ReferenceCard>
        <ReferenceCard
          title="Core competencies"
          description="Reported per learner alongside learning-area achievement."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {COMPETENCIES.map((c, i) => {
              const Icon = COMPETENCY_ICONS[i];
              return (
                <div
                  key={c}
                  className="flex items-center gap-2.5 rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 py-2.5 text-xs font-medium text-slate-700 dark:border-border/70 dark:bg-background/60 dark:text-foreground"
                >
                  <Icon className="size-4 shrink-0 text-primary" />
                  {c}
                </div>
              );
            })}
          </div>
        </ReferenceCard>
        <ReferenceCard
          title="Values"
          description="National CBE values assessed through observation."
        >
          <div className="flex flex-wrap gap-2">
            {CBE_VALUES.map((v, i) => {
              const Icon = VALUE_ICONS[i];
              return (
                <span
                  key={v}
                  className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800"
                >
                  <Icon className="size-3.5" />
                  {v}
                </span>
              );
            })}
          </div>
        </ReferenceCard>
      </div>
    </div>
  );
}

function ReferenceCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function tierClass(code: string) {
  if (code.startsWith("EE")) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (code.startsWith("ME")) return "border-sky-200 bg-sky-50 text-sky-800";
  if (code.startsWith("AE")) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-rose-200 bg-rose-50 text-rose-800";
}
