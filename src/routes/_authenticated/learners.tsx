import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpenCheck,
  BusFront,
  Cake,
  CalendarDays,
  ChevronDown,
  FileText,
  Flag,
  GraduationCap,
  History,
  Home,
  Loader2,
  Mail,
  Phone,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserRound,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { RequireSchool } from "@/components/require-school";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ACTIONS_COLUMN_CLASS, RowActions } from "@/components/row-actions";
import { LeavingCertificateDialog } from "@/components/leaving-certificate-dialog";
import { PhotoUploader } from "@/components/photo-uploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { DetailPanel, PersonAvatar } from "@/components/detail-panel";
import { supabase } from "@/lib/supabase";
import { useSchool } from "@/hooks/use-school";
import { GRADE_LABELS, type CbeGrade } from "@/lib/cbe";
import { canViewFinancePanel, getPersonDisplayName } from "@/lib/detail-panel";
import { formatDate, formatKES, initials, KE_PHONE_REGEX, normalizeKePhone } from "@/lib/format";
import {
  formatSeniorPathwaySummary,
  isSeniorSchoolGrade,
} from "@/lib/pathway-display";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/learners")({
  head: () => ({
    meta: [
      { title: "Learners & admissions · SHANSCOTT CBE" },
      {
        name: "description",
        content:
          "Admit learners, assign CBE grades and streams, and manage the learner register with UPI and assessment numbers.",
      },
      { property: "og:title", content: "Learners & admissions · SHANSCOTT CBE" },
      {
        property: "og:description",
        content:
          "Admissions register for Kenyan CBE schools with grades, streams and guardian details.",
      },
    ],
  }),
  component: () => (
    <RequireSchool roles={["admin", "principal", "deputy", "teacher", "class_teacher"]}>
      <LearnersPage />
    </RequireSchool>
  ),
});

interface LearnerRow {
  id: string;
  admission_number: string;
  upi_number: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  gender: string | null;
  current_grade: CbeGrade | null;
  current_stream_id: string | null;
  admission_date: string | null;
  date_of_birth: string | null;
  assessment_number: string | null;
  birth_certificate_no: string | null;
  boarding_status: string | null;
  transport_route: string | null;
  medical_alerts: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  exit_date: string | null;
  exit_reason: string | null;
  status: string;
  photo_url: string | null;
}

interface LearnerHistoryRow {
  id: string;
  action: string;
  previous_status: string | null;
  new_status: string | null;
  previous_grade: CbeGrade | null;
  new_grade: CbeGrade | null;
  reason: string | null;
  effective_date: string;
}

const STATUS_TONE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  transferred_out: "secondary",
  graduated: "secondary",
  withdrawn: "outline",
  suspended: "destructive",
};

function LearnersPage() {
  const school = useSchool();
  const schoolId = school.schoolId!;
  const qc = useQueryClient();
  const isTeacherScoped =
    school.can("teacher", "class_teacher") &&
    !school.can("principal", "deputy", "super_admin", "admin");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [expandedGrades, setExpandedGrades] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(school.grades.map((grade) => [grade, false])),
  );
  const [expandedStreams, setExpandedStreams] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LearnerRow | null>(null);
  const [promoting, setPromoting] = useState<LearnerRow | null>(null);
  const [certLearner, setCertLearner] = useState<LearnerRow | null>(null);
  const [selectedLearners, setSelectedLearners] = useState<Set<string>>(new Set());
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(null);
  const openLearnerTriggerRef = useRef<HTMLElement | null>(null);
  const canViewFinance = canViewFinancePanel(school.roles);

  const teacherStreamIds = useQuery({
    queryKey: ["teacher-learners-streams", schoolId, school.userId],
    enabled: isTeacherScoped,
    queryFn: async () => {
      const { data: staffRecord, error: staffError } = await supabase
        .from("staff")
        .select("id")
        .eq("school_id", schoolId)
        .eq("user_id", school.userId)
        .eq("is_archived", false)
        .eq("status", "active")
        .maybeSingle();
      if (staffError) throw staffError;
      if (!staffRecord) return [];

      const { data, error } = await supabase
        .from("teacher_allocations")
        .select("stream_id")
        .eq("school_id", schoolId)
        .eq("staff_id", staffRecord.id)
        .eq("is_active", true);
      if (error) throw error;
      const { data: classTeacherStreams, error: classTeacherError } = await supabase
        .from("streams")
        .select("id")
        .eq("school_id", schoolId)
        .eq("class_teacher_id", staffRecord.id)
        .eq("is_active", true);
      if (classTeacherError) throw classTeacherError;
      return [
        ...new Set([
          ...(data ?? []).map((row) => row.stream_id),
          ...(classTeacherStreams ?? []).map((stream) => stream.id),
        ]),
      ];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["learners", schoolId, isTeacherScoped ? "teacher" : "all"],
    queryFn: async () => {
      const [learners, streams, pathwayAssignments] = await Promise.all([
        (() => {
          let query = supabase
            .from("learners")
            .select(
              "id, admission_number, upi_number, first_name, middle_name, last_name, gender, current_grade, current_stream_id, admission_date, date_of_birth, assessment_number, birth_certificate_no, boarding_status, transport_route, medical_alerts, emergency_contact_name, emergency_contact_phone, exit_date, exit_reason, status, photo_url",
            )
            .eq("school_id", schoolId)
            .eq("is_archived", false)
            .order("created_at", { ascending: false });

          if (isTeacherScoped) {
            const ids = teacherStreamIds.data ?? [];
            if (!ids.length) return Promise.resolve({ data: [] as LearnerRow[], error: null });
            query = query.in("current_stream_id", ids);
          }

          return query;
        })(),
        supabase
          .from("streams")
          .select("id, grade, name, capacity")
          .eq("school_id", schoolId)
          .eq("is_active", true),
        supabase
          .from("student_pathway_assignments")
          .select(
            "learner_id, grade, senior_pathways(name), pathway_tracks(name), pathway_strands(name), subject_combinations(name)",
          )
          .eq("school_id", schoolId)
          .eq("status", "current"),
      ]);
      if (learners.error) throw learners.error;
      if (pathwayAssignments.error) throw pathwayAssignments.error;
      return {
        learners: (learners.data ?? []) as LearnerRow[],
        streams: streams.data ?? [],
        pathwayAssignments: (pathwayAssignments.data ?? []) as Array<{
          learner_id: string;
          grade: string | null;
          senior_pathways?: { name?: string | null } | null;
          pathway_tracks?: { name?: string | null } | null;
          pathway_strands?: { name?: string | null } | null;
          subject_combinations?: { name?: string | null } | null;
        }>,
      };
    },
  });

  const streams = data?.streams ?? [];
  const pathwaySummaryByLearner = useMemo(() => {
    const summaryMap = new Map<string, string>();
    for (const assignment of data?.pathwayAssignments ?? []) {
      if (!assignment.learner_id) continue;
      const summary = formatSeniorPathwaySummary(assignment);
      if (summary !== "Not captured") summaryMap.set(assignment.learner_id, summary);
    }
    return summaryMap;
  }, [data?.pathwayAssignments]);
  const rows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return (data?.learners ?? []).filter((learner) => {
      const name = [learner.first_name, learner.middle_name, learner.last_name]
        .filter(Boolean)
        .join(" ");
      const matchesSearch =
        !search ||
        `${name} ${learner.admission_number} ${learner.upi_number ?? ""}`
          .toLowerCase()
          .includes(search);
      return (
        matchesSearch &&
        (gradeFilter === "all" || learner.current_grade === gradeFilter) &&
        (statusFilter === "all" || learner.status === statusFilter)
      );
    });
  }, [data?.learners, gradeFilter, query, statusFilter]);

  const groups = useMemo(
    () =>
      school.grades
        .map((grade) => {
          const gradeLearners = rows.filter((learner) => learner.current_grade === grade);
          const gradeStreams = streams
            .filter((stream) => stream.grade === grade)
            .sort((a, b) => a.name.localeCompare(b.name));
          return {
            grade,
            learners: gradeLearners,
            streams: gradeStreams
              .map((stream) => ({
                stream,
                learners: gradeLearners.filter(
                  (learner) => learner.current_stream_id === stream.id,
                ),
              }))
              .filter((group) => group.learners.length > 0),
            unassigned: gradeLearners.filter((learner) => !learner.current_stream_id),
          };
        })
        .filter(
          (group) =>
            (gradeFilter === "all" || group.grade === gradeFilter) && group.learners.length > 0,
        ),
    [gradeFilter, rows, school.grades, streams],
  );

  const visibleGroups = groups;
  const unassignedGradeLearners = rows.filter(
    (learner) => !learner.current_grade || !school.grades.includes(learner.current_grade),
  );

  const archiveLearner = useMutation({
    mutationFn: async (learner: LearnerRow) => {
      const { error } = await supabase
        .from("learners")
        .update({ is_archived: true, status: "withdrawn" })
        .eq("id", learner.id)
        .eq("school_id", schoolId);
      if (error) throw error;
      const { error: historyError } = await supabase.from("learner_status_history").insert({
        school_id: schoolId,
        learner_id: learner.id,
        actor_id: school.userId,
        action: "archived",
        previous_status: learner.status as never,
        new_status: "withdrawn" as never,
        previous_grade: learner.current_grade,
        new_grade: learner.current_grade,
        previous_stream_id: learner.current_stream_id,
        new_stream_id: learner.current_stream_id,
        academic_year_id: school.academicYearId,
        term_id: school.termId,
        reason: "Learner record archived",
      });
      if (historyError) throw historyError;
      const lifecycle = supabase as any;
      const { error: lifecycleError } = await lifecycle.from("student_status_history").insert({
        school_id: schoolId,
        learner_id: learner.id,
        previous_status: learner.status,
        new_status: "withdrawn",
        effective_date: new Date().toISOString().slice(0, 10),
        reason: "Learner record archived",
        changed_by: school.userId,
      });
      if (lifecycleError) throw lifecycleError;
    },
    onSuccess: () => {
      toast.success("Learner archived successfully.");
      void qc.invalidateQueries({ queryKey: ["learners", schoolId] });
    },
    onError: () => toast.error("The learner could not be archived."),
  });

  const deleteLearner = useMutation({
    mutationFn: async (learner: LearnerRow) => {
      if (
        !window.confirm(
          `Permanently delete ${learner.first_name} ${learner.last_name}? This removes fees, marks, attendance, reports and history.`,
        )
      )
        return;
      const { error } = await supabase.rpc("delete_learner_permanently", {
        _school_id: schoolId,
        _learner_id: learner.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Learner and linked records permanently deleted.");
      void qc.invalidateQueries({ queryKey: ["learners", schoolId] });
      void qc.invalidateQueries({ queryKey: ["report-cards", schoolId] });
    },
    onError: (error: Error) =>
      toast.error("Learner was not deleted.", { description: error.message }),
  });

  const bulkDeleteLearners = useMutation({
    mutationFn: async () => {
      if (!selectedLearners.size) return;
      if (
        !window.confirm(
          `Permanently delete ${selectedLearners.size} selected learners? This removes linked fees, marks, attendance, reports and history.`,
        )
      )
        return;
      for (const learnerId of selectedLearners) {
        const { error } = await supabase.rpc("delete_learner_permanently", {
          _school_id: schoolId,
          _learner_id: learnerId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setSelectedLearners(new Set());
      toast.success("Selected learners and linked records permanently deleted.");
      void qc.invalidateQueries({ queryKey: ["learners", schoolId] });
      void qc.invalidateQueries({ queryKey: ["report-cards", schoolId] });
    },
    onError: (error: Error) => toast.error("Learners were not deleted.", { description: error.message }),
  });

  function resetFilters() {
    setQuery("");
    setGradeFilter("all");
    setStatusFilter("active");
    setPage(1);
  }

  const isTeacherScopedView =
    school.can("teacher", "class_teacher") &&
    !school.can("principal", "deputy", "super_admin", "admin");

  const teacherAssignedAreaIds = useQuery({
    queryKey: ["teacher-assigned-learning-areas", schoolId, school.userId],
    enabled: isTeacherScopedView && Boolean(selectedLearnerId),
    queryFn: async () => {
      const { data: staffRecord, error: staffError } = await supabase
        .from("staff")
        .select("id")
        .eq("school_id", schoolId)
        .eq("user_id", school.userId)
        .eq("is_archived", false)
        .eq("status", "active")
        .maybeSingle();
      if (staffError) throw staffError;
      if (!staffRecord) return [] as Array<{ learning_area_id: string }>;

      const { data, error } = await supabase
        .from("teacher_allocations")
        .select("learning_area_id")
        .eq("school_id", schoolId)
        .eq("staff_id", staffRecord.id)
        .eq("is_active", true)
        .eq("academic_year_id", school.academicYearId);
      if (error) throw error;
      return (data ?? []) as Array<{ learning_area_id: string }>;
    },
  });

  const selectedLearnerDetail = useQuery({
    queryKey: ["learner-detail-drawer", schoolId, selectedLearnerId],
    enabled: Boolean(selectedLearnerId),
    queryFn: async () => {
      const [learner, attendance, marks, guardians, invoices, payments, pathwayAssignment] =
        await Promise.all([
          supabase
            .from("learners")
            .select(
              "id, admission_number, upi_number, first_name, middle_name, last_name, gender, current_grade, current_stream_id, admission_date, date_of_birth, assessment_number, birth_certificate_no, boarding_status, transport_route, medical_alerts, emergency_contact_name, emergency_contact_phone, exit_date, exit_reason, status, photo_url, current_stream_id",
            )
            .eq("school_id", schoolId)
            .eq("id", selectedLearnerId!)
            .eq("is_archived", false)
            .single(),
          supabase
            .from("attendance_records")
            .select("id, status, attendance_date")
            .eq("school_id", schoolId)
            .eq("learner_id", selectedLearnerId!)
            .order("attendance_date", { ascending: false })
            .limit(60),
          supabase
            .from("marks")
            .select(
              "id, raw_score, is_absent, is_exempt, assessment_id, assessments(title, assessment_date, learning_area_id, learning_areas(name))",
            )
            .eq("school_id", schoolId)
            .eq("learner_id", selectedLearnerId!)
            .order("created_at", { ascending: false })
            .limit(30),
          supabase
            .from("learner_guardians")
            .select("id, guardians(full_name, relationship, phone, email, address)")
            .eq("school_id", schoolId)
            .eq("learner_id", selectedLearnerId!),
          canViewFinance
            ? supabase
                .from("invoices")
                .select("id, invoice_number, total, due_date, issue_date, status")
                .eq("school_id", schoolId)
                .eq("learner_id", selectedLearnerId!)
                .order("issue_date", { ascending: false })
            : Promise.resolve({ data: [], error: null }),
          canViewFinance
            ? supabase
                .from("payments")
                .select("id, amount, method, reference, paid_at, invoice_id")
                .eq("school_id", schoolId)
                .eq("learner_id", selectedLearnerId!)
                .order("paid_at", { ascending: false })
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from("student_pathway_assignments")
            .select(
              "id, grade, pathway_id, track_id, strand_id, subject_combination_id, senior_pathways(name), pathway_tracks(name), pathway_strands(name), subject_combinations(name)",
            )
            .eq("school_id", schoolId)
            .eq("learner_id", selectedLearnerId!)
            .eq("status", "current")
            .maybeSingle(),
        ]);

      if (learner.error) throw learner.error;
      if (pathwayAssignment.error && pathwayAssignment.error.code !== "PGRST116") {
        throw pathwayAssignment.error;
      }
      let learnerMarks = (marks.data ?? []) as Array<{
        id: string;
        raw_score: number | null;
        is_absent: boolean | null;
        is_exempt: boolean | null;
        assessment_id: string;
        assessments?: {
          title: string;
          assessment_date: string | null;
          learning_area_id: string | null;
          learning_areas?: { name: string | null } | null;
        } | null;
      }>;

      if (isTeacherScopedView && teacherAssignedAreaIds.data?.length) {
        const allowedAreaIds = new Set(
          teacherAssignedAreaIds.data
            .map((assignment) => assignment.learning_area_id)
            .filter(Boolean) as string[],
        );
        learnerMarks = learnerMarks.filter(
          (mark) => mark.assessments?.learning_area_id && allowedAreaIds.has(mark.assessments.learning_area_id),
        );
      }

      return {
        learner: learner.data,
        attendance: attendance.data ?? [],
        marks: learnerMarks,
        guardians: (guardians.data ?? []).flatMap((row: any) => {
          const guardian = row?.guardians;
          if (!guardian) return [];
          return [{
            id: row.id,
            full_name: guardian.full_name ?? "Guardian",
            relationship: guardian.relationship ?? "Guardian",
            phone: guardian.phone ?? null,
            email: guardian.email ?? null,
            address: guardian.address ?? null,
          }];
        }),
        invoices: invoices.data ?? [],
        payments: payments.data ?? [],
        pathwayAssignment: pathwayAssignment.data ?? null,
      };
    },
  });

  function renderLearner(learner: LearnerRow) {
    const name = [learner.first_name, learner.middle_name, learner.last_name]
      .filter(Boolean)
      .join(" ");
    const pathwaySummary = isSeniorSchoolGrade(learner.current_grade)
      ? pathwaySummaryByLearner.get(learner.id) ?? "No pathway selected"
      : null;

    const openLearnerDrawer = (event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      openLearnerTriggerRef.current = event.currentTarget;
      setSelectedLearnerId(learner.id);
    };

    return (
      <div
        key={learner.id}
        className="group grid w-full rounded-md px-4 py-4 text-left transition-colors hover:bg-accent/35 sm:grid-cols-[auto_1fr_1.4fr_0.7fr_0.9fr_0.9fr_auto] sm:items-center sm:px-5"
      >
        {school.can("principal", "deputy", "super_admin") && (
          <div
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <Checkbox
              checked={selectedLearners.has(learner.id)}
              aria-label={`Select ${name}`}
              onCheckedChange={() => {
                setSelectedLearners((current) => {
                  const next = new Set(current);
                  if (next.has(learner.id)) next.delete(learner.id);
                  else next.add(learner.id);
                  return next;
                });
              }}
            />
          </div>
        )}
        <span className="w-fit rounded-md bg-muted px-2 py-1 font-mono text-xs font-medium">
          {learner.admission_number}
        </span>
        <Link
          to="/learners/$learnerId"
          params={{ learnerId: learner.id }}
          onClick={openLearnerDrawer}
          className="contents"
        >
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-9 shrink-0">
              <AvatarImage src={learner.photo_url ?? undefined} alt={name} />
              <AvatarFallback className="bg-primary/10 text-xs text-primary">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <span className="block font-medium hover:underline">{name}</span>
              <p className="text-xs text-muted-foreground">
                {learner.upi_number ? `UPI ${learner.upi_number}` : "UPI not captured"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users className="size-4 text-muted-foreground" />
            <span className="capitalize">{learner.gender ?? "—"}</span>
            <span className="text-xs text-muted-foreground sm:hidden">Gender</span>
          </div>
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-muted-foreground sm:hidden">Admitted: </span>
              {formatDate(learner.admission_date)}
            </div>
            {pathwaySummary && (
              <div className="max-w-[18rem] truncate text-[11px] font-medium text-teal-700">
                {pathwaySummary}
              </div>
            )}
          </div>
          <Badge variant={STATUS_TONE[learner.status] ?? "secondary"} className="w-fit capitalize">
            {learner.status}
          </Badge>
        </Link>
        <div
          className={ACTIONS_COLUMN_CLASS}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <RowActions
            onEdit={() => setEditing(learner)}
            onPromote={() => setPromoting(learner)}
            onArchive={() => archiveLearner.mutate(learner)}
            disabled={archiveLearner.isPending || deleteLearner.isPending}
            archiveLabel="Archive learner"
            extra={
              <>
                <DropdownMenuItem
                  data-row-action="true"
                  onSelect={(event) => {
                    event.preventDefault();
                    setCertLearner(learner);
                  }}
                >
                  <FileText className="mr-2 size-4" /> Generate Certificate
                </DropdownMenuItem>
                {school.can("principal", "deputy", "super_admin") ? (
                  <DropdownMenuItem
                    data-row-action="true"
                    onSelect={(event) => {
                      event.preventDefault();
                      deleteLearner.mutate(learner);
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 size-4" /> Permanently delete
                  </DropdownMenuItem>
                ) : null}
                <LearnerHistoryAction learner={learner} schoolId={schoolId} />
              </>
            }
          />
        </div>
      </div>
    );
  }

  const drawerLearner = selectedLearnerDetail.data?.learner;
  const drawerName = drawerLearner
    ? getPersonDisplayName({
        first_name: drawerLearner.first_name,
        middle_name: drawerLearner.middle_name,
        last_name: drawerLearner.last_name,
      })
    : "Learner profile";
  const drawerAttendance = selectedLearnerDetail.data?.attendance ?? [];
  const drawerMarks = selectedLearnerDetail.data?.marks ?? [];
  const drawerPathwaySummary = isSeniorSchoolGrade(drawerLearner?.current_grade)
    ? formatSeniorPathwaySummary(selectedLearnerDetail.data?.pathwayAssignment)
    : null;
  const hasDrawerPathway = Boolean(
    drawerPathwaySummary && drawerPathwaySummary !== "Not captured",
  );
  const averageScore = drawerMarks.length
    ? Math.round(
        (drawerMarks.reduce((total, mark) => total + Number(mark.raw_score ?? 0), 0) /
          drawerMarks.length) * 10,
      ) / 10
    : null;
  const attendanceRate = drawerAttendance.length
    ? Math.round(
        (drawerAttendance.filter((record) => record.status === "present").length /
          drawerAttendance.length) * 100,
      )
    : null;

  return (
    <>
      <DetailPanel
        open={Boolean(selectedLearnerId)}
        onOpenChange={(next) => {
          if (!next) {
            setSelectedLearnerId(null);
            requestAnimationFrame(() => openLearnerTriggerRef.current?.focus());
          }
        }}
        entityType="learner"
        photoUrl={drawerLearner?.photo_url ?? null}
        title={drawerName}
        subtitle={drawerLearner ? `Admission ${drawerLearner.admission_number}` : "Loading…"}
        context={drawerLearner ? `${drawerLearner.current_grade ?? "Class not assigned"} • ${drawerLearner.current_stream_id ? "Class stream" : "No stream"}` : undefined}
        status={drawerLearner?.status}
        onEdit={() => {
          const learnerRow = rows.find((learner) => learner.id === selectedLearnerId);
          if (learnerRow) {
            setEditing(learnerRow);
            setSelectedLearnerId(null);
          }
        }}
        onPrint={() => window.print()}
        onCloseFocus={() => openLearnerTriggerRef.current?.focus()}
      >
        {selectedLearnerDetail.isLoading ? (
          <div className="space-y-3 py-8 text-sm text-muted-foreground">
            <div className="h-10 animate-pulse rounded-md bg-muted" />
            <div className="h-24 animate-pulse rounded-md bg-muted" />
            <div className="h-20 animate-pulse rounded-md bg-muted" />
          </div>
        ) : !drawerLearner ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Learner details could not be loaded.
          </div>
        ) : (
          <div className="space-y-4">
            <section className="min-w-0 space-y-4 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.16)] ring-1 ring-slate-800/80">
              <SectionHeader icon={UserRound} label="Profile summary" />
              {drawerPathwaySummary && (
                <div
                  className={cn(
                    "rounded-2xl border p-4 shadow-sm transition-colors",
                    hasDrawerPathway
                      ? "border-teal-300/70 bg-gradient-to-r from-teal-100 via-emerald-50 to-cyan-50"
                      : "border-amber-300/80 bg-gradient-to-r from-amber-100 via-yellow-50 to-orange-50",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex size-8 items-center justify-center rounded-full border",
                          hasDrawerPathway
                            ? "border-teal-200 bg-white text-teal-700"
                            : "border-amber-200 bg-white text-amber-700",
                        )}
                      >
                        <GraduationCap className="size-4" />
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                        Senior pathway
                      </span>
                    </div>
                    <Badge
                      className={cn(
                        "border hover:bg-white",
                        hasDrawerPathway
                          ? "border-teal-200 bg-white text-teal-700"
                          : "border-amber-200 bg-white text-amber-700",
                      )}
                    >
                      {drawerLearner.current_grade}
                    </Badge>
                  </div>
                  <p
                    className={cn(
                      "mt-3 text-sm font-semibold leading-6",
                      hasDrawerPathway ? "text-slate-900" : "text-amber-800",
                    )}
                  >
                    {hasDrawerPathway ? drawerPathwaySummary : "No senior pathway selected yet"}
                  </p>
                  {!hasDrawerPathway && (
                    <p className="mt-1 text-xs text-amber-700/80">
                      Add the pathway, track and subject combination for this learner from the update form.
                    </p>
                  )}
                </div>
              )}
              <div className="grid min-w-0 gap-x-4 gap-y-3 sm:grid-cols-2">
                <FactItem icon={FileText} label="Admission number" value={drawerLearner.admission_number} />
                <FactItem icon={UserCheck} label="Gender" value={drawerLearner.gender ?? "Not captured"} />
                <FactItem icon={Cake} label="Date of birth" value={formatDate(drawerLearner.date_of_birth)} />
                <FactItem icon={GraduationCap} label="Class" value={drawerLearner.current_grade ?? "Class not assigned"} />
                <FactItem icon={BookOpenCheck} label="Stream" value={drawerLearner.current_stream_id ? "Class stream" : "No stream"} />
                <FactItem icon={CalendarDays} label="Admission date" value={formatDate(drawerLearner.admission_date)} />
                <FactItem icon={Phone} label="Phone number" value={drawerLearner.emergency_contact_phone ?? "Not captured"} />
                <FactItem icon={FileText} label="UPI" value={drawerLearner.upi_number ?? "UPI not captured"} />
                <FactItem icon={FileText} label="Assessment number" value={drawerLearner.assessment_number ?? "Not captured"} />
                <FactItem icon={ShieldAlert} label="Birth certificate" value={drawerLearner.birth_certificate_no ?? "Not captured"} />
                <FactItem icon={Home} label="Boarding status" value={drawerLearner.boarding_status ?? "Not captured"} />
                <FactItem icon={BusFront} label="Transport route" value={drawerLearner.transport_route ?? "Not captured"} />
              </div>
            </section>

            {school.can("principal", "deputy", "super_admin", "admin") && (
              <section className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-teal-50/20 p-4 shadow-sm ring-1 ring-slate-100 dark:border-slate-700 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 dark:ring-slate-800/80">
                <SectionHeader icon={Users} label="Parent / guardian" />
                {selectedLearnerDetail.data?.guardians.length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {selectedLearnerDetail.data.guardians.map((guardian) => (
                      <div key={guardian.id} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{guardian.full_name}</div>
                        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{guardian.relationship}</div>
                        <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                          {guardian.phone && <div className="flex items-center gap-2 break-words"><Phone className="size-4 shrink-0 text-teal-600 dark:text-teal-400" />{guardian.phone}</div>}
                          {guardian.email && <div className="flex items-center gap-2 break-words"><Mail className="size-4 shrink-0 text-teal-600 dark:text-teal-400" />{guardian.email}</div>}
                          {guardian.address && <div className="break-words text-slate-600 dark:text-slate-300">{guardian.address}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState icon={Users} message="No guardian records on file." />}
              </section>
            )}

            <section className="min-w-0 space-y-4 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.12)] ring-1 ring-slate-800/80">
              <SectionHeader icon={BookOpenCheck} label="Academic overview" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon={GraduationCap} label="Average score" value={averageScore === null ? "—" : String(averageScore)} support={drawerMarks.length ? "Across assessments" : "No scores yet"} />
                <StatCard icon={FileText} label="Assessments" value={String(drawerMarks.length)} support="Recorded" />
                <StatCard icon={CalendarDays} label="Attendance" value={attendanceRate === null ? "—" : `${attendanceRate}%`} support={drawerAttendance.length ? `${drawerAttendance.length} records` : "No records yet"} />
                <StatCard icon={GraduationCap} label="Position" value="—" support="Not available" />
              </div>
              <div className="grid gap-4 pt-1 lg:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-[0.04em] text-slate-500">Attendance trend</div>
                  {selectedLearnerDetail.data?.attendance.length ? (
                    <div className="flex items-end gap-2">
                      {(["present", "late", "absent", "excused"] as const).map((status) => {
                        const count = selectedLearnerDetail.data.attendance.filter((record) => record.status === status).length;
                        return (
                          <div key={status} className="flex flex-1 flex-col items-center gap-2">
                            <span className="text-[10px] font-medium uppercase tracking-[0.04em] text-slate-500">{status[0]}</span>
                            <div className="flex h-14 w-full items-end rounded-lg bg-slate-100 p-1.5"><div className="w-full rounded-md bg-teal-500" style={{ height: `${Math.max(8, (count / Math.max(1, selectedLearnerDetail.data.attendance.length)) * 100)}%` }} /></div>
                            <span className="text-xs font-semibold text-slate-700">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : <EmptyState icon={CalendarDays} message="No attendance recorded yet." />}
                </div>
                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-[0.04em] text-slate-500">Assessment history</div>
                  {selectedLearnerDetail.data?.marks.length ? (
                    <div className="space-y-2">
                      {selectedLearnerDetail.data.marks.slice(0, 3).map((mark) => (
                        <div key={mark.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <div className="min-w-0"><div className="truncate text-sm font-medium text-slate-900">{mark.assessments?.title ?? "Assessment"}</div><div className="text-xs text-slate-500">{mark.assessments?.learning_areas?.name ?? "Subject"}</div></div>
                          <Badge variant="secondary" className="shrink-0 border-slate-200 bg-white">{mark.is_absent ? "Absent" : mark.is_exempt ? "Exempt" : mark.raw_score ?? "—"}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : <EmptyState icon={FileText} message="No assessments recorded yet." />}
                </div>
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="min-w-0 space-y-4 rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-amber-50/20 to-slate-100 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/80 dark:border-slate-700 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 dark:ring-slate-800/80">
                <SectionHeader icon={Wallet} label="Fee account" />
                {canViewFinance ? (
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    {selectedLearnerDetail.data?.invoices.length || selectedLearnerDetail.data?.payments.length ? (() => {
                      const invoiceRows = selectedLearnerDetail.data?.invoices ?? [];
                      const paymentRows = selectedLearnerDetail.data?.payments ?? [];
                      const paidTotal = paymentRows.reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
                      const totalFees = invoiceRows.reduce((sum: number, invoice: any) => sum + Number(invoice.total || 0), 0);
                      const outstandingTotal = Math.max(0, totalFees - paidTotal);
                      return (
                        <div className="grid gap-3 sm:grid-cols-3">
                          <MoneyStat label="Total fees" value={formatKES(totalFees)} className="min-w-[180px]" />
                          <MoneyStat label="Paid" value={formatKES(paidTotal)} tone="teal" className="min-w-[180px]" />
                          <MoneyStat label="Outstanding" value={formatKES(outstandingTotal)} tone="amber" className="min-w-[180px]" />
                        </div>
                      );
                    })() : <EmptyState icon={Wallet} message="No payment history recorded." />}
                  </div>
                ) : <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">Restricted — finance details are hidden for this role.</div>}
              </section>

              <section className="min-w-0 space-y-4 rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/80 dark:border-slate-700 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 dark:ring-slate-800/80">
                <SectionHeader icon={FileText} label="Academic reports" />
                <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-teal-50/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:from-slate-900 dark:to-slate-950">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">Current learner report</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{drawerLearner.current_grade ?? "Class not assigned"} · {formatDate(drawerLearner.admission_date)}</div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full justify-center bg-teal-600 text-sm font-semibold text-white hover:bg-teal-700 sm:w-auto"
                    onClick={() => window.location.assign("/reports")}
                  >
                    <FileText className="mr-1.5 size-4" /> View report
                  </Button>
                </div>
              </section>
            </div>

            <section className="min-w-0 space-y-4 rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-amber-50/20 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/80 dark:border-slate-700 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 dark:ring-slate-800/80">
              <SectionHeader icon={Flag} label="Notes & flags" />
              <div className="rounded-xl border border-dashed border-slate-200 bg-gradient-to-r from-slate-50 via-slate-50 to-teal-50/40 p-4 text-sm leading-6 text-slate-600 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 dark:text-slate-300">
                <div className="whitespace-pre-wrap break-words text-[15px] leading-7 text-slate-700 dark:text-slate-200">
                  {drawerLearner.medical_alerts?.trim() || drawerLearner.exit_reason || "No notes or flags recorded for this learner."}
                </div>
              </div>
            </section>
          </div>
        )}
      </DetailPanel>
      {/*
                  <FactItem icon={Cake} label="Date of birth" value={formatDate(drawerLearner.date_of_birth)} />
                  <FactItem icon={UserCheck} label="Gender" value={drawerLearner.gender ?? "Not captured"} />
                  <FactItem icon={CalendarDays} label="Admission date" value={formatDate(drawerLearner.admission_date)} />
                  <FactItem icon={FileText} label="UPI" value={drawerLearner.upi_number ?? "UPI not captured"} />
                  <FactItem icon={FileText} label="Assessment number" value={drawerLearner.assessment_number ?? "Not captured"} />
                  <FactItem icon={ShieldAlert} label="Birth certificate" value={drawerLearner.birth_certificate_no ?? "Not captured"} />
                  <FactItem icon={Home} label="Boarding status" value={drawerLearner.boarding_status ?? "Not captured"} />
                  <FactItem icon={BusFront} label="Transport route" value={drawerLearner.transport_route ?? "Not captured"} />
                </div>
              </section>

              {school.can("principal", "deputy", "super_admin", "admin") && (
                <section className="min-w-0 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <SectionHeader icon={Users} label="Parent / guardian information" />
                  {selectedLearnerDetail.data?.guardians.length ? (
                    <div className="space-y-3">
                      {selectedLearnerDetail.data.guardians.map((guardian) => (
                        <div key={guardian.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="font-semibold text-slate-800">{guardian.full_name}</div>
                          <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                            {guardian.relationship}
                          </div>
                          <div className="mt-2 space-y-2 text-sm text-slate-600">
                            {guardian.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="size-4 text-teal-600" />
                                <span>{guardian.phone}</span>
                              </div>
                            )}
                            {guardian.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="size-4 text-teal-600" />
                                <span>{guardian.email}</span>
                              </div>
                            )}
                            {guardian.address && <div>{guardian.address}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={Users} message="No guardian records on file." />
                  )}
                </section>
              )}
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.95fr)]">
              <section className="min-w-0 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <SectionHeader icon={BookOpenCheck} label="Academic history" />
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Attendance trend
                    </div>
                    {selectedLearnerDetail.data?.attendance.length ? (
                      <div className="flex items-end gap-2">
                        {(["present", "late", "absent", "excused"] as const).map((status) => {
                          const count = selectedLearnerDetail.data.attendance.filter(
                            (record) => record.status === status,
                          ).length;
                          return (
                            <div key={status} className="flex flex-1 flex-col items-center gap-2">
                              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                {status[0]}
                              </span>
                              <div className="flex h-16 w-full items-end rounded-lg bg-slate-100 p-1.5">
                                <div
                                  className="w-full rounded-md bg-gradient-to-t from-teal-600 to-cyan-400"
                                  style={{
                                    height: `${Math.max(8, (count / Math.max(1, selectedLearnerDetail.data.attendance.length)) * 100)}%`,
                                  }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-slate-700">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <EmptyState icon={CalendarDays} message="No attendance recorded yet." />
                    )}
                  </div>

                  <div>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Assessment history
                    </div>
                    {selectedLearnerDetail.data?.marks.length ? (
                      <div className="space-y-2.5">
                        {selectedLearnerDetail.data.marks.map((mark) => (
                          <div key={mark.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium text-slate-800">
                                  {mark.assessments?.title ?? "Assessment"}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {mark.assessments?.learning_areas?.name ?? "Subject"}
                                </div>
                              </div>
                              <Badge variant="secondary" className="shrink-0 border-slate-200 bg-white">
                                {mark.is_absent ? "Absent" : mark.is_exempt ? "Exempt" : mark.raw_score ?? "—"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState icon={FileText} message="No assessments recorded yet." />
                    )}
                  </div>
                </div>
              </section>

              {canViewFinance ? (
                <section className="min-w-0 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <SectionHeader icon={Wallet} label="Finance history" />
                  {selectedLearnerDetail.data?.invoices.length || selectedLearnerDetail.data?.payments.length ? (
                    <div className="space-y-3 text-sm text-slate-600">
                      {(() => {
                        const invoiceRows = selectedLearnerDetail.data?.invoices ?? [];
                        const paymentRows = selectedLearnerDetail.data?.payments ?? [];
                        const paidTotal = paymentRows.reduce(
                          (sum: number, payment: any) => sum + Number(payment.amount || 0),
                          0,
                        );
                        const outstandingTotal = invoiceRows.reduce(
                          (sum: number, invoice: any) =>
                            sum + Math.max(0, Number(invoice.total || 0) - Number((paymentRows.filter((payment: any) => payment.invoice_id === invoice.id).reduce((running: number, payment: any) => running + Number(payment.amount || 0), 0) || 0))),
                          0,
                        );
                        const progress = paidTotal + outstandingTotal > 0 ? (paidTotal / (paidTotal + outstandingTotal)) * 100 : 0;

                        return (
                          <>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <div className="mb-3 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                <span className="whitespace-nowrap">Summary</span>
                                <span className="whitespace-nowrap text-slate-700">{Math.round(progress)}% settled</span>
                              </div>
                              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                                <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-600" style={{ width: `${progress}%` }} />
                              </div>
                              <div className="mt-3 grid grid-cols-2 gap-3">
                                <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
                                  <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Paid</div>
                                  <div className="mt-1 whitespace-nowrap text-base font-bold text-teal-700">{formatKES(paidTotal)}</div>
                                </div>
                                <div className="rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200">
                                  <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-amber-700">Outstanding</div>
                                  <div className="mt-1 whitespace-nowrap text-base font-bold text-amber-700">{formatKES(outstandingTotal)}</div>
                                </div>
                              </div>
                            </div>

                            {invoiceRows.map((invoice: any) => {
                              const totalPaid = (paymentRows.filter((payment: any) => payment.invoice_id === invoice.id).reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0) || 0);
                              const outstanding = Math.max(0, Number(invoice.total || 0) - totalPaid);
                              return (
                                <div key={invoice.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-slate-800">{invoice.invoice_number}</span>
                                    <Badge className={`capitalize border ${invoice.status === "paid" ? "border-teal-200 bg-teal-100 text-teal-800" : "border-amber-200 bg-amber-100 text-amber-800"}`}>
                                      {invoice.status ?? "issued"}
                                    </Badge>
                                  </div>
                                  <div className="mt-3 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-slate-500">Bill</span>
                                      <strong className="font-semibold text-slate-800">{formatKES(Number(invoice.total || 0))}</strong>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-slate-500">Paid</span>
                                      <span className="font-medium text-teal-700">{formatKES(totalPaid)}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-slate-500">Outstanding</span>
                                      <span className="font-bold text-amber-700">{formatKES(outstanding)}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <EmptyState icon={Wallet} message="No payment history recorded." />
                  )}
                </section>
              ) : (
                <section className="min-w-0 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <SectionHeader icon={Wallet} label="Finance history" />
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    Restricted — finance details are hidden for this role.
                  </div>
                </section>
              )}
            </div>

                <section className="min-w-0 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          </div>
        )}
      </DetailPanel>
      */}

      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Learners & admissions</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} record{rows.length === 1 ? "" : "s"} shown from the learner register.
          </p>
        </div>
        {school.can("principal", "deputy") && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 size-4" /> Admit learner
              </Button>
            </DialogTrigger>
            <AdmitLearnerDialog
              schoolId={schoolId}
              streams={streams}
              onDone={() => {
                setOpen(false);
                void qc.invalidateQueries({ queryKey: ["learners", schoolId] });
              }}
            />
          </Dialog>
        )}
        </div>

        <div className="surface-soft sticky top-[4.25rem] z-10 flex flex-col gap-3 p-3 md:flex-row md:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name, admission number or UPI…"
            className="bg-card pl-9"
            aria-label="Search by name, admission number or UPI"
          />
        </div>
        <Select
          value={gradeFilter}
          onValueChange={(value) => {
            setGradeFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full bg-card md:w-[170px]" aria-label="Filter by grade">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All grades</SelectItem>
            {school.grades.map((g) => (
              <SelectItem key={g} value={g}>
                {GRADE_LABELS[g]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full bg-card md:w-[150px]" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[
              "all",
              "active",
              "promoted",
              "repeated",
              "transferred_out",
              "withdrawn",
              "suspended",
              "completed",
              "alumni",
            ].map((status) => (
              <SelectItem key={status} value={status} className="capitalize">
                {status === "all" ? "All statuses" : status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
          <RotateCcw className="size-4" /> Reset
        </Button>
        {school.can("principal", "deputy", "super_admin") && selectedLearners.size > 0 && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => bulkDeleteLearners.mutate()}
            disabled={bulkDeleteLearners.isPending}
          >
            <Trash2 className="size-4" /> Delete {selectedLearners.size} selected
          </Button>
        )}
      </div>
      <div className="space-y-3" aria-live="polite">
        {isLoading && (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 size-5 animate-spin" />
            Loading learners…
          </div>
        )}
        {!isLoading && visibleGroups.length === 0 && (
          <div className="rounded-xl border bg-card p-10 text-center">
            <Users className="mx-auto mb-3 size-7 text-muted-foreground" />
            <p className="font-medium">No learners match these filters</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Admit your first learner or relax the grade and status filters.
            </p>
          </div>
        )}
        {!isLoading &&
          visibleGroups.map((group) => {
            const gradeExpanded = expandedGrades[group.grade] ?? false;
            return (
              <section
                key={group.grade}
                className="overflow-hidden rounded-xl border bg-card shadow-sm shadow-primary/5"
              >
                <button
                  type="button"
                  aria-expanded={gradeExpanded}
                  aria-controls={`learners-${group.grade}`}
                  onClick={() =>
                    setExpandedGrades((current) => ({ ...current, [group.grade]: !gradeExpanded }))
                  }
                  className="flex w-full cursor-pointer items-center gap-3 bg-muted/35 px-4 py-3 text-left transition-colors hover:text-primary sm:px-5"
                >
                  <ChevronDown
                    className={cn(
                      "size-5 shrink-0 transition-transform duration-200",
                      !gradeExpanded && "-rotate-90",
                    )}
                  />
                  <span className="text-base font-semibold">{GRADE_LABELS[group.grade]}</span>
                  <Badge variant="secondary">{group.learners.length} learners</Badge>
                </button>
                {gradeExpanded && (
                  <div id={`learners-${group.grade}`} className="space-y-3 p-3 sm:p-4">
                    {group.streams.map(({ stream, learners: streamLearners }) => {
                      const streamExpanded = expandedStreams[stream.id] ?? false;
                      return (
                        <section key={stream.id} className="overflow-hidden rounded-lg border">
                          <button
                            type="button"
                            aria-expanded={streamExpanded}
                            aria-controls={`stream-${stream.id}`}
                            onClick={() =>
                              setExpandedStreams((current) => ({
                                ...current,
                                [stream.id]: !streamExpanded,
                              }))
                            }
                            className="flex w-full cursor-pointer items-center gap-3 bg-background px-3 py-2.5 text-left transition-colors hover:bg-accent/35 sm:px-4"
                          >
                            <ChevronDown
                              className={cn(
                                "size-4 shrink-0 transition-transform duration-200",
                                !streamExpanded && "-rotate-90",
                              )}
                            />
                            <span className="font-medium">{stream.name}</span>
                            <span className="text-sm text-muted-foreground">
                              {streamLearners.length} learners
                              {stream.capacity
                                ? ` · ${streamLearners.length}/${stream.capacity}`
                                : ""}
                            </span>
                          </button>
                          {streamExpanded && (
                            <div id={`stream-${stream.id}`} className="divide-y">
                              {streamLearners.map(renderLearner)}
                            </div>
                          )}
                        </section>
                      );
                    })}
                    {group.unassigned.length > 0 && (
                      <section className="overflow-hidden rounded-lg border">
                        <div className="bg-background px-3 py-2.5 text-sm font-medium sm:px-4">
                          Unassigned stream{" "}
                          <span className="font-normal text-muted-foreground">
                            · {group.unassigned.length} learners
                          </span>
                        </div>
                        <div className="divide-y">{group.unassigned.map(renderLearner)}</div>
                      </section>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        {!isLoading && unassignedGradeLearners.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-amber-500/30 bg-card shadow-sm">
            <div className="flex items-center gap-3 bg-amber-500/10 px-4 py-3 sm:px-5">
              <span className="font-semibold">Unassigned grade</span>
              <Badge variant="outline">{unassignedGradeLearners.length} learners</Badge>
            </div>
            <div className="divide-y">{unassignedGradeLearners.map(renderLearner)}</div>
          </section>
        )}
      </div>
      <div className="text-sm text-muted-foreground">
        <p>
          {isLoading
            ? "Loading…"
            : `${rows.length} record${rows.length === 1 ? "" : "s"} · all grades`}
        </p>
      </div>
      {editing && (
        <Dialog open onOpenChange={(value) => !value && setEditing(null)}>
          <EditLearnerDialog
            learner={editing}
            schoolId={schoolId}
            streams={streams}
            onDone={() => {
              setEditing(null);
              void qc.invalidateQueries({ queryKey: ["learners", schoolId] });
            }}
          />
        </Dialog>
      )}
      {promoting && (
        <Dialog open onOpenChange={(value) => !value && setPromoting(null)}>
          <PromoteLearnerDialog
            learner={promoting}
            schoolId={schoolId}
            streams={streams}
            onDone={() => {
              setPromoting(null);
              void qc.invalidateQueries({ queryKey: ["learners", schoolId] });
            }}
          />
        </Dialog>
      )}
      {certLearner && (
        <LeavingCertificateDialog
          open
          onOpenChange={(value) => !value && setCertLearner(null)}
          learner={{
            id: certLearner.id,
            name: [certLearner.first_name, certLearner.middle_name, certLearner.last_name]
              .filter(Boolean)
              .join(" "),
            admissionNumber: certLearner.admission_number,
            currentGrade: certLearner.current_grade,
            dateOfBirth: certLearner.date_of_birth,
            admissionDate: certLearner.admission_date,
            photoUrl: certLearner.photo_url,
          }}
        />
      )}
    </div>
    </>
  );
}

function SectionHeader({ icon: Icon, label }: { icon: typeof UserRound; label: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
      <div className="rounded-xl bg-slate-900 p-1.5 text-slate-100 shadow-sm ring-1 ring-slate-700">
        <Icon className="size-4" />
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">{label}</div>
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: typeof CalendarDays; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm leading-6 text-slate-500">
      <div className="mb-2 rounded-full bg-white p-2 text-slate-400 shadow-sm ring-1 ring-slate-200">
        <Icon className="size-4" />
      </div>
      {message}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  support,
}: {
  icon: typeof Cake;
  label: string;
  value: string;
  support: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 px-3 py-3 shadow-[0_10px_25px_rgba(15,23,42,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-600">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">
        <Icon className="size-3.5 text-teal-300" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 text-xl font-semibold leading-6 tracking-[-0.02em] text-white">{value}</div>
      <div className="mt-1 text-xs leading-5 text-slate-300">{support}</div>
    </div>
  );
}

function MoneyStat({
  label,
  value,
  tone = "neutral",
  className,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "teal" | "amber";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 w-full overflow-hidden rounded-2xl border px-2.5 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        tone === "amber"
          ? "border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-amber-100"
          : tone === "teal"
            ? "border-teal-200/80 bg-gradient-to-br from-teal-50 via-white to-cyan-50"
            : "border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100",
        className,
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div
        className={cn(
          "mt-2 min-w-0 overflow-hidden text-center text-[12px] font-bold leading-tight tracking-[-0.01em] sm:text-[13px]",
          tone === "amber" ? "text-amber-700" : tone === "teal" ? "text-teal-700" : "text-slate-900",
        )}
      >
        <span className="block truncate whitespace-nowrap">{value}</span>
      </div>
    </div>
  );
}

function FactItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Cake;
  label: string;
  value: string;
}) {
  const isMissing =
    !value ||
    value === "—" ||
    value.toLowerCase().includes("not captured") ||
    value.toLowerCase().includes("not assigned");

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100 p-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-2">
        <div className="rounded-xl bg-slate-900 p-1.5 text-slate-100 shadow-sm ring-1 ring-slate-700">
          <Icon className="size-3.5" />
        </div>
        <div className="text-[10px] font-semibold uppercase leading-relaxed tracking-[0.12em] text-slate-500">{label}</div>
      </div>
      <div
        className={cn(
          "mt-3 break-words text-[15px] font-semibold leading-6 text-slate-900",
          isMissing
            ? "rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 font-medium text-amber-700"
            : "text-slate-900",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function PromoteLearnerDialog({
  learner,
  schoolId,
  streams,
  onDone,
}: {
  learner: LearnerRow;
  schoolId: string;
  streams: { id: string; grade: string; name: string }[];
  onDone: () => void;
}) {
  const school = useSchool();
  const [grade, setGrade] = useState("");
  const [streamId, setStreamId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("Promoted to next class");
  const mutation = useMutation({
    mutationFn: async () => {
      if (!school.academicYearId) {
        throw new Error(
          "No academic year is configured. Create or select the current academic year first.",
        );
      }
      if (!grade) throw new Error("Select the class the learner is being promoted to.");
      if (grade === learner.current_grade && streamId === (learner.current_stream_id ?? "")) {
        throw new Error("Select a different class or stream for promotion.");
      }
      const { error: learnerError } = await supabase
        .from("learners")
        .update({
          current_grade: grade as CbeGrade,
          current_stream_id: streamId || null,
          status: "active",
        })
        .eq("id", learner.id)
        .eq("school_id", schoolId);
      if (learnerError) throw learnerError;

      const { error: legacyHistoryError } = await supabase.from("learner_status_history").insert({
        school_id: schoolId,
        learner_id: learner.id,
        actor_id: school.userId,
        action: "promotion",
        previous_status: learner.status as never,
        new_status: "active" as never,
        previous_grade: learner.current_grade,
        new_grade: grade as CbeGrade,
        previous_stream_id: learner.current_stream_id,
        new_stream_id: streamId || null,
        academic_year_id: school.academicYearId,
        term_id: school.termId,
        effective_date: effectiveDate,
        reason,
      });
      if (legacyHistoryError) throw legacyHistoryError;

      const { error: closeEnrollmentError } = await supabase
        .from("enrollments")
        .update({
          is_active: false,
        })
        .eq("learner_id", learner.id)
        .eq("academic_year_id", school.academicYearId)
        .eq("is_active", true);
      if (closeEnrollmentError) throw closeEnrollmentError;

      const { data: enrollment, error: enrollmentError } = await supabase
        .from("enrollments")
        .insert({
          school_id: schoolId,
          learner_id: learner.id,
          academic_year_id: school.academicYearId,
          term_id: school.termId,
          grade: grade as CbeGrade,
          stream_id: streamId || null,
          boarding_status: learner.boarding_status,
          effective_date: effectiveDate,
        })
        .select("id")
        .single();
      if (enrollmentError) throw enrollmentError;

      const lifecycle = supabase as any;
      const { error: classHistoryError } = await lifecycle.from("student_class_history").insert({
        school_id: schoolId,
        learner_id: learner.id,
        enrollment_id: enrollment.id,
        academic_year_id: school.academicYearId,
        grade,
        stream_id: streamId || null,
        enrollment_date: effectiveDate,
        status: "promoted",
        promotion_status: "promoted",
        movement_reason: reason,
        moved_by: school.userId,
      });
      if (classHistoryError) throw classHistoryError;

      const { error: statusHistoryError } = await lifecycle.from("student_status_history").insert({
        school_id: schoolId,
        learner_id: learner.id,
        previous_status: learner.status,
        new_status: "active",
        effective_date: effectiveDate,
        reason,
        changed_by: school.userId,
      });
      if (statusHistoryError) throw statusHistoryError;

      const { error: auditError } = await supabase.from("audit_logs").insert({
        school_id: schoolId,
        actor_id: school.userId,
        actor_name: school.fullName,
        action: "promote",
        entity: "learner",
        entity_id: learner.id,
        reason,
        before_data: {
          grade: learner.current_grade,
          stream_id: learner.current_stream_id,
          status: learner.status,
        },
        after_data: { grade, stream_id: streamId || null, status: "active" },
      });
      if (auditError) throw auditError;
    },
    onSuccess: () => {
      toast.success("Learner promoted successfully.");
      onDone();
    },
    onError: (error) =>
      toast.error("The learner could not be promoted.", { description: error.message }),
  });
  const gradeStreams = streams.filter((stream) => stream.grade === grade);

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Promote learner</DialogTitle>
        <DialogDescription>
          Choose the next class for {learner.first_name} {learner.last_name}. Personal and admission
          information will not be changed.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          Current class:{" "}
          <span className="font-medium">{learner.current_grade ?? "Not assigned"}</span>
        </div>
        <Field label="Promote to class *">
          <Select
            value={grade}
            onValueChange={(value) => {
              setGrade(value);
              setStreamId("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select next class" />
            </SelectTrigger>
            <SelectContent>
              {school.grades.map((item) => (
                <SelectItem key={item} value={item}>
                  {GRADE_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Stream">
          <Select value={streamId} onValueChange={setStreamId} disabled={!gradeStreams.length}>
            <SelectTrigger>
              <SelectValue
                placeholder={gradeStreams.length ? "Select stream" : "No streams for this class"}
              />
            </SelectTrigger>
            <SelectContent>
              {gradeStreams.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Effective date">
          <Input
            type="date"
            value={effectiveDate}
            onChange={(event) => setEffectiveDate(event.target.value)}
          />
        </Field>
        <Field label="Promotion reason">
          <Input value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </div>
      <DialogFooter>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? "Promoting…" : "Confirm promotion"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function EditLearnerDialog({
  learner,
  schoolId,
  streams,
  onDone,
}: {
  learner: LearnerRow;
  schoolId: string;
  streams: { id: string; grade: string; name: string }[];
  onDone: () => void;
}) {
  const school = useSchool();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    first_name: learner.first_name,
    middle_name: learner.middle_name ?? "",
    last_name: learner.last_name,
    gender: learner.gender ?? "",
    current_grade: learner.current_grade ?? "",
    current_stream_id: learner.current_stream_id ?? "",
    date_of_birth: learner.date_of_birth ?? "",
    assessment_number: learner.assessment_number ?? "",
    birth_certificate_no: learner.birth_certificate_no ?? "",
    boarding_status: learner.boarding_status ?? "day",
    transport_route: learner.transport_route ?? "",
    medical_alerts: learner.medical_alerts ?? "",
    emergency_contact_name: learner.emergency_contact_name ?? "",
    emergency_contact_phone: learner.emergency_contact_phone ?? "",
    exit_date: learner.exit_date ?? "",
    exit_reason: learner.exit_reason ?? "",
    status: learner.status,
    photo_url: learner.photo_url ?? "",
  });
  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const mutation = useMutation({
    mutationFn: async () => {
      const nextGrade = form.current_grade as CbeGrade;
      const gradeChanged = nextGrade !== learner.current_grade;
      const streamChanged = (form.current_stream_id || null) !== learner.current_stream_id;
      const statusChanged = form.status !== learner.status;
      if ((gradeChanged || streamChanged) && !school.academicYearId) {
        throw new Error(
          "No academic year is configured. Create or select the current academic year before changing a learner's class.",
        );
      }
      const { error } = await supabase
        .from("learners")
        .update({
          first_name: form.first_name.trim(),
          middle_name: form.middle_name.trim() || null,
          last_name: form.last_name.trim(),
          gender: form.gender || null,
          current_grade: nextGrade,
          current_stream_id: form.current_stream_id || null,
          date_of_birth: form.date_of_birth || null,
          assessment_number: form.assessment_number.trim() || null,
          birth_certificate_no: form.birth_certificate_no.trim() || null,
          boarding_status: form.boarding_status,
          transport_route: form.transport_route.trim() || null,
          medical_alerts: form.medical_alerts.trim() || null,
          emergency_contact_name: form.emergency_contact_name.trim() || null,
          emergency_contact_phone: form.emergency_contact_phone.trim() || null,
          exit_date: form.exit_date || null,
          exit_reason: form.exit_reason.trim() || null,
          status: form.status,
          photo_url: form.photo_url || null,
        })
        .eq("id", learner.id)
        .eq("school_id", schoolId);
      if (error) throw error;
      if (gradeChanged || streamChanged || statusChanged) {
        const { error: historyError } = await supabase.from("learner_status_history").insert({
          school_id: schoolId,
          learner_id: learner.id,
          actor_id: school.userId,
          action: statusChanged ? "status_change" : "promotion_or_transfer",
          previous_status: learner.status as never,
          new_status: form.status as never,
          previous_grade: learner.current_grade,
          new_grade: nextGrade,
          previous_stream_id: learner.current_stream_id,
          new_stream_id: form.current_stream_id || null,
          academic_year_id: school.academicYearId,
          term_id: school.termId,
          reason: statusChanged ? `Status changed to ${form.status}` : "Class placement updated",
        });
        if (historyError) throw historyError;
      }
      if (gradeChanged || streamChanged) {
        const { error: enrollmentUpdateError } = await supabase
          .from("enrollments")
          .update({ is_active: false })
          .eq("learner_id", learner.id)
          .eq("academic_year_id", school.academicYearId)
          .eq("is_active", true);
        if (enrollmentUpdateError) throw enrollmentUpdateError;
        const { data: newEnrollment, error: enrollmentInsertError } = await supabase
          .from("enrollments")
          .insert({
            school_id: schoolId,
            learner_id: learner.id,
            academic_year_id: school.academicYearId!,
            term_id: school.termId,
            grade: nextGrade,
            stream_id: form.current_stream_id || null,
            boarding_status: form.boarding_status,
          })
          .select("id")
          .single();
        if (enrollmentInsertError) throw enrollmentInsertError;
        const lifecycle = supabase as any;
        const { error: classHistoryError } = await lifecycle.from("student_class_history").insert({
          school_id: schoolId,
          learner_id: learner.id,
          enrollment_id: newEnrollment?.id,
          academic_year_id: school.academicYearId,
          grade: nextGrade,
          stream_id: form.current_stream_id || null,
          enrollment_date: new Date().toISOString().slice(0, 10),
          movement_reason: "Class or stream placement updated",
          moved_by: school.userId,
        });
        if (classHistoryError) throw classHistoryError;
      }
      if (["G10", "G11", "G12"].includes(nextGrade)) {
        const hasExistingPathway = seniorSchoolPathwayQuery.data?.assignment;
        const pathwayPayload = {
          school_id: schoolId,
          learner_id: learner.id,
          academic_year_id: school.academicYearId,
          grade: nextGrade,
          pathway_id: pathwayForm.pathway_id || null,
          track_id: pathwayForm.track_id || null,
          strand_id: pathwayForm.strand_id || null,
          subject_combination_id: pathwayForm.subject_combination_id || null,
          status: "current",
          approved_by: school.userId,
          approved_at: new Date().toISOString(),
          change_reason: "Profile update",
        };
        if (hasExistingPathway) {
          const { error: pathwayUpdateError } = await supabase
            .from("student_pathway_assignments")
            .update({
              ...pathwayPayload,
              approved_by: school.userId,
              approved_at: new Date().toISOString(),
              change_reason: "Profile update",
            })
            .eq("id", hasExistingPathway.id)
            .eq("school_id", schoolId);
          if (pathwayUpdateError) throw pathwayUpdateError;
        } else {
          const { error: pathwayInsertError } = await supabase
            .from("student_pathway_assignments")
            .insert(pathwayPayload);
          if (pathwayInsertError) throw pathwayInsertError;
        }
        const { error: learnerPathwayError } = await supabase
          .from("learners")
          .update({
            senior_school_pathway_id: pathwayForm.pathway_id || null,
            senior_school_track_id: pathwayForm.track_id || null,
            senior_school_combination_id: pathwayForm.subject_combination_id || null,
            pathway_selection_status: "approved",
            pathway_selected_at: new Date().toISOString(),
          })
          .eq("id", learner.id)
          .eq("school_id", schoolId);
        if (learnerPathwayError) throw learnerPathwayError;
      }
      if (statusChanged) {
        const lifecycle = supabase as any;
        const { error: statusHistoryError } = await lifecycle
          .from("student_status_history")
          .insert({
            school_id: schoolId,
            learner_id: learner.id,
            previous_status: learner.status,
            new_status: form.status,
            effective_date: new Date().toISOString().slice(0, 10),
            reason: `Status changed to ${form.status}`,
            changed_by: school.userId,
          });
        if (statusHistoryError) throw statusHistoryError;
      }
      await supabase.from("audit_logs").insert({
        school_id: schoolId,
        actor_id: school.userId,
        actor_name: school.fullName,
        action: "update",
        entity: "learner",
        entity_id: learner.id,
        before_data: {
          first_name: learner.first_name,
          last_name: learner.last_name,
          grade: learner.current_grade,
          status: learner.status,
        },
        after_data: {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          grade: form.current_grade,
          status: form.status,
        },
        reason: "Learner profile or placement updated",
      });
    },
    onSuccess: () => {
      toast.success("Learner updated successfully.");
      void qc.invalidateQueries({ queryKey: ["learners", schoolId] });
      void qc.invalidateQueries({ queryKey: ["learner-detail-drawer", schoolId, learner.id] });
      onDone();
    },
    onError: (error) =>
      toast.error("The learner could not be updated.", { description: error.message }),
  });
  const gradeStreams = streams.filter((stream) => stream.grade === form.current_grade);

  const seniorSchoolPathwayQuery = useQuery({
    queryKey: ["learner-senior-pathway-config", schoolId],
    enabled: ["G10", "G11", "G12"].includes(form.current_grade),
    queryFn: async () => {
      const [pathways, tracks, strands, combinations, assignment] = await Promise.all([
        supabase
          .from("senior_pathways")
          .select("id, name, code")
          .eq("school_id", schoolId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("pathway_tracks")
          .select("id, pathway_id, name, code")
          .eq("school_id", schoolId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("pathway_strands")
          .select("id, track_id, name, code")
          .eq("school_id", schoolId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("subject_combinations")
          .select("id, pathway_id, track_id, name, code")
          .eq("school_id", schoolId)
          .eq("status", "active")
          .order("name"),
        supabase
          .from("student_pathway_assignments")
          .select(
            "id, pathway_id, track_id, strand_id, subject_combination_id, grade, status",
          )
          .eq("school_id", schoolId)
          .eq("learner_id", learner.id)
          .eq("status", "current")
          .maybeSingle(),
      ]);
      if (pathways.error) throw pathways.error;
      if (tracks.error) throw tracks.error;
      if (strands.error) throw strands.error;
      if (combinations.error) throw combinations.error;
      if (assignment.error && assignment.error.code !== "PGRST116") throw assignment.error;
      return {
        pathways: pathways.data ?? [],
        tracks: tracks.data ?? [],
        strands: strands.data ?? [],
        combinations: combinations.data ?? [],
        assignment: assignment.data ?? null,
      };
    },
  });

  const [pathwayForm, setPathwayForm] = useState({
    pathway_id: "",
    track_id: "",
    strand_id: "",
    subject_combination_id: "",
  });

  useEffect(() => {
    if (!seniorSchoolPathwayQuery.data) return;
    const assignment = seniorSchoolPathwayQuery.data.assignment;
    const nextForm = {
      pathway_id: assignment?.pathway_id ?? "",
      track_id: assignment?.track_id ?? "",
      strand_id: assignment?.strand_id ?? "",
      subject_combination_id: assignment?.subject_combination_id ?? "",
    };
    setPathwayForm(nextForm);
  }, [seniorSchoolPathwayQuery.data]);

  const visibleTracks = (seniorSchoolPathwayQuery.data?.tracks ?? []).filter(
    (track) => track.pathway_id === pathwayForm.pathway_id,
  );
  const visibleStrands = (seniorSchoolPathwayQuery.data?.strands ?? []).filter(
    (strand) => strand.track_id === pathwayForm.track_id,
  );
  const visibleCombinations = (seniorSchoolPathwayQuery.data?.combinations ?? []).filter(
    (combination) =>
      combination.pathway_id === pathwayForm.pathway_id &&
      combination.track_id === pathwayForm.track_id,
  );

  function submit() {
    if (
      form.first_name.trim().length < 2 ||
      form.last_name.trim().length < 2 ||
      !form.current_grade
    ) {
      toast.warning("Enter the learner name and select a grade.");
      return;
    }
    if (["G10", "G11", "G12"].includes(form.current_grade)) {
      if (!pathwayForm.pathway_id) {
        toast.warning("Select the learner's senior pathway before saving.");
        return;
      }
      if (!pathwayForm.subject_combination_id) {
        toast.warning("Select the learner's subject combination before saving.");
        return;
      }
    }
    mutation.mutate();
  }
  return (
    <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col gap-0 p-0 sm:max-w-3xl">
      <DialogHeader className="border-b bg-muted/20 px-6 py-5 pr-12">
        <DialogTitle>Edit learner</DialogTitle>
        <DialogDescription>
          Update the learner profile, placement and school lifecycle details.
        </DialogDescription>
      </DialogHeader>
      <div className="grid min-h-0 flex-1 gap-x-5 gap-y-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
        <div className="sm:col-span-2 flex justify-center pb-1">
          <PhotoUploader
            value={form.photo_url}
            name={`${form.first_name} ${form.last_name}`}
            onChange={(url) => set("photo_url", url ?? "")}
          />
        </div>
        <div className="sm:col-span-2 border-b pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Identity and registration
        </div>
        <Field label="First name *">
          <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
        </Field>
        <Field label="Middle name">
          <Input value={form.middle_name} onChange={(e) => set("middle_name", e.target.value)} />
        </Field>
        <Field label="Surname *">
          <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
        </Field>
        <Field label="Gender">
          <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="male">Male</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Date of birth">
          <Input
            type="date"
            value={form.date_of_birth}
            onChange={(e) => set("date_of_birth", e.target.value)}
          />
        </Field>
        <Field label="Assessment number">
          <Input
            value={form.assessment_number}
            onChange={(e) => set("assessment_number", e.target.value)}
          />
        </Field>
        <Field label="Birth certificate number">
          <Input
            value={form.birth_certificate_no}
            onChange={(e) => set("birth_certificate_no", e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2 border-b pb-2 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Placement and wellbeing
        </div>
        <Field label="Grade *">
          <Select
            value={form.current_grade}
            onValueChange={(v) => {
              set("current_grade", v);
              set("current_stream_id", "");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select grade" />
            </SelectTrigger>
            <SelectContent>
              {school.grades.map((grade) => (
                <SelectItem key={grade} value={grade}>
                  {GRADE_LABELS[grade]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Stream">
          <Select value={form.current_stream_id} onValueChange={(v) => set("current_stream_id", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select stream" />
            </SelectTrigger>
            <SelectContent>
              {gradeStreams.map((stream) => (
                <SelectItem key={stream.id} value={stream.id}>
                  {stream.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Status">
          <Select value={form.status} onValueChange={(v) => set("status", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                "active",
                "promoted",
                "repeated",
                "transferred_out",
                "withdrawn",
                "suspended",
                "completed",
                "alumni",
              ].map((status) => (
                <SelectItem key={status} value={status} className="capitalize">
                  {status.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {[
          "G10",
          "G11",
          "G12",
        ].includes(form.current_grade) && (
          <>
            <div className="sm:col-span-2 rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-700">
                  Senior school pathway
                </span>
                <Badge className="border-teal-200 bg-white text-teal-700 hover:bg-white">
                  {form.current_grade}
                </Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Pathway">
                  <Select
                    value={pathwayForm.pathway_id}
                    onValueChange={(value) => {
                      setPathwayForm((current) => ({
                        ...current,
                        pathway_id: value,
                        track_id: "",
                        strand_id: "",
                        subject_combination_id: "",
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select pathway" />
                    </SelectTrigger>
                    <SelectContent>
                      {(seniorSchoolPathwayQuery.data?.pathways ?? []).map((pathway) => (
                        <SelectItem key={pathway.id} value={pathway.id}>
                          {pathway.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Track">
                  <Select
                    value={pathwayForm.track_id}
                    onValueChange={(value) => {
                      setPathwayForm((current) => ({
                        ...current,
                        track_id: value,
                        strand_id: "",
                        subject_combination_id: "",
                      }));
                    }}
                    disabled={!visibleTracks.length}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select track" />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleTracks.map((track) => (
                        <SelectItem key={track.id} value={track.id}>
                          {track.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Strand">
                  <Select
                    value={pathwayForm.strand_id}
                    onValueChange={(value) =>
                      setPathwayForm((current) => ({ ...current, strand_id: value }))
                    }
                    disabled={!visibleStrands.length}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select strand" />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleStrands.map((strand) => (
                        <SelectItem key={strand.id} value={strand.id}>
                          {strand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Subject combination">
                  <Select
                    value={pathwayForm.subject_combination_id}
                    onValueChange={(value) =>
                      setPathwayForm((current) => ({ ...current, subject_combination_id: value }))
                    }
                    disabled={!visibleCombinations.length}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select combination" />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleCombinations.map((combination) => (
                        <SelectItem key={combination.id} value={combination.id}>
                          {combination.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          </>
        )}
        <Field label="Boarding status">
          <Select value={form.boarding_status} onValueChange={(v) => set("boarding_status", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="boarding">Boarding</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Transport route">
          <Input
            value={form.transport_route}
            onChange={(e) => set("transport_route", e.target.value)}
          />
        </Field>
        <Field label="Emergency contact">
          <Input
            value={form.emergency_contact_name}
            onChange={(e) => set("emergency_contact_name", e.target.value)}
          />
        </Field>
        <Field label="Emergency phone">
          <Input
            value={form.emergency_contact_phone}
            onChange={(e) => set("emergency_contact_phone", e.target.value)}
          />
        </Field>
        <Field label="Medical alerts" className="sm:col-span-2">
          <Input
            value={form.medical_alerts}
            onChange={(e) => set("medical_alerts", e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2 border-b pb-2 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Lifecycle and exit record
        </div>
        {["transferred_out", "withdrawn", "suspended", "completed", "alumni"].includes(
          form.status,
        ) && (
          <>
            <Field label="Exit / effective date">
              <Input
                type="date"
                value={form.exit_date}
                onChange={(e) => set("exit_date", e.target.value)}
              />
            </Field>
            <Field label="Reason" className="sm:col-span-2">
              <Input
                value={form.exit_reason}
                onChange={(e) => set("exit_reason", e.target.value)}
              />
            </Field>
          </>
        )}
      </div>
      <DialogFooter className="border-t bg-muted/20 px-6 py-4">
        <Button onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function AdmitLearnerDialog({
  schoolId,
  streams,
  onDone,
}: {
  schoolId: string;
  streams: { id: string; grade: string; name: string }[];
  onDone: () => void;
}) {
  const school = useSchool();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    gender: "",
    date_of_birth: "",
    upi_number: "",
    current_grade: "",
    current_stream_id: "",
    boarding_status: "day",
    admission_date: new Date().toISOString().slice(0, 10),
    guardian_name: "",
    guardian_phone: "",
    guardian_relationship: "Parent",
    photo_url: "",
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: admissionNumber, error: numErr } = await supabase.rpc("next_admission_number", {
        _school_id: schoolId,
      });
      if (numErr) throw numErr;

      const { data: learner, error } = await supabase
        .from("learners")
        .insert({
          school_id: schoolId,
          admission_number: admissionNumber as string,
          first_name: form.first_name.trim(),
          middle_name: form.middle_name.trim() || null,
          last_name: form.last_name.trim(),
          gender: form.gender || null,
          date_of_birth: form.date_of_birth || null,
          upi_number: form.upi_number.trim() || null,
          current_grade: form.current_grade as CbeGrade,
          current_stream_id: form.current_stream_id || null,
          boarding_status: form.boarding_status,
          admission_date: form.admission_date,
          photo_url: form.photo_url || null,
        })
        .select("id, admission_number")
        .single();
      if (error || !learner) throw error ?? new Error("Learner could not be admitted.");

      const { error: historyError } = await supabase.from("learner_status_history").insert({
        school_id: schoolId,
        learner_id: learner.id,
        actor_id: school.userId,
        action: "admitted",
        new_status: "active" as never,
        new_grade: form.current_grade as CbeGrade,
        new_stream_id: form.current_stream_id || null,
        academic_year_id: school.academicYearId,
        term_id: school.termId,
        effective_date: form.admission_date,
        reason: "Learner admitted to school",
      });
      if (historyError) throw historyError;
      const lifecycle = supabase as any;
      const { error: lifecycleError } = await lifecycle.from("student_status_history").insert({
        school_id: schoolId,
        learner_id: learner.id,
        new_status: "active",
        effective_date: form.admission_date,
        reason: "Learner admitted to school",
        changed_by: school.userId,
      });
      if (lifecycleError) throw lifecycleError;

      if (form.guardian_name.trim()) {
        const { data: guardian } = await supabase
          .from("guardians")
          .insert({
            school_id: schoolId,
            full_name: form.guardian_name.trim(),
            phone: form.guardian_phone ? normalizeKePhone(form.guardian_phone) : null,
            relationship: form.guardian_relationship,
          })
          .select("id")
          .single();
        if (guardian) {
          await supabase.from("learner_guardians").insert({
            school_id: schoolId,
            learner_id: learner.id,
            guardian_id: guardian.id,
            relationship: form.guardian_relationship,
            is_primary: true,
          });
        }
      }

      if (school.academicYearId) {
        const { data: enrollment } = await supabase
          .from("enrollments")
          .insert({
            school_id: schoolId,
            learner_id: learner.id,
            academic_year_id: school.academicYearId,
            term_id: school.termId,
            grade: form.current_grade as CbeGrade,
            stream_id: form.current_stream_id || null,
            boarding_status: form.boarding_status,
          })
          .select("id")
          .single();
        const lifecycle = supabase as any;
        await lifecycle.from("student_class_history").insert({
          school_id: schoolId,
          learner_id: learner.id,
          enrollment_id: enrollment?.id,
          academic_year_id: school.academicYearId,
          grade: form.current_grade as CbeGrade,
          stream_id: form.current_stream_id || null,
          enrollment_date: form.admission_date,
          movement_reason: "Initial admission",
          moved_by: school.userId,
        });
      }

      await supabase.from("audit_logs").insert({
        school_id: schoolId,
        actor_id: school.userId,
        actor_name: school.fullName,
        action: "create",
        entity: "learner",
        entity_id: learner.id,
        after_data: { admission_number: learner.admission_number, grade: form.current_grade },
      });

      return learner;
    },
    onSuccess: (learner) => {
      toast.success("Learner admitted successfully.", {
        description: `Admission number ${learner.admission_number}.`,
      });
      onDone();
    },
    onError: () => {
      toast.error("The learner could not be admitted.", {
        description: "Please check the details and try again.",
      });
    },
  });

  function submit() {
    const e: Record<string, string> = {};
    if (form.first_name.trim().length < 2) e["first_name"] = "Enter the learner's first name.";
    if (form.last_name.trim().length < 2) e["last_name"] = "Enter the learner's surname.";
    if (!form.current_grade) e["current_grade"] = "Select the grade of admission.";
    if (form.guardian_phone && !KE_PHONE_REGEX.test(form.guardian_phone.replace(/\s/g, "")))
      e["guardian_phone"] = "Enter a valid Kenyan phone number.";
    setErrors(e);
    if (Object.keys(e).length) {
      toast.warning("Please correct the highlighted fields.");
      return;
    }
    mutation.mutate();
  }

  const gradeStreams = streams.filter((s) => s.grade === form.current_grade);

  return (
    <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col gap-0 p-0 sm:max-w-3xl">
      <DialogHeader className="border-b bg-muted/20 px-6 py-5 pr-12">
        <DialogTitle>Admit a new learner</DialogTitle>
        <DialogDescription>
          The admission number is generated automatically using your school's format.
        </DialogDescription>
      </DialogHeader>

      <div className="grid min-h-0 flex-1 gap-x-5 gap-y-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
        <div className="sm:col-span-2 flex justify-center pb-1">
          <PhotoUploader
            value={form.photo_url}
            name={`${form.first_name || "New"} ${form.last_name || "Learner"}`}
            onChange={(url) => set("photo_url", url ?? "")}
          />
        </div>
        <div className="sm:col-span-2 border-b pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Learner identity
        </div>
        <Field label="First name *" error={errors["first_name"]}>
          <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
        </Field>
        <Field label="Middle name">
          <Input value={form.middle_name} onChange={(e) => set("middle_name", e.target.value)} />
        </Field>
        <Field label="Surname *" error={errors["last_name"]}>
          <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
        </Field>
        <Field label="Gender">
          <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="male">Male</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Date of birth">
          <Input
            type="date"
            value={form.date_of_birth}
            onChange={(e) => set("date_of_birth", e.target.value)}
          />
        </Field>
        <Field label="UPI number">
          <Input value={form.upi_number} onChange={(e) => set("upi_number", e.target.value)} />
        </Field>
        <Field label="Grade of admission *" error={errors["current_grade"]}>
          <Select
            value={form.current_grade}
            onValueChange={(v) => {
              set("current_grade", v);
              set("current_stream_id", "");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select grade" />
            </SelectTrigger>
            <SelectContent>
              {school.grades.map((g) => (
                <SelectItem key={g} value={g}>
                  {GRADE_LABELS[g]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Stream">
          <Select
            value={form.current_stream_id}
            onValueChange={(v) => set("current_stream_id", v)}
            disabled={gradeStreams.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={gradeStreams.length ? "Select stream" : "No streams for this grade"}
              />
            </SelectTrigger>
            <SelectContent>
              {gradeStreams.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Boarding status">
          <Select value={form.boarding_status} onValueChange={(v) => set("boarding_status", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="boarding">Boarding</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="sm:col-span-2 border-b pb-2 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Admission and guardian details
        </div>
        <Field label="Admission date">
          <Input
            type="date"
            value={form.admission_date}
            onChange={(e) => set("admission_date", e.target.value)}
          />
        </Field>
        <Field label="Primary guardian name" className="sm:col-span-2">
          <Input
            value={form.guardian_name}
            onChange={(e) => set("guardian_name", e.target.value)}
          />
        </Field>
        <Field label="Guardian phone" error={errors["guardian_phone"]}>
          <Input
            value={form.guardian_phone}
            onChange={(e) => set("guardian_phone", e.target.value)}
            placeholder="0712345678"
          />
        </Field>
        <Field label="Relationship">
          <Input
            value={form.guardian_relationship}
            onChange={(e) => set("guardian_relationship", e.target.value)}
          />
        </Field>
      </div>

      <DialogFooter className="border-t bg-muted/20 px-6 py-4">
        <Button onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" /> Admitting…
            </>
          ) : (
            "Admit learner"
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function LearnerHistoryAction({ learner, schoolId }: { learner: LearnerRow; schoolId: string }) {
  const history = useQuery({
    queryKey: ["learner-history", schoolId, learner.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learner_status_history")
        .select(
          "id, action, previous_status, new_status, previous_grade, new_grade, reason, effective_date",
        )
        .eq("school_id", schoolId)
        .eq("learner_id", learner.id)
        .order("effective_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LearnerHistoryRow[];
    },
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
          <History className="mr-2 size-4" /> View history
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Learning journey</DialogTitle>
          <DialogDescription>
            {learner.first_name} {learner.last_name} · admission {learner.admission_number}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-3 overflow-y-auto">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium">Current placement</p>
            <p className="text-muted-foreground">
              {learner.current_grade ?? "No grade"} · {learner.status.replace("_", " ")}
            </p>
          </div>
          {(history.data ?? []).map((entry) => (
            <div key={entry.id} className="border-l-2 border-primary/40 pl-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-medium capitalize">{entry.action.replaceAll("_", " ")}</p>
                <time className="text-xs text-muted-foreground">
                  {formatDate(entry.effective_date)}
                </time>
              </div>
              <p className="text-muted-foreground">
                {entry.previous_grade ?? "—"} → {entry.new_grade ?? "—"}
                {entry.previous_status || entry.new_status
                  ? ` · ${entry.previous_status ?? "—"} → ${entry.new_status ?? "—"}`
                  : ""}
              </p>
              {entry.reason && <p className="mt-1">{entry.reason}</p>}
            </div>
          ))}
          {!history.isLoading && !history.data?.length && (
            <p className="text-sm text-muted-foreground">
              No placement or status changes recorded yet.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
