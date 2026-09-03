import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  BookOpen,
  CalendarPlus,
  CalendarRange,
  Check,
  ChevronDown,
  CircleAlert,
  Coffee,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { RequireSchool } from "@/components/require-school";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useSchool } from "@/hooks/use-school";
import {
  GRADE_LABELS,
  GRADE_LEVEL,
  KENYAN_COUNTIES,
  LEVEL_GRADES,
  LEVEL_LABELS,
  type CbeGrade,
  type CbeLevel,
} from "@/lib/cbe";
import { formatDate, KE_PHONE_REGEX, normalizeKePhone } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "School settings · SHANSCOTT CBE" },
      {
        name: "description",
        content:
          "Manage school profile, CBE grade offerings, academic terms and report preferences for your school.",
      },
      { property: "og:title", content: "School settings · SHANSCOTT CBE" },
      {
        property: "og:description",
        content: "School profile, grade offerings, term dates and reporting preferences.",
      },
    ],
  }),
  component: () => (
    <RequireSchool roles={["principal", "deputy"]}>
      <SettingsPage />
    </RequireSchool>
  ),
});

function SettingsPage() {
  const school = useSchool();
  const schoolId = school.schoolId!;
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["school-settings", schoolId],
    queryFn: async () => {
      const [profile, settings, offerings, terms, events] = await Promise.all([
        supabase.from("schools").select("*").eq("id", schoolId).maybeSingle(),
        supabase.from("school_settings").select("*").eq("school_id", schoolId).maybeSingle(),
        supabase
          .from("school_grade_offerings")
          .select("id, grade, is_active")
          .eq("school_id", schoolId),
        supabase
          .from("terms")
          .select(
            "id, name, term_number, opening_date, closing_date, midterm_start_date, midterm_end_date, is_current, academic_year_id",
          )
          .eq("school_id", schoolId)
          .order("term_number"),
        supabase
          .from("academic_calendar_events")
          .select("id, title, event_type, start_date, end_date, notes, all_day, image_url, academic_year_id")
          .eq("school_id", schoolId)
          .order("start_date"),
      ]);
      return {
        profile: profile.data,
        settings: settings.data,
        offerings: offerings.data ?? [],
        terms: terms.data ?? [],
        events: events.data ?? [],
      };
    },
  });

  return (
    <div className="settings-page space-y-5">
      <div className="settings-page-header">
        <h1 className="text-2xl font-semibold tracking-tight">School settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your school&apos;s academic structure, calendar, reporting preferences, and
          other settings.
        </p>
        <div className="settings-notice">
          <CircleAlert aria-hidden="true" />
          <span>
            Changes made here may affect admissions, assessments, timetables, student records, and
            reports across the school.
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading school settings…
        </div>
      ) : (
        <Tabs defaultValue="calendar">
          <TabsList className="settings-tabs-list">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="grades">Grades Offered</TabsTrigger>
            <TabsTrigger value="calendar">Academic Calendar</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="staff-attendance">Staff Attendance</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4">
            <ProfileTab
              schoolId={schoolId}
              profile={data?.profile}
              onSaved={() => {
                void qc.invalidateQueries({ queryKey: ["school-settings", schoolId] });
                school.refetch();
              }}
            />
          </TabsContent>

          <TabsContent value="grades" className="mt-4">
            <GradesTab
              schoolId={schoolId}
              offerings={data?.offerings ?? []}
              onSaved={() => {
                void qc.invalidateQueries({ queryKey: ["school-settings", schoolId] });
                school.refetch();
              }}
            />
          </TabsContent>

          <TabsContent value="calendar" className="settings-calendar-tab mt-4">
            <CalendarTab
              schoolId={schoolId}
              terms={data?.terms ?? []}
              events={data?.events ?? []}
              onSaved={() => void qc.invalidateQueries({ queryKey: ["school-settings", schoolId] })}
            />
          </TabsContent>

          <TabsContent value="reports" className="mt-4">
            <ReportsTab
              schoolId={schoolId}
              settings={data?.settings}
              onSaved={() => void qc.invalidateQueries({ queryKey: ["school-settings", schoolId] })}
            />
          </TabsContent>

          <TabsContent value="staff-attendance" className="mt-4">
            <StaffAttendanceSettingsTab
              schoolId={schoolId}
              settings={data?.settings}
              onSaved={() => void qc.invalidateQueries({ queryKey: ["school-settings", schoolId] })}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function StaffAttendanceSettingsTab({
  schoolId,
  settings,
  onSaved,
}: {
  schoolId: string;
  settings: Record<string, unknown> | null | undefined;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ enabled: true, start: "08:00", grace: "15", requireReason: false });
  useEffect(() => {
    if (!settings) return;
    setForm({
      enabled: settings.staff_attendance_enabled !== false,
      start: String(settings.staff_attendance_start_time ?? "08:00").slice(0, 5),
      grace: String(settings.staff_attendance_grace_minutes ?? 15),
      requireReason: settings.staff_attendance_require_late_reason === true,
    });
  }, [settings]);
  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("school_settings").update({
        staff_attendance_enabled: form.enabled,
        staff_attendance_start_time: form.start,
        staff_attendance_grace_minutes: Math.max(0, Number(form.grace) || 0),
        staff_attendance_require_late_reason: form.requireReason,
      }).eq("school_id", schoolId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Staff attendance settings saved."); onSaved(); },
    onError: () => toast.error("Staff attendance settings could not be saved."),
  });
  return <Card className="card-accent-operations"><CardHeader><CardTitle>Staff attendance policy</CardTitle><CardDescription>Set the school arrival window used by live clock-in records.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><label className="flex items-center gap-3 sm:col-span-2"><Switch checked={form.enabled} onCheckedChange={(enabled) => setForm({ ...form, enabled })} /><span className="text-sm font-medium">Enable staff attendance clocking</span></label><label className="space-y-2 text-sm"><span className="font-medium">Official start time</span><Input type="time" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} /></label><label className="space-y-2 text-sm"><span className="font-medium">Grace period (minutes)</span><Input type="number" min="0" value={form.grace} onChange={(event) => setForm({ ...form, grace: event.target.value })} /></label><label className="flex items-center gap-3 self-end text-sm"><Checkbox checked={form.requireReason} onCheckedChange={(checked) => setForm({ ...form, requireReason: checked === true })} /><span>Require a reason for late clock-in</span></label><div className="sm:col-span-2"><Button onClick={() => mutation.mutate()} disabled={mutation.isPending}><Save className="mr-2 size-4" />Save attendance policy</Button></div></CardContent></Card>;
}

/* ---------------------------------- profile --------------------------------- */

function ProfileTab({
  schoolId,
  profile,
  onSaved,
}: {
  schoolId: string;
  profile: Record<string, unknown> | null | undefined;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    short_name: "",
    motto: "",
    category: "",
    ownership: "",
    boarding_type: "",
    gender_composition: "",
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
    knec_centre_code: "",
    nemis_code: "",
    admission_number_format: "",
    logo_url: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");

  useEffect(() => {
    if (!profile) return;
    const p = profile as Record<string, string | null>;
    setForm({
      name: p["name"] ?? "",
      short_name: p["short_name"] ?? "",
      motto: p["motto"] ?? "",
      category: p["category"] ?? "",
      ownership: p["ownership"] ?? "",
      boarding_type: p["boarding_type"] ?? "",
      gender_composition: p["gender_composition"] ?? "",
      county: p["county"] ?? "",
      sub_county: p["sub_county"] ?? "",
      ward: p["ward"] ?? "",
      physical_address: p["physical_address"] ?? "",
      postal_address: p["postal_address"] ?? "",
      email: p["email"] ?? "",
      phone: p["phone"] ?? "",
      website: p["website"] ?? "",
      headteacher_name: p["headteacher_name"] ?? "",
      headteacher_phone: p["headteacher_phone"] ?? "",
      headteacher_email: p["headteacher_email"] ?? "",
      knec_centre_code: p["knec_centre_code"] ?? "",
      nemis_code: p["nemis_code"] ?? "",
      admission_number_format: p["admission_number_format"] ?? "",
      logo_url: p["logo_url"] ?? "",
    });
    setLogoPreview(p["logo_url"] ?? "");
    setLogoFile(null);
  }, [profile]);

  const mutation = useMutation({
    mutationFn: async () => {
      let logoUrl = form.logo_url;
      if (logoFile) {
        const extension = logoFile.name.split(".").pop()?.toLowerCase() || "png";
        const path = `${schoolId}/logo-${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("school-assets")
          .upload(path, logoFile, {
            upsert: true,
            contentType: logoFile.type,
          });
        if (uploadError) throw uploadError;
        logoUrl = supabase.storage.from("school-assets").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase
        .from("schools")
        .update({
          name: form.name.trim(),
          short_name: form.short_name.trim() || null,
          motto: form.motto.trim() || null,
          category: form.category || null,
          ownership: form.ownership || null,
          boarding_type: form.boarding_type || null,
          gender_composition: form.gender_composition || null,
          county: form.county || null,
          sub_county: form.sub_county.trim() || null,
          ward: form.ward.trim() || null,
          physical_address: form.physical_address.trim() || null,
          postal_address: form.postal_address.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone ? normalizeKePhone(form.phone) : null,
          website: form.website.trim() || null,
          headteacher_name: form.headteacher_name.trim() || null,
          headteacher_phone: form.headteacher_phone
            ? normalizeKePhone(form.headteacher_phone)
            : null,
          headteacher_email: form.headteacher_email.trim() || null,
          knec_centre_code: form.knec_centre_code.trim() || null,
          nemis_code: form.nemis_code.trim() || null,
          admission_number_format: form.admission_number_format.trim() || "ADM-{YYYY}-{SEQ:4}",
          logo_url: logoUrl || null,
        })
        .eq("id", schoolId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("School profile updated successfully.");
      onSaved();
    },
    onError: () => toast.error("The school profile could not be updated."),
  });

  function submit() {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 3) e["name"] = "Enter the official school name.";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      e["email"] = "Enter a valid email address.";
    if (form.phone && !KE_PHONE_REGEX.test(form.phone.replace(/\s/g, "")))
      e["phone"] = "Enter a valid Kenyan phone number.";
    setErrors(e);
    if (Object.keys(e).length) {
      toast.warning("Please correct the highlighted fields.");
      return;
    }
    mutation.mutate();
  }

  return (
    <Card className="card-accent-operations">
      <CardHeader>
        <CardTitle>School profile</CardTitle>
        <CardDescription>
          These details appear on report cards, invoices and official documents.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-primary/25 bg-primary/[0.03] p-4 sm:flex-row sm:items-center">
          <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border bg-card shadow-sm">
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="School logo preview"
                className="size-full object-contain p-2"
              />
            ) : (
              <ImagePlus className="size-7 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">School logo</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload a square PNG, JPG or WEBP logo. It will appear on report cards and official
              documents.
            </p>
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent">
              <ImagePlus className="size-4" /> Choose image
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) {
                    toast.warning("Please choose an image smaller than 2 MB.");
                    return;
                  }
                  setLogoFile(file);
                  setLogoPreview(URL.createObjectURL(file));
                }}
              />
            </label>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="School name *" error={errors["name"]}>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label="Short name">
            <Input
              value={form.short_name}
              onChange={(e) => setForm((f) => ({ ...f, short_name: e.target.value }))}
            />
          </Field>
          <Field label="Motto" className="sm:col-span-2">
            <Input
              value={form.motto}
              onChange={(e) => setForm((f) => ({ ...f, motto: e.target.value }))}
            />
          </Field>
          <Field label="Category">
            <Select
              value={form.category}
              onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pre_primary">Pre-Primary only</SelectItem>
                <SelectItem value="primary">Primary</SelectItem>
                <SelectItem value="junior">Junior School</SelectItem>
                <SelectItem value="senior">Senior School</SelectItem>
                <SelectItem value="comprehensive">Comprehensive (PP1–Grade 12)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Ownership">
            <Select
              value={form.ownership}
              onValueChange={(v) => setForm((f) => ({ ...f, ownership: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select ownership" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Day / boarding">
            <Select
              value={form.boarding_type}
              onValueChange={(v) => setForm((f) => ({ ...f, boarding_type: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select arrangement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="boarding">Boarding</SelectItem>
                <SelectItem value="mixed">Day &amp; Boarding</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Gender composition">
            <Select
              value={form.gender_composition}
              onValueChange={(v) => setForm((f) => ({ ...f, gender_composition: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select composition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mixed">Mixed</SelectItem>
                <SelectItem value="boys">Boys only</SelectItem>
                <SelectItem value="girls">Girls only</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="County">
            <Select
              value={form.county}
              onValueChange={(v) => setForm((f) => ({ ...f, county: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select county" />
              </SelectTrigger>
              <SelectContent>
                {KENYAN_COUNTIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Ward">
            <Input
              value={form.ward}
              onChange={(e) => setForm((f) => ({ ...f, ward: e.target.value }))}
            />
          </Field>
          <Field label="Sub-county">
            <Input
              value={form.sub_county}
              onChange={(e) => setForm((f) => ({ ...f, sub_county: e.target.value }))}
            />
          </Field>
          <Field label="Physical address">
            <Input
              value={form.physical_address}
              onChange={(e) => setForm((f) => ({ ...f, physical_address: e.target.value }))}
            />
          </Field>
          <Field label="Postal address">
            <Input
              value={form.postal_address}
              onChange={(e) => setForm((f) => ({ ...f, postal_address: e.target.value }))}
            />
          </Field>
          <Field label="Official email" error={errors["email"]}>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </Field>
          <Field label="School phone" error={errors["phone"]}>
            <Input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </Field>
          <Field label="Website">
            <Input
              value={form.website}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            />
          </Field>
          <Field label="Headteacher / Principal">
            <Input
              value={form.headteacher_name}
              onChange={(e) => setForm((f) => ({ ...f, headteacher_name: e.target.value }))}
            />
          </Field>
          <Field label="Headteacher phone">
            <Input
              value={form.headteacher_phone}
              onChange={(e) => setForm((f) => ({ ...f, headteacher_phone: e.target.value }))}
            />
          </Field>
          <Field label="Headteacher email">
            <Input
              type="email"
              value={form.headteacher_email}
              onChange={(e) => setForm((f) => ({ ...f, headteacher_email: e.target.value }))}
            />
          </Field>
          <Field label="KNEC centre code">
            <Input
              value={form.knec_centre_code}
              onChange={(e) => setForm((f) => ({ ...f, knec_centre_code: e.target.value }))}
            />
          </Field>
          <Field label="NEMIS code">
            <Input
              value={form.nemis_code}
              onChange={(e) => setForm((f) => ({ ...f, nemis_code: e.target.value }))}
            />
          </Field>
          <Field label="Admission number format">
            <Input
              value={form.admission_number_format}
              onChange={(e) => setForm((f) => ({ ...f, admission_number_format: e.target.value }))}
            />
          </Field>
        </div>
        <Button onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Save className="mr-2 size-4" /> Save profile
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ---------------------------------- grades --------------------------------- */

function GradesTab({
  schoolId,
  offerings,
  onSaved,
}: {
  schoolId: string;
  offerings: { id: string; grade: string; is_active: boolean }[];
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<CbeGrade[]>([]);

  useEffect(() => {
    setSelected(offerings.filter((o) => o.is_active).map((o) => o.grade as CbeGrade));
  }, [offerings]);

  const mutation = useMutation({
    mutationFn: async () => {
      const existing = new Map(offerings.map((o) => [o.grade, o]));
      const toAdd = selected.filter((g) => !existing.has(g));
      const toDeactivate = offerings.filter(
        (o) => o.is_active && !selected.includes(o.grade as CbeGrade),
      );
      const toReactivate = offerings.filter(
        (o) => !o.is_active && selected.includes(o.grade as CbeGrade),
      );

      if (toAdd.length) {
        const { error } = await supabase
          .from("school_grade_offerings")
          .insert(toAdd.map((g) => ({ school_id: schoolId, grade: g, level: GRADE_LEVEL[g] })));
        if (error) throw error;
      }
      for (const row of toDeactivate) {
        const { error } = await supabase
          .from("school_grade_offerings")
          .update({ is_active: false })
          .eq("school_id", schoolId)
          .eq("id", row.id);
        if (error) throw error;
      }
      for (const row of toReactivate) {
        const { error } = await supabase
          .from("school_grade_offerings")
          .update({ is_active: true })
          .eq("school_id", schoolId)
          .eq("id", row.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Grade offerings updated successfully.");
      onSaved();
    },
    onError: (error: Error) =>
      toast.error("Grade offerings could not be updated.", { description: error.message }),
  });

  return (
    <Card className="card-accent-academic">
      <CardHeader>
        <CardTitle>Grades offered</CardTitle>
        <CardDescription>
          Deactivating a grade hides it from new admissions and class creation; existing records are
          preserved.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(Object.keys(LEVEL_GRADES) as CbeLevel[]).map((level) => (
          <div key={level} className="rounded-lg border p-3">
            <p className="mb-2 font-medium">{LEVEL_LABELS[level]}</p>
            <div className="flex flex-wrap gap-3">
              {LEVEL_GRADES[level].map((g) => (
                <label
                  key={g}
                  className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={selected.includes(g)}
                    onCheckedChange={(c) =>
                      setSelected((prev) => (c ? [...prev, g] : prev.filter((x) => x !== g)))
                    }
                  />
                  {GRADE_LABELS[g]}
                </label>
              ))}
            </div>
          </div>
        ))}
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Save className="mr-2 size-4" /> Save grades
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

/* --------------------------------- calendar -------------------------------- */

interface TermRow {
  id: string;
  name: string;
  term_number: number;
  opening_date: string | null;
  closing_date: string | null;
  midterm_start_date: string | null;
  midterm_end_date: string | null;
  is_current: boolean;
  academic_year_id: string;
}

interface CalendarEventRow {
  id: string;
  title: string;
  event_type: string;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  image_url: string | null;
  academic_year_id: string;
}

function CalendarTab({
  schoolId,
  terms,
  events,
  onSaved,
}: {
  schoolId: string;
  terms: TermRow[];
  events: CalendarEventRow[];
  onSaved: () => void;
}) {
  const school = useSchool();
  const yearTerms = terms.filter((t) => t.academic_year_id === school.academicYearId);
  const yearEvents = events.filter((event) => event.academic_year_id === school.academicYearId);
  const [draft, setDraft] = useState<
    Record<
      string,
      {
        opening_date: string;
        closing_date: string;
        midterm_start_date: string;
        midterm_end_date: string;
      }
    >
  >({});
  const [eventForm, setEventForm] = useState({
    title: "",
    event_type: "other",
    start_date: "",
    end_date: "",
    notes: "",
    image: null as File | null,
  });
  const [collapsedTerms, setCollapsedTerms] = useState<Record<string, boolean>>({});
  const [termToSetCurrent, setTermToSetCurrent] = useState<TermRow | null>(null);

  useEffect(() => {
    setDraft(
      Object.fromEntries(
        yearTerms.map((t) => [
          t.id,
          {
            opening_date: t.opening_date ?? "",
            closing_date: t.closing_date ?? "",
            midterm_start_date: t.midterm_start_date ?? "",
            midterm_end_date: t.midterm_end_date ?? "",
          },
        ]),
      ),
    );
    setCollapsedTerms(
      Object.fromEntries(
        yearTerms.map((term) => [term.id, !(term.is_current || term.term_number === 1)]),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terms, school.academicYearId]);

  const mutation = useMutation({
    mutationFn: async (termId: string) => {
      const row = draft[termId];
      if (!row) return;
      if (row.opening_date && row.closing_date && row.closing_date <= row.opening_date) {
        throw new Error("closing-before-opening");
      }
      if (
        row.midterm_start_date &&
        row.midterm_end_date &&
        row.midterm_end_date < row.midterm_start_date
      ) {
        throw new Error("midterm-before-start");
      }
      if (row.opening_date && row.midterm_start_date && row.midterm_start_date < row.opening_date) {
        throw new Error("midterm-outside-term");
      }
      if (row.closing_date && row.midterm_end_date && row.midterm_end_date > row.closing_date) {
        throw new Error("midterm-outside-term");
      }
      const { error } = await supabase
        .from("terms")
        .update({
          opening_date: row.opening_date || null,
          closing_date: row.closing_date || null,
          midterm_start_date: row.midterm_start_date || null,
          midterm_end_date: row.midterm_end_date || null,
        })
        .eq("id", termId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Term dates updated successfully.");
      onSaved();
    },
    onError: (err: Error) =>
      toast.error(
        err.message === "closing-before-opening"
          ? "The closing date must be after the opening date."
          : err.message === "midterm-before-start"
            ? "The mid-term end date must be after its start date."
            : err.message === "midterm-outside-term"
              ? "Mid-term dates must fall within the term dates."
              : "Term dates could not be updated.",
      ),
  });

  const setCurrent = useMutation({
    mutationFn: async (termId: string) => {
      for (const t of yearTerms) {
        const { error } = await supabase
          .from("terms")
          .update({ is_current: t.id === termId })
          .eq("id", t.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Current term updated successfully.");
      school.refetch();
      onSaved();
    },
    onError: () => toast.error("The current term could not be updated."),
  });

  const eventMutation = useMutation({
    mutationFn: async () => {
      if (!eventForm.title.trim() || !eventForm.start_date) throw new Error("missing-event");
      if (eventForm.end_date && eventForm.end_date < eventForm.start_date)
        throw new Error("event-date-order");
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || !school.academicYearId) throw new Error("session");
      let imageUrl: string | null = null;
      if (eventForm.image) {
        const extension = eventForm.image.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${schoolId}/events/${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("school-assets")
          .upload(path, eventForm.image, { upsert: true, contentType: eventForm.image.type });
        if (uploadError) throw uploadError;
        imageUrl = supabase.storage.from("school-assets").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("academic_calendar_events").insert({
        school_id: schoolId,
        academic_year_id: school.academicYearId,
        title: eventForm.title.trim(),
        event_type: eventForm.event_type,
        start_date: eventForm.start_date,
        end_date: eventForm.end_date || null,
        notes: eventForm.notes.trim() || null,
        image_url: imageUrl,
        created_by: auth.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setEventForm({ title: "", event_type: "other", start_date: "", end_date: "", notes: "", image: null });
      toast.success("Calendar event added.");
      onSaved();
    },
    onError: (err: Error) =>
      toast.error(
        err.message === "missing-event"
          ? "Enter an event title and start date."
          : err.message === "event-date-order"
            ? "The event end date must be after its start date."
            : "Calendar event could not be added.",
      ),
  });
  const deleteEvent = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.from("academic_calendar_events").delete().eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Calendar event removed.");
      onSaved();
    },
    onError: () => toast.error("Calendar event could not be removed."),
  });

  return (
    <Card className="calendar-shell card-accent-attendance">
      <CardHeader className="calendar-header settings-calendar-header">
        <div className="calendar-heading-row">
          <div>
            <p className="calendar-eyebrow">ACADEMIC CALENDAR</p>
            <CardTitle>School Year Planner</CardTitle>
            <CardDescription>
              Set term dates, mid-term breaks, and define the active academic term for the selected
              school year.
            </CardDescription>
          </div>
          <div className="calendar-year-control">
            <CalendarRange aria-hidden="true" />
            <Label htmlFor="calendar-year" className="sr-only">
              Academic year
            </Label>
            <Select value={school.academicYearId ?? ""} onValueChange={school.setAcademicYearId}>
              <SelectTrigger
                id="calendar-year"
                aria-label="Academic year"
                className="calendar-year-select"
              >
                <SelectValue placeholder="Academic year" />
              </SelectTrigger>
              <SelectContent>
                {school.years.map((year) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="calendar-content settings-calendar-content space-y-5">
        {yearTerms.length === 0 && (
          <div className="calendar-empty-state">
            <CalendarRange aria-hidden="true" />
            <p>No terms found for this academic year.</p>
            <span>Set up the academic year terms to start planning your school calendar.</span>
          </div>
        )}
        {yearTerms.map((t) => (
          <div
            key={t.id}
            className={`calendar-term-card ${t.is_current ? "calendar-term-current" : ""}`}
          >
            <button
              type="button"
              className="calendar-term-heading"
              aria-expanded={!collapsedTerms[t.id]}
              onClick={() =>
                setCollapsedTerms((current) => ({ ...current, [t.id]: !current[t.id] }))
              }
            >
              <div className="calendar-term-number">{String(t.term_number).padStart(2, "0")}</div>
              <div className="calendar-term-heading-copy">
                <p className="font-medium">
                  {t.name}{" "}
                  {t.is_current && (
                    <Badge className="calendar-current-badge ml-2">Current term</Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.opening_date
                    ? `${formatDate(t.opening_date)} – ${formatDate(t.closing_date)}`
                    : "Dates not set"}
                </p>
              </div>
              <ChevronDown className="calendar-term-chevron" aria-hidden="true" />
            </button>
            {!collapsedTerms[t.id] && (
              <>
                <div className="calendar-date-group calendar-term-dates-group">
                  <div className="calendar-section-heading">
                    <span className="calendar-section-icon">
                      <BookOpen aria-hidden="true" />
                    </span>
                    <div>
                      <span className="calendar-date-group-label">TERM DATES</span>
                      <p className="calendar-group-description">When the term opens and closes.</p>
                    </div>
                  </div>
                  <div className="calendar-date-fields">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Opening date</Label>
                      <Input
                        type="date"
                        value={draft[t.id]?.opening_date ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            [t.id]: {
                              ...d[t.id],
                              closing_date: d[t.id]?.closing_date ?? "",
                              opening_date: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Closing date</Label>
                      <Input
                        type="date"
                        value={draft[t.id]?.closing_date ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            [t.id]: {
                              ...d[t.id],
                              opening_date: d[t.id]?.opening_date ?? "",
                              closing_date: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
                <div className="calendar-date-group calendar-midterm-group calendar-midterm-dates-group">
                  <div className="calendar-section-heading">
                    <span className="calendar-section-icon">
                      <Coffee aria-hidden="true" />
                    </span>
                    <div>
                      <span className="calendar-date-group-label">MID-TERM BREAK</span>
                      <p className="calendar-group-description">
                        Optional break period within the academic term.
                      </p>
                    </div>
                  </div>
                  <div className="calendar-date-fields">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Mid-term starts</Label>
                      <Input
                        type="date"
                        value={draft[t.id]?.midterm_start_date ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            [t.id]: { ...d[t.id], midterm_start_date: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Mid-term ends</Label>
                      <Input
                        type="date"
                        value={draft[t.id]?.midterm_end_date ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            [t.id]: { ...d[t.id], midterm_end_date: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
                <div className="calendar-term-actions">
                  <span className="calendar-actions-label">ACTIONS</span>
                  <Button
                    variant="outline"
                    onClick={() => mutation.mutate(t.id)}
                    disabled={mutation.isPending}
                  >
                    <Save className="mr-2 size-4" /> Save changes
                  </Button>
                  {!t.is_current && (
                    <Button
                      variant="ghost"
                      onClick={() => setTermToSetCurrent(t)}
                      disabled={setCurrent.isPending}
                    >
                      <Check className="mr-2 size-4" /> Set as current
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
        <div className="calendar-events-panel border-t pt-5">
          <div className="calendar-events-heading mb-3">
            <div className="calendar-section-heading">
              <span className="calendar-section-icon calendar-events-section-icon">
                <CalendarPlus aria-hidden="true" />
              </span>
              <div>
                <p className="font-medium">Other calendar events</p>
                <p className="text-xs text-muted-foreground">
                  Add school events, holidays, examinations, meetings, and other important dates.
                </p>
              </div>
            </div>
            <span className="calendar-events-icon">
              <CalendarRange />
            </span>
          </div>
          <div className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1.4fr_0.8fr_1fr_1fr_1.2fr_auto] md:items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Event title</Label>
              <Input
                value={eventForm.title}
                onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Parents' meeting"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select
                value={eventForm.event_type}
                onValueChange={(value) => setEventForm((f) => ({ ...f, event_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["holiday", "exam", "meeting", "sports", "activity", "other"].map((type) => (
                    <SelectItem key={type} value={type}>
                      {type[0].toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Starts</Label>
              <Input
                type="date"
                value={eventForm.start_date}
                onChange={(e) => setEventForm((f) => ({ ...f, start_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ends (optional)</Label>
              <Input
                type="date"
                value={eventForm.end_date}
                onChange={(e) => setEventForm((f) => ({ ...f, end_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Picture (optional)</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setEventForm((f) => ({ ...f, image: e.target.files?.[0] ?? null }))}
              />
            </div>
            <Button onClick={() => eventMutation.mutate()} disabled={eventMutation.isPending}>
              <Plus className="mr-2 size-4" /> Add event
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {yearEvents.length === 0 ? (
              <div className="calendar-events-empty">
                <CalendarRange aria-hidden="true" />
                <p>No additional events yet</p>
                <span>
                  Add important school events, holidays, meetings, or examination dates to your
                  academic calendar.
                </span>
              </div>
            ) : (
              yearEvents.map((event) => (
                <div
                  key={event.id}
                  className="calendar-event-row flex items-center justify-between rounded-md border px-3 py-2"
                >
                  {event.image_url && (
                    <img src={event.image_url} alt="" className="mr-3 size-12 rounded-md object-cover" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {event.title}{" "}
                      <Badge variant="outline" className="ml-2">
                        {event.event_type}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(event.start_date)}
                      {event.end_date ? ` – ${formatDate(event.end_date)}` : ""}
                      {event.notes ? ` · ${event.notes}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteEvent.mutate(event.id)}
                    disabled={deleteEvent.isPending}
                    aria-label={`Remove ${event.title}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
      <AlertDialog
        open={Boolean(termToSetCurrent)}
        onOpenChange={(open) => !open && setTermToSetCurrent(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set {termToSetCurrent?.name} as the current term?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace the active term for the school year. Timetables, attendance, and
              reports may use this term.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (termToSetCurrent) setCurrent.mutate(termToSetCurrent.id);
                setTermToSetCurrent(null);
              }}
            >
              Set as current
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/* --------------------------------- reports --------------------------------- */

function ReportsTab({
  schoolId,
  settings,
  onSaved,
}: {
  schoolId: string;
  settings: Record<string, unknown> | null | undefined;
  onSaved: () => void;
}) {
  const [showRanking, setShowRanking] = useState(false);
  const [showRaw, setShowRaw] = useState(true);
  const [footer, setFooter] = useState("");

  useEffect(() => {
    if (!settings) return;
    setShowRanking(Boolean(settings["show_ranking"]));
    setShowRaw(Boolean(settings["show_raw_scores"]));
    setFooter((settings["report_footer"] as string | null) ?? "");
  }, [settings]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("school_settings").upsert(
        {
          school_id: schoolId,
          show_ranking: showRanking,
          show_raw_scores: showRaw,
          report_footer: footer.trim() || null,
        },
        { onConflict: "school_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Report preferences updated successfully.");
      onSaved();
    },
    onError: () => toast.error("Report preferences could not be updated."),
  });

  return (
    <Card className="card-accent-academic">
      <CardHeader>
        <CardTitle>Report preferences</CardTitle>
        <CardDescription>
          Controls how learner achievement is presented on report cards.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="font-medium">Show raw scores</p>
            <p className="text-sm text-muted-foreground">
              Display percentages next to performance levels.
            </p>
          </div>
          <Switch checked={showRaw} onCheckedChange={setShowRaw} />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="font-medium">Internal ranking</p>
            <p className="text-sm text-muted-foreground">
              Positions remain internal analytics; off by default.
            </p>
          </div>
          <Switch checked={showRanking} onCheckedChange={setShowRanking} />
        </div>
        <Field label="Report footer">
          <Textarea rows={3} value={footer} onChange={(e) => setFooter(e.target.value)} />
        </Field>
        <div className="rounded-lg border bg-secondary/40 p-3 text-sm text-muted-foreground">
          Currency KES · Timezone Africa/Nairobi · Locale en-KE · Grading scheme KJSEA 8-level
          (locked)
        </div>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Save className="mr-2 size-4" /> Save preferences
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({
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
