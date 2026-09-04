import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Droplet,
  FileText,
  Mail,
  MapPin,
  Pencil,
  Phone,
  PieChart,
  History,
  ShieldCheck,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { RequireSchool } from "@/components/require-school";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useSchool } from "@/hooks/use-school";
import { formatDate, formatDateTime } from "@/lib/format";
import { LeavingCertificateDialog } from "@/components/leaving-certificate-dialog";
import { PhotoUploader } from "@/components/photo-uploader";
import { SchoolLogo } from "@/components/school-logo";
import {
  formatSeniorPathwaySummary,
  isSeniorSchoolGrade,
} from "@/lib/pathway-display";

export const Route = createFileRoute("/_authenticated/learners/$learnerId")({
  component: () => (
    <RequireSchool roles={["principal", "deputy", "teacher", "class_teacher"]}>
      <LearnerProfilePage />
    </RequireSchool>
  ),
});

type LifecycleClient = any;

function LearnerProfilePage() {
  const school = useSchool();
  const qc = useQueryClient();
  const { learnerId } = useParams({ from: "/_authenticated/learners/$learnerId" });
  const client = supabase as LifecycleClient;
  const [certificateOpen, setCertificateOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["learner-profile", school.schoolId, learnerId],
    queryFn: async () => {
      const [learner, enrollments, classHistory, statuses, exits, audits, pathwayAssignment] =
        await Promise.all([
          client
            .from("learners")
            .select("*")
            .eq("id", learnerId)
            .eq("school_id", school.schoolId)
            .single(),
          client
            .from("enrollments")
            .select(
              "id, academic_year_id, grade, stream_id, effective_date, is_active, academic_years(name), streams(name)",
            )
            .eq("learner_id", learnerId)
            .order("effective_date", { ascending: true }),
          client
            .from("student_class_history")
            .select(
              "id, grade, enrollment_date, end_date, status, promotion_status, remarks, movement_reason, academic_year_id, streams(name)",
            )
            .eq("learner_id", learnerId)
            .order("enrollment_date", { ascending: true }),
          client
            .from("student_status_history")
            .select("id, previous_status, new_status, effective_date, reason, notes, changed_at")
            .eq("learner_id", learnerId)
            .order("changed_at", { ascending: false }),
          client
            .from("student_exit_records")
            .select("*")
            .eq("learner_id", learnerId)
            .order("exit_date", { ascending: false }),
          client
            .from("audit_logs")
            .select("id, action, entity, reason, before_data, after_data, actor_name, created_at")
            .eq("entity_id", learnerId)
            .order("created_at", { ascending: false }),
          client
            .from("student_pathway_assignments")
            .select(
              "id, grade, pathway_id, track_id, strand_id, subject_combination_id, senior_pathways(name), pathway_tracks(name), pathway_strands(name), subject_combinations(name)",
            )
            .eq("learner_id", learnerId)
            .eq("school_id", school.schoolId)
            .eq("status", "current")
            .maybeSingle(),
        ]);
      if (learner.error) throw learner.error;
      if (pathwayAssignment.error && pathwayAssignment.error.code !== "PGRST116") {
        throw pathwayAssignment.error;
      }
      return {
        learner: learner.data,
        enrollments: enrollments.data ?? [],
        classHistory: classHistory.data ?? [],
        statuses: statuses.data ?? [],
        exits: exits.data ?? [],
        audits: audits.data ?? [],
        pathwayAssignment: pathwayAssignment.data ?? null,
      };
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading learner profile…</p>;
  if (!data?.learner) return <p className="text-sm text-destructive">Learner record not found.</p>;

  const learner = data.learner;
  const fullName = [learner.first_name, learner.middle_name, learner.last_name]
    .filter(Boolean)
    .join(" ");
  const timeline = [
    ...data.enrollments.map((item: any) => ({
      date: item.effective_date,
      title: `Enrolled in ${item.grade}${item.streams?.name ? ` ${item.streams.name}` : ""}`,
      detail: item.academic_years?.name ?? "Academic year",
      icon: CalendarDays,
    })),
    ...data.statuses.map((item: any) => ({
      date: item.effective_date,
      title: `Status changed to ${String(item.new_status).replaceAll("_", " ")}`,
      detail: item.reason ?? item.notes ?? "",
      icon: History,
    })),
    ...data.exits.map((item: any) => ({
      date: item.exit_date,
      title: `${String(item.exit_type).replaceAll("_", " ")}`,
      detail: item.reason ?? "Exit recorded",
      icon: FileText,
    })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const currentEnrollment = data.enrollments[data.enrollments.length - 1];

  const statusLabel = String(learner.status).replaceAll("_", " ");
  const placement = `${learner.current_grade ?? "Not assigned"}${currentEnrollment?.streams?.name ? ` ${currentEnrollment.streams.name}` : ""}`;
  const seniorPathwaySummary = isSeniorSchoolGrade(learner.current_grade)
    ? formatSeniorPathwaySummary(data.pathwayAssignment)
    : null;
  const age = learner.date_of_birth
    ? Math.max(0, new Date().getFullYear() - new Date(learner.date_of_birth).getFullYear())
    : null;

  return (
    <div className="learner-profile mx-auto max-w-7xl space-y-6">
      <div className="hidden flex-col items-center border-b border-slate-200 pb-5 text-center print:flex">
        <SchoolLogo
          logoUrl={school.school?.logo_url}
          schoolName={school.school?.name}
          shortName={school.school?.short_name}
          className="size-20"
          imageClassName="rounded-none"
        />
        <div className="mt-2 text-lg font-bold text-slate-900">{school.school?.name ?? "School"}</div>
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Learner profile</div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild aria-label="Back to learner register">
            <Link to="/learners"><ArrowLeft className="size-5" /></Link>
          </Button>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Student Profile</h1>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground sm:text-sm">
          <Link to="/learners" className="hover:text-primary">Students</Link>
          <ChevronRight className="size-3.5" /><span>Student Profile</span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.85fr_1fr] print:hidden">
        <Card className="overflow-hidden border-slate-200 bg-gradient-to-br from-white via-white to-sky-50/60 shadow-sm">
          <CardContent className="p-5 sm:p-7">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <PhotoUploader
              value={learner.photo_url}
              name={fullName}
              size="lg"
              className="shrink-0 self-center sm:self-start"
              onChange={async (photo_url) => {
                const { error } = await client.from("learners").update({ photo_url }).eq("id", learnerId);
                if (error) toast.error("Failed to update photo: " + error.message);
                else {
                  void qc.invalidateQueries({ queryKey: ["learner-profile", school.schoolId, learnerId] });
                  void qc.invalidateQueries({ queryKey: ["learners", school.schoolId] });
                }
              }}
            />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold text-foreground">{fullName}</h2>
                  <Badge className="rounded-full bg-green-100 px-3 py-1 text-green-700 hover:bg-green-100">{statusLabel}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Admission No: {learner.admission_number}</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <ProfileFact icon={Calendar} label="Class" value={placement} />
                  <ProfileFact icon={Calendar} label="Date of Birth" value={`${formatDate(learner.date_of_birth)}${age !== null ? ` (${age} years)` : ""}`} />
                  <ProfileFact icon={ClipboardList} label="Gender" value={learner.gender} />
                  <ProfileFact icon={Droplet} label="Blood Group" value={null} />
                  <ProfileFact icon={Phone} label="Phone" value={learner.emergency_contact_phone} />
                  <ProfileFact icon={Mail} label="Email" value={null} />
                  <ProfileFact icon={MapPin} label="Address" value={null} wide />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-slate-950 text-white shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-lg text-white">Academic overview</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <ProfileRow label="Class" value={learner.current_grade} dark />
            <ProfileRow label="Stream" value={currentEnrollment?.streams?.name} dark />
            {isSeniorSchoolGrade(learner.current_grade) ? (
              <ProfileRow label="Pathway" value={seniorPathwaySummary} dark />
            ) : null}
            <ProfileRow label="Class Teacher" value={null} dark />
            <ProfileRow label="Subjects" value="Not captured" dark />
            <ProfileRow label="Date of Admission" value={formatDate(learner.admission_date)} dark />
            <ProfileRow label="Status" value={statusLabel} status={learner.status === "active"} dark />
          </CardContent>
        </Card>
      </div>

      <section className="hidden print:block">
        <div className="mb-5 border-b border-slate-300 pb-3">
          <h1 className="text-xl font-bold text-slate-900">{fullName}</h1>
          <p className="mt-1 text-sm text-slate-600">Admission {learner.admission_number} · {statusLabel}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <PrintSection title="Personal information">
            <PrintField label="Full name" value={fullName} />
            <PrintField label="Gender" value={learner.gender} />
            <PrintField label="Date of birth" value={formatDate(learner.date_of_birth)} />
            <PrintField label="Phone number" value={learner.emergency_contact_phone} />
            <PrintField label="Nationality" value={learner.nationality} />
            <PrintField label="Religion" value={learner.religion} />
          </PrintSection>
          <PrintSection title="Admission and placement">
            <PrintField label="Admission number" value={learner.admission_number} />
            <PrintField label="UPI" value={learner.upi_number} />
            <PrintField label="Assessment number" value={learner.assessment_number} />
            <PrintField label="Birth certificate" value={learner.birth_certificate_no} />
            <PrintField label="Class" value={learner.current_grade} />
            <PrintField label="Stream" value={currentEnrollment?.streams?.name ?? "Class stream"} />
            <PrintField label="Admission date" value={formatDate(learner.admission_date)} />
            <PrintField label="Boarding status" value={learner.boarding_status} />
            <PrintField label="Transport route" value={learner.transport_route} />
          </PrintSection>
          <PrintSection title="Parent / guardian">
            <PrintField label="Name" value={learner.emergency_contact_name} />
            <PrintField label="Relationship" value={learner.emergency_contact_relationship} />
            <PrintField label="Phone" value={learner.emergency_contact_phone} />
          </PrintSection>
          <PrintSection title="Academic overview">
            <PrintField label="Current class" value={placement} />
            <PrintField label="Pathway" value={seniorPathwaySummary} />
            <PrintField label="Average score" value="Not available" />
            <PrintField label="Assessments" value="No scores yet" />
            <PrintField label="Attendance" value="No records yet" />
            <PrintField label="Position" value="Not available" />
          </PrintSection>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <PrintSection title="Enrollment history">
            {data.enrollments.length ? data.enrollments.map((item: any) => (
              <PrintField key={item.id} label={formatDate(item.effective_date)} value={`${item.grade}${item.streams?.name ? ` · ${item.streams.name}` : ""}`} />
            )) : <PrintField label="Records" value="No enrollment history recorded" />}
          </PrintSection>
          <PrintSection title="Status history">
            {data.statuses.length ? data.statuses.map((item: any) => (
              <PrintField key={item.id} label={formatDate(item.effective_date)} value={String(item.new_status).replaceAll("_", " ")} />
            )) : <PrintField label="Records" value="No status changes recorded" />}
          </PrintSection>
        </div>
      </section>

      <Tabs defaultValue="personal" className="space-y-5">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-transparent p-1 print:hidden">
          {[
            ["overview", "Overview"],
            ["personal", "Personal"],
            ["guardians", "Guardians"],
            ["enrollment", "Enrollment history"],
            ["academic", "Academic records"],
            ["attendance", "Attendance"],
            ["medical", "Medical"],
            ["finance", "Finance"],
            ["documents", "Documents"],
            ["status", "Status history"],
            ["audit", "Audit log"],
          ].map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className="shrink-0 rounded-lg px-4 py-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="personal">
          <div className="grid gap-5 lg:grid-cols-[1.85fr_1fr]">
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-foreground">Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                <Summary label="Full Name" value={fullName} />
                <Summary label="Religion" value={learner.religion} />
                <Summary label="Admission No" value={learner.admission_number} />
                <Summary label="Phone Number" value={learner.emergency_contact_phone} />
                <Summary label="Date of Birth" value={formatDate(learner.date_of_birth)} />
                <Summary label="Email Address" value={null} />
                <Summary label="Gender" value={learner.gender} />
                <Summary label="Physical Address" value={null} />
                <Summary label="Nationality" value={learner.nationality} />
                <Summary label="County" value={null} />
              </CardContent>
            </Card>
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-foreground">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="h-11 w-full justify-start gap-3 bg-blue-600" asChild>
                  <Link to="/learners"><Pencil className="size-4" /> Edit Profile</Link>
                </Button>
                <Button variant="outline" className="h-11 w-full justify-start gap-3 border-blue-200 text-blue-700" asChild>
                  <Link to="/attendance"><PieChart className="size-4" /> View Attendance</Link>
                </Button>
                <Button variant="outline" className="h-11 w-full justify-start gap-3 border-blue-200 text-blue-700" asChild>
                  <Link to="/marks"><FileText className="size-4" /> View Exam Marks</Link>
                </Button>
                <Button variant="outline" className="h-11 w-full justify-start gap-3 border-green-200 text-green-700" asChild>
                  <Link to="/reports"><ClipboardList className="size-4" /> View Report Card</Link>
                </Button>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="outline" size="sm" asChild><Link to="/promotions">Promote</Link></Button>
                  <Button variant="outline" size="sm" onClick={() => window.print()}>Print Profile</Button>
                  <Button size="sm" onClick={() => setCertificateOpen(true)}><FileText className="mr-2 size-4" /> Certificate</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Student journey</CardTitle>
                <CardDescription>
                  Chronological lifecycle events retained against this permanent profile.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Timeline items={timeline} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Admission snapshot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Summary
                  label="Entry grade"
                  value={learner.entry_grade ?? learner.current_grade ?? "Not captured"}
                />
                <Summary
                  label="Previous school"
                  value={learner.previous_school ?? "Not captured"}
                />
                <Summary label="Admission type" value={learner.admission_type ?? "Not captured"} />
                <Summary
                  label="Sponsorship"
                  value={learner.sponsorship_information ?? "Not captured"}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="guardians">
          <Details
            items={[
              [
                "Guardian relationships",
                "Open the learner register edit action to manage linked guardian records.",
              ],
              ["Primary emergency contact", learner.emergency_contact_name],
              ["Phone", learner.emergency_contact_phone],
            ]}
          />
        </TabsContent>
        <TabsContent value="enrollment">
          <HistoryList
            items={data.classHistory.length ? data.classHistory : data.enrollments}
            empty="No enrollment history recorded."
          />
        </TabsContent>
        <TabsContent value="status">
          <HistoryList items={data.statuses} empty="No status changes recorded." />
        </TabsContent>
        <TabsContent value="audit">
          <AuditList items={data.audits} />
        </TabsContent>
        {(["academic", "attendance", "medical", "finance", "documents"] as const).map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardHeader>
                <CardTitle className="capitalize">{tab} records</CardTitle>
                <CardDescription>
                  These records remain linked to the permanent student profile across every class
                  and academic year.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No records are available in this view yet.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
      <LeavingCertificateDialog
        open={certificateOpen}
        onOpenChange={setCertificateOpen}
        learner={{
          id: learner.id,
          name: fullName,
          admissionNumber: learner.admission_number,
          currentGrade: learner.current_grade,
          dateOfBirth: learner.date_of_birth,
          admissionDate: learner.admission_date,
          photoUrl: learner.photo_url,
        }}
      />
    </div>
  );
}

function Summary({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 capitalize">{String(value || "Not captured")}</p>
    </div>
  );
}
function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-300 p-3">
      <h2 className="mb-3 border-b border-slate-200 pb-2 text-sm font-bold text-slate-900">{title}</h2>
      <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2">{children}</div>
    </section>
  );
}
function PrintField({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="text-sm">
      <span className="font-medium text-slate-500">{label}: </span>
      <span className="capitalize text-slate-900">{String(value || "Not captured")}</span>
    </div>
  );
}
function ProfileFact({
  icon: Icon,
  label,
  value,
  wide = false,
}: {
  icon: typeof Calendar;
  label: string;
  value: unknown;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <div className="flex min-h-[64px] items-start gap-3 rounded-xl border border-slate-200/80 bg-white/80 p-3 shadow-sm">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sky-100 text-sky-700">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 break-words text-sm font-semibold text-slate-800">{String(value || "Not captured")}</p>
        </div>
      </div>
    </div>
  );
}
function ProfileRow({ label, value, status = false, dark = false }: { label: string; value: unknown; status?: boolean; dark?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 border-b pb-3 text-sm last:border-0 last:pb-0 ${dark ? "border-white/10" : "border-slate-100"}`}>
      <span className={dark ? "text-slate-400" : "text-muted-foreground"}>{label}</span>
      {status ? (
        <Badge className="rounded-full bg-green-100 text-green-700 hover:bg-green-100">{String(value)}</Badge>
      ) : (
        <span className={`text-right font-semibold ${dark ? "text-white" : "text-slate-800"}`}>{String(value || "Not captured")}</span>
      )}
    </div>
  );
}
function Details({ items }: { items: [string, unknown][] }) {
  return (
    <Card>
      <Accordion type="single" collapsible>
        <AccordionItem value="details" className="border-0 px-6">
          <AccordionTrigger className="py-4">Show details</AccordionTrigger>
          <AccordionContent className="grid gap-5 sm:grid-cols-2">
            {items.map(([label, value]) => (
              <Summary key={label} label={label} value={value} />
            ))}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
function Timeline({
  items,
}: {
  items: { date: string; title: string; detail: string; icon: typeof CalendarDays }[];
}) {
  return (
    <div className="space-y-5">
      {items.length ? (
        items.map((item, index) => {
          const Icon = item.icon;
          return (
            <div key={`${item.date}-${index}`} className="relative flex gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-4" />
              </div>
              <div>
                <p className="font-medium capitalize">{item.title}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(item.date)}
                  {item.detail ? ` · ${item.detail}` : ""}
                </p>
              </div>
            </div>
          );
        })
      ) : (
        <p className="text-sm text-muted-foreground">No timeline events recorded.</p>
      )}
    </div>
  );
}
function HistoryList({ items, empty }: { items: any[]; empty: string }) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {items.length ? (
          items.map((item, index) => (
            <div key={item.id ?? index} className="border-l-2 border-primary/30 pl-4">
              <p className="font-medium">
                {item.grade
                  ? `${item.grade}${item.streams?.name ? ` · ${item.streams.name}` : ""}`
                  : `Status: ${String(item.new_status ?? "record").replaceAll("_", " ")}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDate(item.enrollment_date ?? item.effective_date)}
                {item.reason ? ` · ${item.reason}` : ""}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}
function AuditList({ items }: { items: any[] }) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="flex gap-3 border-b pb-3 text-sm last:border-0">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="font-medium capitalize">
                  {item.action} {item.entity}
                </p>
                <p className="text-muted-foreground">
                  {item.actor_name ?? "System"} · {formatDateTime(item.created_at)}
                </p>
                {item.reason && <p className="mt-1">{item.reason}</p>}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No audit entries recorded.</p>
        )}
      </CardContent>
    </Card>
  );
}
