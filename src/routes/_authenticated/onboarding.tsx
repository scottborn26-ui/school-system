import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarRange,
  CheckCircle2,
  Loader2,
  MapPin,
  School,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useSchool } from "@/hooks/use-school";
import {
  GRADE_LABELS,
  GRADE_LEVEL,
  KENYAN_COUNTIES,
  LEVEL_GRADES,
  LEVEL_LABELS,
  SENIOR_PATHWAYS,
  type CbeGrade,
  type CbeLevel,
} from "@/lib/cbe";
import { KE_PHONE_REGEX, normalizeKePhone } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "School onboarding · SHANSCOTT CBE" },
      {
        name: "description",
        content:
          "Guided multi-step onboarding for Kenyan CBE schools: identity, location, grades offered, academic year and preferences.",
      },
      { property: "og:title", content: "School onboarding · SHANSCOTT CBE" },
      {
        property: "og:description",
        content: "Set up your school profile, CBE grades, academic year and report preferences.",
      },
    ],
  }),
  component: OnboardingPage,
});

const STEPS = [
  { title: "School identity", icon: Building2 },
  { title: "Location & contacts", icon: MapPin },
  { title: "Grades offered", icon: School },
  { title: "Academic year", icon: CalendarRange },
  { title: "Preferences", icon: Settings2 },
];

const CURRENT_YEAR = new Date().getFullYear();

function OnboardingPage() {
  const router = useRouter();
  const school = useSchool();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: "",
    short_name: "",
    motto: "",
    category: "primary",
    ownership: "private",
    boarding_type: "day",
    gender_composition: "mixed",
    knec_centre_code: "",
    nemis_code: "",
    county: "",
    sub_county: "",
    ward: "",
    physical_address: "",
    postal_address: "",
    email: "",
    phone: "",
    website: "",
    headteacher_name: "",
    headteacher_phone: "",
    headteacher_email: "",
    admission_number_format: "ADM-{YYYY}-{SEQ:4}",
    year_name: String(CURRENT_YEAR),
    year_start: `${CURRENT_YEAR}-01-06`,
    year_end: `${CURRENT_YEAR}-11-30`,
    show_ranking: false,
    show_raw_scores: true,
    report_footer: "",
  });

  const [grades, setGrades] = useState<CbeGrade[]>([]);
  const [pathways, setPathways] = useState<string[]>([]);
  const draftKey = school.userId ? `shanscott.onboarding.${school.userId}` : null;

  useEffect(() => {
    if (!draftKey) return;
    try {
      const saved = window.localStorage.getItem(draftKey);
      if (!saved) return;
      const draft = JSON.parse(saved) as {
        form?: Partial<typeof form>;
        grades?: CbeGrade[];
        pathways?: string[];
        step?: number;
      };
      if (draft.form) setForm((current) => ({ ...current, ...draft.form }));
      if (draft.grades) setGrades(draft.grades);
      if (draft.pathways) setPathways(draft.pathways);
      if (typeof draft.step === "number")
        setStep(Math.min(Math.max(draft.step, 0), STEPS.length - 1));
    } catch {
      window.localStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) return;
    const timeout = window.setTimeout(() => {
      window.localStorage.setItem(draftKey, JSON.stringify({ form, grades, pathways, step }));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [draftKey, form, grades, pathways, step]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validateStep(current: number): boolean {
    const e: Record<string, string> = {};
    if (current === 0) {
      if (form.name.trim().length < 3) e["name"] = "Enter the official school name.";
      if (!form.category) e["category"] = "Select a school category.";
    }
    if (current === 1) {
      if (!form.county) e["county"] = "Select the county.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
        e["email"] = "Enter a valid official email.";
      if (!KE_PHONE_REGEX.test(form.phone.replace(/\s/g, "")))
        e["phone"] = "Enter a valid Kenyan phone number (e.g. 0712345678).";
      if (form.headteacher_name.trim().length < 3)
        e["headteacher_name"] = "Enter the headteacher's name.";
    }
    if (current === 2 && grades.length === 0)
      e["grades"] = "Select at least one grade your school offers.";
    if (current === 3) {
      if (!form.year_name.trim()) e["year_name"] = "Enter the academic year name.";
      if (!form.year_start || !form.year_end)
        e["year_start"] = "Provide the year start and end dates.";
      else if (form.year_end <= form.year_start)
        e["year_end"] = "The end date must be after the start date.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (!validateStep(step)) {
      toast.warning("Please correct the highlighted fields before continuing.");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function finish() {
    if (!validateStep(step)) {
      toast.warning("Please correct the highlighted fields before continuing.");
      return;
    }
    const { data: authUser } = await supabase.auth.getUser();
    const userId = authUser.user?.id;
    if (!userId) {
      toast.error("Your session expired. Please sign in again.");
      return;
    }
    setSaving(true);
    try {
      const { data: schoolId, error: schoolErr } = await supabase.rpc("create_school", {
        _school: {
          name: form.name.trim(),
          short_name: form.short_name.trim() || null,
          motto: form.motto.trim() || null,
          category: form.category,
          ownership: form.ownership,
          boarding_type: form.boarding_type,
          gender_composition: form.gender_composition,
          knec_centre_code: form.knec_centre_code.trim() || null,
          nemis_code: form.nemis_code.trim() || null,
          county: form.county,
          sub_county: form.sub_county.trim() || null,
          ward: form.ward.trim() || null,
          physical_address: form.physical_address.trim() || null,
          postal_address: form.postal_address.trim() || null,
          email: form.email.trim(),
          phone: normalizeKePhone(form.phone),
          website: form.website.trim() || null,
          headteacher_name: form.headteacher_name.trim(),
          headteacher_phone: form.headteacher_phone
            ? normalizeKePhone(form.headteacher_phone)
            : null,
          headteacher_email: form.headteacher_email.trim() || null,
          admission_number_format: form.admission_number_format.trim() || "ADM-{YYYY}-{SEQ:4}",
          onboarding_completed: true,
        },
        _year: {
          name: form.year_name.trim(),
          start_date: form.year_start,
          end_date: form.year_end,
        },
        _grades: grades.map((grade) => ({
          grade,
          level: GRADE_LEVEL[grade],
          pathway:
            GRADE_LEVEL[grade] === "senior_school" && pathways.length ? pathways.join(", ") : null,
        })),
        _settings: {
          show_ranking: form.show_ranking,
          show_raw_scores: form.show_raw_scores,
          report_footer: form.report_footer.trim() || null,
        },
      });
      if (schoolErr || !schoolId) throw schoolErr ?? new Error("School could not be created.");

      toast.success("School onboarding completed successfully.", {
        description: `${form.name} is ready with ${grades.length} grade${grades.length === 1 ? "" : "s"} and academic year ${form.year_name}.`,
      });
      if (draftKey) window.localStorage.removeItem(draftKey);
      school.refetch();
      void router.navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : (err as { message?: string })?.message;
      toast.error("School onboarding failed.", {
        description: message ?? "Your details were kept — please review them and try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  const StepIcon = STEPS[step]!.icon;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">School onboarding</h1>
        <p className="text-sm text-muted-foreground">
          Step {step + 1} of {STEPS.length} — {STEPS[step]!.title}
        </p>
        <div className="mt-4 grid grid-cols-5 gap-1.5" aria-label="Onboarding progress">
          {STEPS.map((item, index) => (
            <div key={item.title} className="space-y-1.5">
              <div
                className={`h-2 rounded-full transition-colors ${
                  index <= step ? "bg-primary" : "bg-muted"
                }`}
              />
              <p
                className={`hidden text-[11px] leading-tight sm:block ${
                  index === step ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                {index + 1}. {item.title}
              </p>
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <StepIcon className="size-5" />
            </div>
            <div>
              <CardTitle>{STEPS[step]!.title}</CardTitle>
              <CardDescription>All fields marked with * are required.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="Official school name *" error={errors["name"]}>
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Shanscott Academy"
                />
              </F>
              <F label="Short name">
                <Input
                  value={form.short_name}
                  onChange={(e) => set("short_name", e.target.value)}
                  placeholder="SHA"
                />
              </F>
              <F label="Motto" className="sm:col-span-2">
                <Input
                  value={form.motto}
                  onChange={(e) => set("motto", e.target.value)}
                  placeholder="Knowledge and Integrity"
                />
              </F>
              <F label="Category *" error={errors["category"]}>
                <Pick
                  value={form.category}
                  onChange={(v) => set("category", v)}
                  options={[
                    ["pre_primary", "Pre-Primary only"],
                    ["primary", "Primary"],
                    ["junior", "Junior School"],
                    ["senior", "Senior School"],
                    ["comprehensive", "Comprehensive (PP1–Grade 12)"],
                  ]}
                />
              </F>
              <F label="Ownership">
                <Pick
                  value={form.ownership}
                  onChange={(v) => set("ownership", v)}
                  options={[
                    ["public", "Public"],
                    ["private", "Private"],
                  ]}
                />
              </F>
              <F label="Day / boarding">
                <Pick
                  value={form.boarding_type}
                  onChange={(v) => set("boarding_type", v)}
                  options={[
                    ["day", "Day"],
                    ["boarding", "Boarding"],
                    ["mixed", "Day & Boarding"],
                  ]}
                />
              </F>
              <F label="Gender composition">
                <Pick
                  value={form.gender_composition}
                  onChange={(v) => set("gender_composition", v)}
                  options={[
                    ["mixed", "Mixed"],
                    ["boys", "Boys only"],
                    ["girls", "Girls only"],
                  ]}
                />
              </F>
              <F label="KNEC centre code">
                <Input
                  value={form.knec_centre_code}
                  onChange={(e) => set("knec_centre_code", e.target.value)}
                />
              </F>
              <F label="NEMIS / institution code">
                <Input
                  value={form.nemis_code}
                  onChange={(e) => set("nemis_code", e.target.value)}
                />
              </F>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="County *" error={errors["county"]}>
                <Pick
                  value={form.county}
                  onChange={(v) => set("county", v)}
                  options={KENYAN_COUNTIES.map((c) => [c, c])}
                  placeholder="Select county"
                />
              </F>
              <F label="Sub-county">
                <Input
                  value={form.sub_county}
                  onChange={(e) => set("sub_county", e.target.value)}
                />
              </F>
              <F label="Ward">
                <Input value={form.ward} onChange={(e) => set("ward", e.target.value)} />
              </F>
              <F label="Postal address">
                <Input
                  value={form.postal_address}
                  onChange={(e) => set("postal_address", e.target.value)}
                  placeholder="P.O. Box 1234, Nakuru"
                />
              </F>
              <F label="Physical address" className="sm:col-span-2">
                <Input
                  value={form.physical_address}
                  onChange={(e) => set("physical_address", e.target.value)}
                />
              </F>
              <F label="Official email *" error={errors["email"]}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="info@school.ac.ke"
                />
              </F>
              <F label="School phone *" error={errors["phone"]}>
                <Input
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="0712345678"
                />
              </F>
              <F label="Website">
                <Input value={form.website} onChange={(e) => set("website", e.target.value)} />
              </F>
              <F label="Headteacher / Principal name *" error={errors["headteacher_name"]}>
                <Input
                  value={form.headteacher_name}
                  onChange={(e) => set("headteacher_name", e.target.value)}
                />
              </F>
              <F label="Headteacher phone">
                <Input
                  value={form.headteacher_phone}
                  onChange={(e) => set("headteacher_phone", e.target.value)}
                  placeholder="0712345678"
                />
              </F>
              <F label="Headteacher email">
                <Input
                  type="email"
                  value={form.headteacher_email}
                  onChange={(e) => set("headteacher_email", e.target.value)}
                />
              </F>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Select only the CBE grades your school actually offers. Only these grades will
                appear in classes, admissions, assessment, timetables, fees and reports.
              </p>
              {errors["grades"] && <p className="text-sm text-destructive">{errors["grades"]}</p>}
              {(Object.keys(LEVEL_GRADES) as CbeLevel[]).map((level) => (
                <div key={level} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium">{LEVEL_LABELS[level]}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const all = LEVEL_GRADES[level];
                        const has = all.every((g) => grades.includes(g));
                        setGrades((prev) =>
                          has
                            ? prev.filter((g) => !all.includes(g))
                            : [...new Set([...prev, ...all])],
                        );
                      }}
                    >
                      {LEVEL_GRADES[level].every((g) => grades.includes(g))
                        ? "Clear level"
                        : "Select level"}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {LEVEL_GRADES[level].map((g) => (
                      <label
                        key={g}
                        className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
                      >
                        <Checkbox
                          checked={grades.includes(g)}
                          onCheckedChange={(c) =>
                            setGrades((prev) => (c ? [...prev, g] : prev.filter((x) => x !== g)))
                          }
                        />
                        {GRADE_LABELS[g]}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {grades.some((g) => GRADE_LEVEL[g] === "senior_school") && (
                <div className="rounded-lg border p-3">
                  <p className="mb-2 font-medium">Senior school pathways</p>
                  <div className="flex flex-wrap gap-3">
                    {SENIOR_PATHWAYS.map((p) => (
                      <label
                        key={p}
                        className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
                      >
                        <Checkbox
                          checked={pathways.includes(p)}
                          onCheckedChange={(c) =>
                            setPathways((prev) => (c ? [...prev, p] : prev.filter((x) => x !== p)))
                          }
                        />
                        {p}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <F label="Academic year name *" error={errors["year_name"]}>
                <Input value={form.year_name} onChange={(e) => set("year_name", e.target.value)} />
              </F>
              <F label="Admission number format">
                <Input
                  value={form.admission_number_format}
                  onChange={(e) => set("admission_number_format", e.target.value)}
                />
              </F>
              <F label="Year opening date *" error={errors["year_start"]}>
                <Input
                  type="date"
                  value={form.year_start}
                  onChange={(e) => set("year_start", e.target.value)}
                />
              </F>
              <F label="Year closing date *" error={errors["year_end"]}>
                <Input
                  type="date"
                  value={form.year_end}
                  onChange={(e) => set("year_end", e.target.value)}
                />
              </F>
              <p className="text-sm text-muted-foreground sm:col-span-2">
                Three terms will be created automatically; you can adjust their opening and closing
                dates in School Settings.
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">Show raw scores on reports</p>
                  <p className="text-sm text-muted-foreground">
                    Display percentages alongside performance descriptors.
                  </p>
                </div>
                <Switch
                  checked={form.show_raw_scores}
                  onCheckedChange={(v) => set("show_raw_scores", v)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">Internal ranking</p>
                  <p className="text-sm text-muted-foreground">
                    Positions are internal school analytics only and are off by default.
                  </p>
                </div>
                <Switch
                  checked={form.show_ranking}
                  onCheckedChange={(v) => set("show_ranking", v)}
                />
              </div>
              <F label="Report footer / branding note">
                <Textarea
                  value={form.report_footer}
                  onChange={(e) => set("report_footer", e.target.value)}
                  rows={3}
                />
              </F>
              <div className="rounded-lg border bg-secondary/40 p-3 text-sm">
                <p className="font-medium">Locked defaults</p>
                <p className="text-muted-foreground">
                  Currency KES · Timezone Africa/Nairobi · Locale en-KE · KJSEA 8-level grading
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || saving}
        >
          <ArrowLeft className="mr-2 size-4" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next}>
            Continue <ArrowRight className="ml-2 size-4" />
          </Button>
        ) : (
          <Button onClick={finish} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 size-4" /> Complete onboarding
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function F({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string | undefined;
  className?: string;
  children: React.ReactNode;
}) {
  const required = label.endsWith(" *");
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>
        {required ? label.slice(0, -2) : label}
        {!required && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
        )}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Pick({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  placeholder?: string;
}) {
  return (
    <Select value={value || ""} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder ?? "Select"} />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
