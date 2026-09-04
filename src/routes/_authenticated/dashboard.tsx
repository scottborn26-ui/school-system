import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  ArrowRight,
  BarChart3,
  BookOpen,
  Calendar,
  CalendarCheck2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  ClipboardCheck,
  ClipboardList,
  CircleAlert,
  FileBarChart,
  FileText,
  GraduationCap,
  Layers,
  Lock,
  Megaphone,
  Plus,
  School,
  UserPlus,
  Users,
  WalletCards,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { RequireSchool } from "@/components/require-school";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useSchool } from "@/hooks/use-school";
import { GRADE_LABELS, GRADE_LEVEL, LEVEL_GRADES, LEVEL_LABELS, type CbeLevel } from "@/lib/cbe";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · SHANSCOTT CBE School Management" },
      {
        name: "description",
        content:
          "Live school overview: learner enrolment by CBE grade, staff strength and streams for Kenyan CBE schools.",
      },
      { property: "og:title", content: "Dashboard · SHANSCOTT CBE" },
      {
        property: "og:description",
        content: "Live enrolment, staffing and stream overview for your Kenyan CBE school.",
      },
    ],
  }),
  component: () => (
    <RequireSchool>
      <DashboardPage />
    </RequireSchool>
  ),
});

function DashboardPage() {
  const school = useSchool();
  return school.activeRole === "exam_officer" ? <ExamOfficerDashboard /> : <SchoolDashboardPage />;
}

function SchoolDashboardPage() {
  const school = useSchool();
  const schoolId = school.schoolId!;
  const [activityPage, setActivityPage] = useState(1);
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const monthStart = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEndDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
  const monthEnd = monthEndDate.toISOString().slice(0, 10);
  const currentTerm = school.terms.find((term) => term.id === school.termId);
  const previousTermId = school.terms.find(
    (term) => term.term_number === (currentTerm?.term_number ?? 1) - 1,
  )?.id;
  const isTeacherDashboard =
    school.can("teacher", "class_teacher") &&
    !school.can("principal", "deputy", "super_admin", "admin");
  const [selectedTeacherStream, setSelectedTeacherStream] = useState("");

  const teacherStreamIds = useQuery({
    queryKey: ["teacher-dashboard-streams", schoolId, school.userId],
    enabled: isTeacherDashboard,
    staleTime: 60 * 1000,
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

  useEffect(() => {
    if (!isTeacherDashboard || !teacherStreamIds.data?.length) return;
    if (!selectedTeacherStream || !teacherStreamIds.data.includes(selectedTeacherStream)) {
      setSelectedTeacherStream(teacherStreamIds.data[0]);
    }
  }, [isTeacherDashboard, selectedTeacherStream, teacherStreamIds.data]);

  const teacherStreamMap = useQuery({
    queryKey: ["teacher-dashboard-stream-map", schoolId, teacherStreamIds.data?.join(",") ?? ""],
    enabled: isTeacherDashboard && Boolean(teacherStreamIds.data?.length),
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (!teacherStreamIds.data?.length)
        return [] as Array<{ id: string; grade: string; name: string }>;
      const { data, error } = await supabase
        .from("streams")
        .select("id, grade, name")
        .in("id", teacherStreamIds.data)
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("grade")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const feeSummary = useQuery({
    queryKey: ["dashboard-fees", schoolId, school.termId],
    enabled: Boolean(school.termId) && !isTeacherDashboard,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const [learners, invoices, payments, previousPayments, feeItems] = await Promise.all([
        supabase
          .from("learners")
          .select("id, current_grade, status")
          .eq("school_id", schoolId)
          .eq("is_archived", false),
        supabase
          .from("invoices")
          .select("total, term_id, due_date, issue_date, learner_id, status")
          .eq("school_id", schoolId),
        supabase
          .from("payments")
          .select("amount, term_id, is_reversed, paid_at, learner_id")
          .eq("school_id", schoolId),
        supabase
          .from("payments")
          .select("amount, term_id, is_reversed")
          .eq("school_id", schoolId)
          .eq("term_id", previousTermId ?? "00000000-0000-0000-0000-000000000000"),
        supabase
          .from("fee_items")
          .select("amount, grade, term_id, is_active")
          .eq("school_id", schoolId)
          .eq("is_active", true),
      ]);
      for (const result of [learners, invoices, payments, previousPayments, feeItems]) {
        if (result.error) throw result.error;
      }
      return {
        learners: learners.data ?? [],
        invoices: invoices.data ?? [],
        payments: payments.data ?? [],
        previousPayments: previousPayments.data ?? [],
        feeItems: feeItems.data ?? [],
      };
    },
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [
      "dashboard",
      schoolId,
      school.termId,
      monthStart,
      isTeacherDashboard ? (teacherStreamIds.data?.join(",") ?? "none") : "all",
      isTeacherDashboard ? selectedTeacherStream : "all",
    ],
    enabled: Boolean(school.termId) && (!isTeacherDashboard || teacherStreamIds.isFetched),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const teacherScopedStreamIds = isTeacherDashboard ? (teacherStreamIds.data ?? []) : [];
      const baseLearnersQuery = supabase
        .from("learners")
        .select("id, gender, current_grade, status, current_stream_id")
        .eq("school_id", schoolId)
        .eq("is_archived", false);
      const learnersQuery = isTeacherDashboard
        ? baseLearnersQuery.in("current_stream_id", teacherScopedStreamIds)
        : baseLearnersQuery;

      const [
        learners,
        staff,
        streams,
        attendance,
        events,
        calendarEvents,
        assignmentsResult,
        pathwaysResult,
      ] = await Promise.all([
        learnersQuery,
        supabase
          .from("staff")
          .select("id, status")
          .eq("school_id", schoolId)
          .eq("is_archived", false),
        supabase
          .from("streams")
          .select("id, grade, name, capacity")
          .eq("school_id", schoolId)
          .eq("is_active", true),
        (() => {
          const attendanceQuery = supabase
            .from("attendance_records")
            .select("status, attendance_date, stream_id")
            .eq("school_id", schoolId)
            .gte("attendance_date", weekStart)
            .lte("attendance_date", today);
          return isTeacherDashboard
            ? attendanceQuery.in("stream_id", teacherScopedStreamIds)
            : attendanceQuery;
        })(),
        supabase
          .from("academic_calendar_events")
          .select("id, title, start_date, end_date, all_day, event_type, image_url")
          .eq("school_id", schoolId)
          .gte("start_date", today)
          .lte("start_date", weekEnd)
          .order("start_date")
          .limit(4),
        supabase
          .from("academic_calendar_events")
          .select("id, title, start_date, end_date, all_day, event_type, image_url")
          .eq("school_id", schoolId)
          .gte("start_date", monthStart)
          .lte("start_date", monthEnd)
          .order("start_date"),
        isTeacherDashboard
          ? Promise.resolve({ data: [], error: null })
          : (supabase as unknown as { from: (table: string) => any })
              .from("student_pathway_assignments")
              .select("pathway_id")
              .eq("school_id", schoolId)
              .eq("status", "current"),
        isTeacherDashboard
          ? Promise.resolve({ data: [], error: null })
          : (supabase as unknown as { from: (table: string) => any })
              .from("senior_pathways")
              .select("id, name")
              .eq("school_id", schoolId)
              .eq("is_active", true)
              .order("name"),
      ]);
      if (learners.error) throw learners.error;
      if (staff.error) throw staff.error;
      if (streams.error) throw streams.error;
      return {
        learners: learners.data ?? [],
        staff: staff.data ?? [],
        streams: streams.data ?? [],
        attendance: attendance.error ? [] : (attendance.data ?? []),
        events: events.error ? [] : (events.data ?? []),
        calendarEvents: calendarEvents.error ? [] : (calendarEvents.data ?? []),
        assignments: assignmentsResult.data ?? [],
        pathways: pathwaysResult.data ?? [],
      };
    },
  });

  const learners = data?.learners ?? [];
  const active = learners.filter((learner) => learner.status === "active");
  const offeredGrades = school.grades;
  const byGrade = offeredGrades.map((grade) => ({
    grade,
    count: active.filter((learner) => learner.current_grade === grade).length,
  }));
  const enrolledOffered = byGrade.reduce((total, bar) => total + bar.count, 0);
  const maxGrade = Math.max(1, ...byGrade.map((bar) => bar.count));
  const gradeGroups = (Object.keys(LEVEL_GRADES) as CbeLevel[])
    .map((level) => ({ level, grades: byGrade.filter((bar) => GRADE_LEVEL[bar.grade] === level) }))
    .filter((group) => group.grades.length > 0);
  const allInvoices = feeSummary.data?.invoices ?? [];
  const allPayments = feeSummary.data?.payments ?? [];
  const feeItems = feeSummary.data?.feeItems ?? [];
  const activeLearners = (feeSummary.data?.learners ?? []).filter(
    (learner) => learner.status === "active",
  );
  const taggedCurrentTermInvoices = allInvoices.filter(
    (invoice) => invoice.term_id === school.termId,
  );
  const taggedCurrentTermPayments = allPayments.filter(
    (payment) => payment.term_id === school.termId,
  );
  const taggedCurrentTermFeeItems = feeItems.filter((item) => item.term_id === school.termId);
  const latestAvailableTermId = [...allInvoices, ...allPayments]
    .filter((row) => row.term_id !== null)
    .sort((a, b) => {
      const dateA = "issue_date" in a ? a.issue_date : a.paid_at;
      const dateB = "issue_date" in b ? b.issue_date : b.paid_at;
      return String(dateB).localeCompare(String(dateA));
    })[0]?.term_id;
  const effectiveTermId =
    taggedCurrentTermInvoices.length ||
    taggedCurrentTermPayments.length ||
    taggedCurrentTermFeeItems.length
      ? school.termId
      : (latestAvailableTermId ?? null);
  const currentTermFeeItems = feeItems.filter((item) => item.term_id === effectiveTermId);
  const untaggedFeeItems = feeItems.filter((item) => item.term_id === null);
  const applicableFeeItems = currentTermFeeItems.length ? currentTermFeeItems : untaggedFeeItems;
  const feeStructureTarget = activeLearners.reduce(
    (total, learner) =>
      total +
      applicableFeeItems
        .filter((item) => !item.grade || item.grade === learner.current_grade)
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    0,
  );
  const currentTermInvoiceRows = effectiveTermId
    ? allInvoices.filter((invoice) => invoice.term_id === effectiveTermId)
    : allInvoices.filter((invoice) => invoice.term_id === null);
  const billableInvoices = currentTermInvoiceRows.filter((invoice) => invoice.status !== "void");
  const invoiceTarget = billableInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.total || 0),
    0,
  );
  const currentTermPaymentRows = effectiveTermId
    ? allPayments.filter((payment) => payment.term_id === effectiveTermId)
    : allPayments.filter((payment) => payment.term_id === null);
  const paymentTotal = currentTermPaymentRows
    .filter((payment) => !payment.is_reversed)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const currentTermInvoices = feeStructureTarget || invoiceTarget;
  const currentTermPayments = paymentTotal;
  const previousTermPayments = (feeSummary.data?.previousPayments ?? [])
    .filter((payment) => !payment.is_reversed)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const feeOutstanding = Math.max(0, currentTermInvoices - currentTermPayments);
  const overdueFees = [...new Set(billableInvoices.map((invoice) => invoice.learner_id))].reduce(
    (total, learnerId) => {
      const learnerInvoices = billableInvoices
        .filter((invoice) => invoice.learner_id === learnerId)
        .sort((a, b) => String(a.issue_date).localeCompare(String(b.issue_date)));
      let remainingPayments = currentTermPaymentRows
        .filter((payment) => payment.learner_id === learnerId && !payment.is_reversed)
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      return (
        total +
        learnerInvoices.reduce((sum, invoice) => {
          const invoiceAmount = Number(invoice.total || 0);
          const applied = Math.min(invoiceAmount, remainingPayments);
          remainingPayments -= applied;
          return (
            sum +
            (invoice.due_date && invoice.due_date < today && invoice.status === "issued"
              ? invoiceAmount - applied
              : 0)
          );
        }, 0)
      );
    },
    0,
  );
  const collectionRate = currentTermInvoices
    ? Math.min(100, (currentTermPayments / currentTermInvoices) * 100)
    : 0;
  const collectionPercent =
    collectionRate > 0 && collectionRate < 1
      ? Number(collectionRate.toFixed(1))
      : Math.round(collectionRate);
  const outstandingPercent = Math.max(0, 100 - collectionPercent);
  const paymentTrend = previousTermPayments
    ? Math.round(((currentTermPayments - previousTermPayments) / previousTermPayments) * 100)
    : 0;
  const collectedPercent = currentTermInvoices
    ? (currentTermPayments / currentTermInvoices) * 100
    : 0;
  const overduePercent = currentTermInvoices ? (overdueFees / currentTermInvoices) * 100 : 0;
  const formatPercent = (value: number) =>
    value > 0 && value < 1 ? `${value.toFixed(1)}%` : `${Math.round(value)}%`;
  const totalsConsistent =
    Math.abs(currentTermPayments + feeOutstanding - currentTermInvoices) < 0.01;

  useEffect(() => {
    if (!isLoading && data && !totalsConsistent) {
      console.warn("Fees Collection totals are inconsistent", {
        target: currentTermInvoices,
        collected: currentTermPayments,
        outstanding: feeOutstanding,
      });
    }
  }, [currentTermInvoices, currentTermPayments, data, feeOutstanding, isLoading, totalsConsistent]);
  const teacherAssignedStreams = isTeacherDashboard
    ? (teacherStreamMap.data ?? []).sort((a, b) =>
        `${a.grade} ${a.name}`.localeCompare(`${b.grade} ${b.name}`),
      )
    : [];
  const visibleTeacherStreamIds = new Set(teacherAssignedStreams.map((stream) => stream.id));
  const attendanceScope =
    isTeacherDashboard && selectedTeacherStream
      ? (record: { stream_id?: string | null }) => record.stream_id === selectedTeacherStream
      : isTeacherDashboard
        ? (record: { stream_id?: string | null }) =>
            Boolean(record.stream_id && visibleTeacherStreamIds.has(record.stream_id))
        : () => true;

  const todayAttendance = (data?.attendance ?? []).filter(
    (record) => record.attendance_date === today && attendanceScope(record),
  );
  const attendancePresent = todayAttendance.filter((record) =>
    ["present", "late"].includes(record.status),
  ).length;
  const attendanceTotal = todayAttendance.length;
  const attendanceByDay = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.now() - (6 - index) * 24 * 60 * 60 * 1000);
    const key = date.toISOString().slice(0, 10);
    const records = (data?.attendance ?? []).filter(
      (record) => record.attendance_date === key && attendanceScope(record),
    );
    const present = records.filter((record) => ["present", "late"].includes(record.status)).length;
    return {
      key,
      label: date.toLocaleDateString("en-KE", { weekday: "short" }),
      value: records.length ? Math.round((present / records.length) * 100) : 0,
    };
  });
  const upcomingEvents = data?.events ?? [];
  const calendarDays = Array.from({ length: monthEndDate.getDate() }, (_, index) => index + 1);
  const calendarOffset = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth(),
    1,
  ).getDay();
  const calendarEventDates = new Set((data?.calendarEvents ?? []).map((event) => event.start_date));
  const formatMoney = (amount: number) =>
    amount >= 1_000_000
      ? `KES ${(amount / 1_000_000).toFixed(1)}M`
      : `KES ${Math.round(amount / 1_000).toLocaleString()}K`;
  const phaseStyles = {
    pre_primary: {
      badge: "border-success-light bg-success-light text-success-dark",
      bar: "from-success via-success to-lime",
    },
    lower_primary: {
      badge: "border-primary/30 bg-primary/10 text-primary",
      bar: "from-primary via-accent to-accent",
    },
    upper_primary: {
      badge: "border-accent/30 bg-accent/10 text-accent",
      bar: "from-accent via-lime to-yellow",
    },
    junior_school: {
      badge: "border-info-light bg-info-light text-info",
      bar: "from-info via-info to-accent",
    },
    senior_school: {
      badge: "border-warning-light bg-warning-light text-warning",
      bar: "from-warning via-warning to-yellow",
    },
  };
  const activityList: Array<{
    id: string;
    action: string;
    entity: string;
    actor_name?: string | null;
    created_at: string;
  }> = [];
  const totalActivityPages = 0;
  const currentActivityPage = activityPage;
  const paginatedActivity = activityList;
  const ACTIVITY_PAGE_SIZE = 5;

  const genderTotal = Math.max(1, active.length);
  const gender = [
    {
      label: "Female",
      count: active.filter((learner) => learner.gender === "female").length,
      gradientClass: "bg-gradient-to-r from-success via-success to-lime",
      dotClass: "bg-success",
    },
    {
      label: "Male",
      count: active.filter((learner) => learner.gender === "male").length,
      gradientClass: "bg-gradient-to-r from-info to-primary",
      dotClass: "bg-info",
    },
    {
      label: "Unspecified",
      count: active.filter((learner) => !learner.gender).length,
      gradientClass: "bg-muted-foreground/40",
      dotClass: "bg-muted-foreground/50",
    },
  ];

  const pathwayCounts = (data?.pathways ?? []).map((pathway: { id: string; name: string }) => ({
    name: pathway.name,
    count: (data?.assignments ?? []).filter(
      (assignment: { pathway_id: string }) => assignment.pathway_id === pathway.id,
    ).length,
  }));

  const stats = [
    {
      label: "Active learners",
      value: active.length,
      icon: GraduationCap,
      hint: `${learners.length} total records`,
      borderClass: "border-l-4 border-l-blue-500",
      badgeClass:
        "border border-blue-200/60 bg-blue-50 text-blue-600 dark:border-blue-800/40 dark:bg-blue-950/60 dark:text-blue-400",
    },
    {
      label: "Grades offered",
      value: school.grades.length,
      icon: School,
      hint: "CBE grade offerings",
      borderClass: "border-l-4 border-l-violet-500",
      badgeClass:
        "border border-violet-200/60 bg-violet-50 text-violet-600 dark:border-violet-800/40 dark:bg-violet-950/60 dark:text-violet-400",
    },
    {
      label: "Active streams",
      value: (data?.streams ?? []).length,
      icon: Layers,
      hint: "Classes configured",
      borderClass: "border-l-4 border-l-orange-500",
      badgeClass:
        "border border-orange-200/60 bg-orange-50 text-orange-600 dark:border-orange-800/40 dark:bg-orange-950/60 dark:text-orange-400",
    },
    {
      label: "Attendance today",
      value: attendanceTotal ? `${Math.round((attendancePresent / attendanceTotal) * 100)}%` : "--",
      icon: CalendarCheck2,
      hint: attendanceTotal
        ? `${attendancePresent} of ${attendanceTotal} present`
        : "Not marked yet",
      borderClass: "border-l-4 border-l-blue-500",
      badgeClass:
        "border border-blue-200/60 bg-blue-50 text-blue-600 dark:border-blue-800/40 dark:bg-blue-950/60 dark:text-blue-400",
    },
    {
      label: "Upcoming events",
      value: upcomingEvents.length,
      icon: Calendar,
      hint: "this week",
      borderClass: "border-l-4 border-l-violet-500",
      badgeClass:
        "border border-violet-200/60 bg-violet-50 text-violet-600 dark:border-violet-800/40 dark:bg-violet-950/60 dark:text-violet-400",
    },
  ];
  const visibleStats = isTeacherDashboard
    ? stats.filter(
        (stat) => !["Staff members", "Fees collection", "Pending admissions"].includes(stat.label),
      )
    : [
        ...stats,
        {
          label: "Staff members",
          value: (data?.staff ?? []).filter((member) => member.status === "active").length,
          icon: Users,
          hint: `${(data?.staff ?? []).length} on register`,
          borderClass: "border-l-4 border-l-cyan-500",
          badgeClass:
            "border border-accent-light/60 bg-accent-light text-accent dark:border-accent-dark/40 dark:bg-accent dark:text-accent-light",
        },
        {
          label: "Fees collection",
          value: formatMoney(currentTermPayments),
          icon: WalletCards,
          hint: `${collectionPercent}% of term target`,
          borderClass: "border-l-4 border-l-emerald-500",
          badgeClass:
            "border border-success-light/60 bg-success-light text-success-dark dark:border-success-dark/40 dark:bg-success dark:text-success-light",
        },
        {
          label: "Pending admissions",
          value: learners.filter((learner) => learner.status === "pending").length,
          icon: UserPlus,
          hint: "awaiting approval",
          borderClass: "border-l-4 border-l-orange-500",
          badgeClass:
            "border border-orange-200/60 bg-orange-50 text-orange-600 dark:border-orange-800/40 dark:bg-orange-950/60 dark:text-orange-400",
        },
      ];

  const teacherQuickActions = [
    { label: "Mark attendance", icon: ClipboardCheck, to: "/attendance" },
    { label: "Enter marks", icon: CirclePlus, to: "/marks" },
    { label: "My students", icon: Users, to: "/learners" },
    { label: "My timetable", icon: Calendar, to: "/timetable" },
    { label: "Generate report", icon: FileBarChart, to: "/reports" },
    { label: "Grading scheme", icon: BookOpen, to: "/grading" },
  ];
  const quickActions = isTeacherDashboard
    ? teacherQuickActions
    : [
        { label: "Admit learner", icon: UserPlus, to: "/learners" },
        { label: "Mark attendance", icon: ClipboardCheck, to: "/attendance" },
        { label: "Record payment", icon: WalletCards, to: "/finance" },
        { label: "Add staff", icon: Plus, to: "/staff" },
        { label: "Generate report", icon: FileBarChart, to: "/reports" },
        { label: "Create announcement", icon: Megaphone, to: "/settings" },
      ];

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 pb-8">
      <section className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#0b1f3a] via-[#102d5d] to-[#0f766e] px-5 py-5 text-white shadow-[0_20px_42px_rgba(11,31,58,0.18)] sm:px-8 sm:py-7">
        <div className="pointer-events-none absolute -right-12 -top-20 size-64 rounded-full border-[28px] border-white/10" />
        <div className="pointer-events-none absolute -bottom-24 right-36 size-52 rounded-full border-[20px] border-sky-200/10" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-sidebar-primary">
              School overview
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Karibu, {school.fullName.split(" ")[0]}
            </h1>
            <p className="mt-2 text-sm text-sidebar-foreground/70">
              {school.school?.name}
              {school.school?.county ? ` · ${school.school.county} County` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {isTeacherDashboard ? (
              <>
                <Button
                  asChild
                  variant="secondary"
                  className="border border-white/20 bg-white/10 text-white shadow-xs backdrop-blur-xs transition-all duration-200 hover:border-sky-200/50 hover:bg-sky-100/15 hover:text-white hover:shadow-sm"
                >
                  <Link to="/attendance">
                    <ClipboardCheck className="mr-2 size-4" />
                    Mark attendance
                  </Link>
                </Button>
                <Button
                  asChild
                  className="bg-[#38bdf8] text-[#061827] shadow-md shadow-sky-400/25 transition-all duration-200 hover:scale-[1.02] hover:bg-[#7dd3fc] hover:shadow-lg hover:shadow-sky-400/30"
                >
                  <Link to="/marks">
                    <CirclePlus className="mr-2 size-4" />
                    Enter marks
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button
                  asChild
                  variant="secondary"
                  className="border border-white/20 bg-white/10 text-white shadow-xs backdrop-blur-xs transition-all duration-200 hover:border-sky-200/50 hover:bg-sky-100/15 hover:text-white hover:shadow-sm"
                >
                  <Link to="/classes">
                    <Layers className="mr-2 size-4" />
                    Manage streams
                  </Link>
                </Button>
                <Button
                  asChild
                  className="bg-[#38bdf8] text-[#061827] shadow-md shadow-sky-400/25 transition-all duration-200 hover:scale-[1.02] hover:bg-[#7dd3fc] hover:shadow-lg hover:shadow-sky-400/30"
                >
                  <Link to="/learners">
                    <CirclePlus className="mr-2 size-4" />
                    Admit a learner
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="grid items-stretch grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {visibleStats.map((stat) => (
          <Card
            key={stat.label}
            className={cn(
              "rounded-xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
              stat.borderClass,
            )}
          >
            <CardContent className="flex h-full min-h-[108px] items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {stat.label}
                </p>
                {isLoading ? (
                  <Skeleton className="mt-2 h-9 w-16" />
                ) : (
                  <p className="mt-1.5 text-[28px] font-extrabold leading-none tracking-tight text-foreground">
                    {stat.value}
                  </p>
                )}
                <p className="mt-1.5 text-[13px] text-muted-foreground">{stat.hint}</p>
              </div>
              <div
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-full shadow-xs",
                  stat.badgeClass,
                )}
              >
                <stat.icon className="size-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {!isTeacherDashboard && (
          <Card className="rounded-xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-semibold tracking-tight">
                    Fees collection
                  </CardTitle>
                  <CardDescription>All recorded terms payment position.</CardDescription>
                </div>
                <WalletCards className="size-5 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {feeSummary.isLoading ? (
                <div className="space-y-3" role="status" aria-live="polite">
                  <Skeleton className="mx-auto size-32 rounded-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <span className="sr-only">Loading fee collection data</span>
                </div>
              ) : feeSummary.isError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  Unable to load fee collection data.{" "}
                  {feeSummary.error instanceof Error
                    ? feeSummary.error.message
                    : "Please try again."}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-6">
                    <div
                      className="grid size-32 shrink-0 place-items-center rounded-full"
                      style={{
                        background: `conic-gradient(#059669 0 ${collectionPercent}%, #f59e0b ${collectionPercent}% 100%)`,
                      }}
                      aria-label={`${collectionPercent}% collected and ${outstandingPercent}% outstanding`}
                      role="img"
                    >
                      <div className="grid size-24 place-items-center rounded-full bg-card text-center">
                        <strong className="text-xl text-foreground">{collectionPercent}%</strong>
                        <span className="text-[11px] text-muted-foreground">collected</span>
                      </div>
                    </div>
                    <div className="min-w-0 space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full bg-success" />
                        <span className="text-muted-foreground">Collected</span>
                        <strong className="ml-auto">{formatMoney(currentTermPayments)}</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full bg-warning" />
                        <span className="text-muted-foreground">Outstanding</span>
                        <strong className="ml-auto">{formatMoney(feeOutstanding)}</strong>
                      </div>
                      <div className="border-t pt-2 text-xs text-muted-foreground">
                        Target: {formatMoney(currentTermInvoices)}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      {
                        label: "Collected",
                        value: currentTermPayments,
                        percentage: collectedPercent,
                        color: "text-emerald-600",
                      },
                      {
                        label: "Outstanding",
                        value: feeOutstanding,
                        percentage: outstandingPercent,
                        color: "text-amber-600",
                      },
                      {
                        label: "Overdue",
                        value: overdueFees,
                        percentage: overduePercent,
                        color: "text-rose-600",
                      },
                    ].map((item) => (
                      <div key={item.label} className="border-l border-border/70 pl-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {item.label}
                        </p>
                        <p className={cn("mt-1 text-lg font-bold", item.color)}>
                          {formatMoney(item.value)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatPercent(item.percentage)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                    {paymentTrend >= 0 ? (
                      <TrendingUp className="size-4 text-emerald-600" />
                    ) : (
                      <TrendingDown className="size-4 text-rose-600" />
                    )}
                    <span>
                      {previousTermPayments
                        ? `${Math.abs(paymentTrend)}% vs previous term`
                        : "No previous term comparison"}
                    </span>
                  </div>
                  {!totalsConsistent && (
                    <p className="text-xs text-destructive">
                      Warning: collected plus outstanding does not match the target.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="rounded-xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-semibold tracking-tight">
                  {isTeacherDashboard ? "Attendance overview" : "Attendance overview"}
                </CardTitle>
                <CardDescription>
                  {isTeacherDashboard
                    ? "Present and late records for your assigned class(es)."
                    : "Present and late records across the past seven days."}
                </CardDescription>
              </div>
              <CalendarCheck2 className="size-5 text-blue-600" />
            </div>
            {isTeacherDashboard && teacherAssignedStreams.length > 1 && (
              <div className="pt-3">
                <Select value={selectedTeacherStream} onValueChange={setSelectedTeacherStream}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {teacherAssignedStreams.map((stream) => (
                      <SelectItem key={stream.id} value={stream.id}>
                        {stream.grade} · {stream.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex h-44 items-end justify-between gap-2 border-b border-dashed border-border/70 px-1 pb-2">
              {attendanceByDay.map((day) => (
                <div
                  key={day.key}
                  className="group flex h-full flex-1 flex-col items-center justify-end gap-2"
                >
                  <span className="text-xs font-bold tabular-nums text-foreground">
                    {day.value ? `${day.value}%` : "--"}
                  </span>
                  <div className="flex h-28 w-full max-w-10 items-end rounded-t-lg bg-muted/50 p-0.5">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-blue-600 to-cyan-400 transition-[height,filter] duration-300 group-hover:brightness-110"
                      style={{ height: `${Math.max(day.value ? 8 : 2, day.value)}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {day.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-success" />
                Present
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-rose-500" />
                Absent
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-warning" />
                Late
              </span>
            </div>
          </CardContent>
        </Card>
        {isTeacherDashboard && (
          <Card className="rounded-xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-semibold tracking-tight">Events</CardTitle>
                  <CardDescription>Coming up this week.</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm" className="rounded-lg text-xs">
                  <Link to="/settings">View calendar</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events scheduled this week.</p>
              ) : (
                upcomingEvents.map((event) => (
                  <div key={event.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/40">
                    {event.image_url ? (
                      <img src={event.image_url} alt={event.title} className="size-12 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                        <span className="text-[0.6rem] font-bold uppercase">
                          {new Date(`${event.start_date}T00:00:00`).toLocaleDateString("en-KE", { month: "short" })}
                        </span>
                        <span className="text-base font-extrabold leading-none">
                          {new Date(`${event.start_date}T00:00:00`).getDate()}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.all_day ? "All day" : "Scheduled event"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {!isTeacherDashboard && (
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-shadow duration-200 hover:shadow-md lg:col-span-3">
            <CardHeader className="border-b border-border/60 bg-muted/15 px-5 py-4">
              <CardTitle className="text-lg font-semibold tracking-tight">
                Grade 9 transition overview
              </CardTitle>
              <CardDescription className="mt-1">
                Current Senior School assignments and placement distribution.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
              {pathwayCounts.map((pathway, index) => (
                <div
                  key={pathway.name}
                  className={cn(
                    "relative flex min-h-[124px] flex-col justify-between overflow-hidden rounded-lg border p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                    index % 3 === 0
                      ? "border-success-light/70 bg-success-light/60 hover:bg-success-light dark:border-success-dark/60 dark:bg-success/20 dark:hover:bg-success/35"
                      : index % 3 === 1
                        ? "border-info-light/70 bg-info-light/60 hover:bg-info-light dark:border-info-dark/60 dark:bg-info/20 dark:hover:bg-info/35"
                        : "border-warning-light/70 bg-warning-light/60 hover:bg-warning-light dark:border-warning-dark/60 dark:bg-warning/20 dark:hover:bg-warning/35",
                  )}
                >
                  <span
                    className={cn(
                      "absolute inset-x-0 top-0 h-1",
                      index % 3 === 0
                        ? "bg-success"
                        : index % 3 === 1
                          ? "bg-info"
                          : "bg-warning",
                    )}
                  />
                  <p className="pr-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    {pathway.name}
                  </p>
                  <p className="mt-3 text-3xl font-extrabold leading-none tracking-tight text-foreground">
                    {pathway.count}
                  </p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">current learners</p>
                </div>
              ))}
              <div className="rounded-lg border border-border/70 bg-muted/15 p-4 sm:col-span-2">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground">
                      Students by gender
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Active learner distribution
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {active.length} total
                  </span>
                </div>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                  {gender.map((item) => (
                    <div
                      key={item.label}
                      className={cn(
                        item.label === "Female"
                          ? "bg-success"
                          : item.label === "Male"
                            ? "bg-info"
                            : "bg-muted-foreground/40",
                        "transition-[width] duration-500",
                      )}
                      style={{ width: `${(item.count / genderTotal) * 100}%` }}
                      title={`${item.label}: ${item.count}`}
                    />
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {gender.map((item) => (
                    <div key={item.label} className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            item.label === "Female"
                              ? "bg-success"
                              : item.label === "Male"
                                ? "bg-info"
                                : "bg-muted-foreground/40",
                          )}
                        />
                        <span className="truncate text-xs font-medium text-muted-foreground">
                          {item.label}
                        </span>
                      </div>
                      <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                        {item.count}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          ({Math.round((item.count / genderTotal) * 100)}%)
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.06)] lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-semibold tracking-tight">Events</CardTitle>
                  <CardDescription>Coming up this week.</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm" className="rounded-lg text-xs">
                  <Link to="/settings">View calendar</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events scheduled this week.</p>
              ) : (
                upcomingEvents.map((event) => (
                  <div key={event.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/40">
                    {event.image_url ? (
                      <img src={event.image_url} alt={event.title} className="size-12 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                        <span className="text-[0.6rem] font-bold uppercase">
                          {new Date(`${event.start_date}T00:00:00`).toLocaleDateString("en-KE", { month: "short" })}
                        </span>
                        <span className="text-base font-extrabold leading-none">
                          {new Date(`${event.start_date}T00:00:00`).getDate()}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.all_day ? "All day" : "Scheduled event"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {activityList.length > 0 && (
            <Card className="rounded-xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-shadow duration-200 hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg font-semibold tracking-tight">
                      Recent activity
                    </CardTitle>
                    <CardDescription>
                      Audit trail of the latest changes in your school.
                    </CardDescription>
                  </div>
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="hidden rounded-lg font-medium sm:flex"
                  >
                    <Link to="/audit">
                      View full log <ArrowUpRight className="ml-1 size-4" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {activityList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    <ul className="space-y-1">
                      {paginatedActivity.map((activity) => {
                        const isCreate = activity.action?.toLowerCase() === "create";
                        const isUpdate = activity.action?.toLowerCase() === "update";
                        return (
                          <li
                            key={activity.id}
                            className="group flex items-center gap-3 border-b border-border/50 px-3 py-2.5 text-sm transition-colors last:border-b-0 odd:bg-muted/15 even:bg-transparent hover:bg-muted/40"
                          >
                            <span
                              className={cn(
                                "grid size-9 shrink-0 place-items-center rounded-xl shadow-xs transition-transform group-hover:scale-105",
                                isCreate
                                  ? "border border-emerald-200/60 bg-emerald-50 text-emerald-600 dark:border-emerald-800/40 dark:bg-emerald-950/60 dark:text-emerald-400"
                                  : isUpdate
                                    ? "border border-blue-200/60 bg-blue-50 text-blue-600 dark:border-blue-800/40 dark:bg-blue-950/60 dark:text-blue-400"
                                    : "border border-border/60 bg-muted text-muted-foreground",
                              )}
                            >
                              {isCreate ? (
                                <CirclePlus className="size-4" />
                              ) : (
                                <CheckCircle2 className="size-4" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                              <span className="font-semibold capitalize text-foreground">
                                {activity.action}
                              </span>{" "}
                              <span className="text-muted-foreground">
                                {activity.entity.replace(/_/g, " ")}
                              </span>
                              {activity.actor_name ? (
                                <span className="text-xs text-muted-foreground/80">
                                  {" "}
                                  · {activity.actor_name}
                                </span>
                              ) : null}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {formatDateTime(activity.created_at)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>

                    {totalActivityPages > 1 && (
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
                        <p className="text-xs text-muted-foreground">
                          Showing{" "}
                          <span className="font-semibold text-foreground">
                            {(currentActivityPage - 1) * ACTIVITY_PAGE_SIZE + 1}
                          </span>
                          –
                          <span className="font-semibold text-foreground">
                            {Math.min(
                              currentActivityPage * ACTIVITY_PAGE_SIZE,
                              activityList.length,
                            )}
                          </span>{" "}
                          of{" "}
                          <span className="font-semibold text-foreground">
                            {activityList.length}
                          </span>{" "}
                          activities
                        </p>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                            disabled={currentActivityPage === 1}
                            className="h-8 rounded-full px-3 text-xs font-medium"
                          >
                            <ChevronLeft className="mr-1 size-3.5" />
                            Previous
                          </Button>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: totalActivityPages }, (_, i) => i + 1).map(
                              (page) => (
                                <Button
                                  key={page}
                                  variant={currentActivityPage === page ? "default" : "ghost"}
                                  size="sm"
                                  onClick={() => setActivityPage(page)}
                                  className={cn(
                                    "size-8 rounded-full p-0 text-xs font-bold",
                                    currentActivityPage === page
                                      ? "bg-primary text-primary-foreground shadow-xs"
                                      : "text-muted-foreground hover:text-foreground",
                                  )}
                                >
                                  {page}
                                </Button>
                              ),
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setActivityPage((p) => Math.min(totalActivityPages, p + 1))
                            }
                            disabled={currentActivityPage === totalActivityPages}
                            className="h-8 rounded-full px-3 text-xs font-medium"
                          >
                            Next
                            <ChevronRight className="ml-1 size-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full justify-center rounded-lg sm:hidden"
                >
                  <Link to="/audit">
                    View full audit log <ArrowUpRight className="ml-1 size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4 lg:col-span-2">
            <Card className="hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg font-semibold tracking-tight">Events</CardTitle>
                    <CardDescription>Coming up this week.</CardDescription>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="rounded-lg text-xs">
                    <Link to="/settings">View calendar</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No events scheduled this week.</p>
                ) : (
                  upcomingEvents.map((event) => {
                    const eventDate = new Date(`${event.start_date}T00:00:00`);
                    return (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-muted/35"
                      >
                        {event.image_url ? (
                          <img
                            src={event.image_url}
                            alt={event.title}
                            className="size-12 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                            <span className="text-[0.6rem] font-bold uppercase">
                              {eventDate.toLocaleDateString("en-KE", { month: "short" })}
                            </span>
                            <span className="text-base font-extrabold leading-none">
                              {eventDate.getDate()}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{event.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {event.all_day ? "All day" : "Scheduled event"}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg font-semibold tracking-tight">Calendar</CardTitle>
                    <CardDescription>{currentTerm?.name ?? "Academic calendar"}</CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-full"
                      aria-label="Previous month"
                      onClick={() =>
                        setCalendarMonth(
                          (month) => new Date(month.getFullYear(), month.getMonth() - 1, 1),
                        )
                      }
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-full"
                      aria-label="Next month"
                      onClick={() =>
                        setCalendarMonth(
                          (month) => new Date(month.getFullYear(), month.getMonth() + 1, 1),
                        )
                      }
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-center text-sm font-bold text-foreground">
                  {calendarMonth.toLocaleDateString("en-KE", { month: "long", year: "numeric" })}
                </p>
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-muted-foreground">
                  {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                    <span key={`${day}-${index}`}>{day}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {Array.from({ length: calendarOffset }, (_, index) => (
                    <span key={`empty-${index}`} />
                  ))}
                  {calendarDays.map((day) => {
                    const dateKey = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const isToday = dateKey === today;
                    return (
                      <span
                        key={dateKey}
                        className={cn(
                          "relative grid size-7 place-items-center rounded-full text-xs font-medium",
                          isToday && "bg-primary font-bold text-primary-foreground",
                          !isToday && "text-foreground hover:bg-muted",
                        )}
                      >
                        {day}
                        {calendarEventDates.has(dateKey) && (
                          <span className="absolute bottom-0.5 size-1 rounded-full bg-amber-500" />
                        )}
                      </span>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold tracking-tight">
                  Quick actions
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-2">
                {quickActions.map((action) => (
                  <Button
                    key={action.label}
                    asChild
                    variant="outline"
                    className="h-auto min-h-20 flex-col gap-1.5 rounded-xl border-border/70 px-1 py-2 text-[0.65rem] font-semibold leading-tight shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-0.5 hover:bg-teal-50 hover:text-teal-900 hover:shadow-sm dark:hover:bg-teal-950/50 dark:hover:text-teal-100 focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <Link to={action.to}>
                      <action.icon className="size-4 text-primary" />
                      <span className="text-center">{action.label}</span>
                    </Link>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
      </div>
    </div>
  );
}

function ExamOfficerDashboard() {
  const school = useSchool();
  const schoolId = school.schoolId!;
  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const examData = useQuery({
    queryKey: ["exam-officer-dashboard", schoolId, school.termId],
    queryFn: async () => {
      const [assessmentResult, learnerResult, markResult, areaResult, eventResult, activityResult, sessionResult] = await Promise.all([
        supabase
          .from("assessments")
          .select("id, title, grade, learning_area_id, assessment_type, assessment_date, status")
          .eq("school_id", schoolId)
          .eq("term_id", school.termId)
          .order("assessment_date", { ascending: true }),
        supabase
          .from("learners")
          .select("id, current_grade")
          .eq("school_id", schoolId)
          .eq("is_archived", false),
        supabase
          .from("marks")
          .select("assessment_id, learner_id, raw_score, is_absent, is_exempt")
          .eq("school_id", schoolId),
        supabase.from("learning_areas").select("id, name").eq("school_id", schoolId),
        supabase
          .from("academic_calendar_events")
          .select("id, title, start_date, end_date, all_day, event_type, image_url")
          .eq("school_id", schoolId)
          .gte("start_date", today)
          .lte("start_date", nextWeek)
          .order("start_date")
          .limit(5),
        supabase
          .from("audit_logs")
          .select("id, action, entity, actor_name, created_at")
          .eq("school_id", schoolId)
          .order("created_at", { ascending: false })
          .limit(4),
        (supabase as unknown as { from: (table: string) => any })
          .from("exam_timetable_sessions")
          .select("id, assessment_id, invigilator_id, session_date")
          .eq("school_id", schoolId),
      ]);
      if (assessmentResult.error) throw assessmentResult.error;
      if (learnerResult.error) throw learnerResult.error;
      if (markResult.error) throw markResult.error;
      if (areaResult.error) throw areaResult.error;
      if (eventResult.error) throw eventResult.error;
      if (activityResult.error) throw activityResult.error;
      if (sessionResult.error) throw sessionResult.error;
      return {
        assessments: assessmentResult.data ?? [],
        learners: learnerResult.data ?? [],
        marks: markResult.data ?? [],
        areas: areaResult.data ?? [],
        events: eventResult.data ?? [],
        activities: activityResult.data ?? [],
        sessions: sessionResult.data ?? [],
      };
    },
  });
  const assessments = examData.data?.assessments ?? [];
  const progress = (assessment: (typeof assessments)[number]) => {
    const learners = (examData.data?.learners ?? []).filter(
      (learner) => learner.current_grade === assessment.grade,
    );
    const marked = learners.filter((learner) =>
      examData.data?.marks.some(
        (mark) =>
          mark.assessment_id === assessment.id &&
          mark.learner_id === learner.id &&
          (mark.raw_score !== null || mark.is_absent || mark.is_exempt),
      ),
    ).length;
    return { marked, total: learners.length };
  };
  const pending = assessments.filter(
    (assessment) => progress(assessment).marked < progress(assessment).total,
  ).length;
  const completed = assessments.filter(
    (assessment) =>
      assessment.status === "approved" && progress(assessment).marked >= progress(assessment).total,
  ).length;
  const upcoming = assessments.filter(
    (assessment) => assessment.assessment_date >= today && assessment.assessment_date <= nextWeek,
  ).length;
  const status = (assessment: (typeof assessments)[number]) => {
    const result = progress(assessment);
    if (assessment.status === "draft") return "Draft";
    if (
      assessment.status === "locked" ||
      (assessment.status === "approved" && result.marked >= result.total)
    )
      return "Completed";
    return "Marks pending";
  };
  const areaName = (id: string) =>
    examData.data?.areas.find((area) => area.id === id)?.name ?? "Learning area";
  const totalLearners = examData.data?.learners.length ?? 0;
  const totalMarked =
    examData.data?.marks.filter(
      (mark) => mark.raw_score !== null || mark.is_absent || mark.is_exempt,
    ).length ?? 0;
  const markTotal = assessments.reduce((sum, assessment) => sum + progress(assessment).total, 0);
  const markProgress = markTotal ? Math.round((totalMarked / markTotal) * 100) : 0;
  const stats = [
    ["Upcoming exams", upcoming, Calendar, "text-blue-600", "bg-blue-50"],
    ["Total candidates", totalLearners, Users, "text-emerald-600", "bg-emerald-50"],
    ["Exams completed", completed, CheckCircle2, "text-violet-600", "bg-violet-50"],
    ["Mark entry progress", `${markProgress}%`, ClipboardList, "text-orange-600", "bg-orange-50"],
    [
      "Results published",
      assessments.filter((assessment) => assessment.status === "approved").length,
      BarChart3,
      "text-teal-600",
      "bg-teal-50",
    ],
  ] as const;
  const upcomingExams = assessments
    .filter((assessment) => assessment.assessment_date >= today)
    .slice(0, 5);
  const upcomingEvents = examData.data?.events ?? [];
  const calendarDays = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const calendarOffset = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay();
  const displayName = school.fullName || "Exam Officer";
  const firstName = displayName.split(" ")[0];
  const formatExamDate = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  const activityIcons = [Calendar, Users, ClipboardCheck, FileText];
  const activityClasses = [
    "bg-violet-50 text-violet-600",
    "bg-emerald-50 text-emerald-600",
    "bg-orange-50 text-orange-600",
    "bg-blue-50 text-blue-600",
  ];
  const activities = (examData.data?.activities ?? []).map((activity, index) => [
    `${activity.action} ${activity.entity.replace(/_/g, " ")}`,
    `by ${activity.actor_name ?? "Unknown user"}`,
    formatDateTime(activity.created_at),
    activityIcons[index % activityIcons.length],
    activityClasses[index % activityClasses.length],
  ] as const);
  const sessions = examData.data?.sessions ?? [];
  const unassignedSessions = sessions.filter((session) => !session.invigilator_id).length;
  const practicalDueNextWeek = assessments.filter(
    (assessment) =>
      assessment.assessment_type.toLowerCase().includes("practical") &&
      assessment.assessment_date >= today &&
      assessment.assessment_date <= nextWeek,
  ).length;
  const pendingCandidates = assessments.reduce(
    (total, assessment) => total + Math.max(0, progress(assessment).total - progress(assessment).marked),
    0,
  );
  const badgeTone = (assessment: (typeof assessments)[number]) => {
    const result = progress(assessment);
    if (assessment.status === "draft") return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-200";
    if (assessment.status === "locked" || (assessment.status === "approved" && result.marked >= result.total))
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200";
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200";
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 pb-8">
      <div className="relative overflow-hidden rounded-2xl border border-sky-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.38),_transparent_32%),linear-gradient(135deg,#0b1f3a_0%,#12335d_35%,#0f766e_100%)] px-6 py-6 text-white shadow-[0_18px_40px_rgba(15,23,42,0.12)] sm:px-8">
        <div className="absolute -right-12 -top-16 size-48 rounded-full border-[18px] border-white/10" />
        <div className="absolute -bottom-16 right-16 size-44 rounded-full border-[16px] border-cyan-200/10" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.08)_50%,transparent_100%)]" />
        <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100/90">
              Exam office
            </p>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              Welcome back, {firstName}!
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-100/90">
              Here&apos;s a live overview of your examination schedule, marking progress, and essential alerts.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-sm">
            <div className="grid size-9 place-items-center rounded-lg bg-white/12 text-cyan-100">
              <Calendar className="size-4" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-slate-200/80">Today</p>
              <p className="text-xs font-semibold text-white">
                {new Date().toLocaleDateString("en-KE", { dateStyle: "long" })}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([label, value, Icon, color, background]) => (
          <Card
            key={label}
            className="group relative overflow-hidden rounded-xl border border-border/70 bg-card/90 shadow-[0_8px_18px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(15,23,42,0.08)]"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 opacity-80" />
            <CardContent className="flex min-h-[104px] flex-col justify-between p-3.5">
              <div className={`inline-flex size-9 items-center justify-center rounded-lg ${background} ring-1 ring-black/5 transition-transform duration-200 group-hover:scale-105`}>
                <Icon className={`size-4 ${color}`} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {label}
                </p>
                <p className={cn("mt-1.5 text-xl font-black tracking-tight text-foreground", examData.isLoading && "text-muted-foreground")}>
                  {examData.isLoading ? <Skeleton className="h-6 w-12" /> : value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Card className="rounded-2xl border border-border/70 bg-card/90 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg font-bold">Exam schedule</CardTitle>
              <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-700 dark:bg-sky-950/40 dark:text-sky-200">
                {assessments.length} total
              </span>
            </div>
            <CardDescription className="text-xs">Current term overview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <div
                className="grid size-40 place-items-center rounded-full bg-[conic-gradient(#2563eb_0_40%,#16a34a_40%_78%,#7c3aed_78%_100%)] p-3 shadow-inner shadow-slate-200/70"
                style={{
                  background: `conic-gradient(#2563eb 0 ${(upcoming / Math.max(1, assessments.length)) * 100}%, #16a34a ${(upcoming / Math.max(1, assessments.length)) * 100}% ${((upcoming + completed) / Math.max(1, assessments.length)) * 100}%, #7c3aed ${((upcoming + completed) / Math.max(1, assessments.length)) * 100}% 100%)`,
                }}
              >
                <div className="grid size-28 place-items-center rounded-full bg-card text-center shadow-[inset_0_2px_10px_rgba(15,23,42,0.06)]">
                  <strong className="text-2xl font-black text-foreground">{assessments.length}</strong>
                  <span className="text-[11px] font-medium text-muted-foreground">Total exams</span>
                </div>
              </div>
            </div>
            <div className="space-y-2.5 text-sm">
              {[
                ["Upcoming", upcoming, "bg-blue-600"],
                ["Completed", completed, "bg-emerald-600"],
                ["Pending", pending, "bg-amber-500"],
              ].map(([label, value, dot]) => (
                <div className="flex items-center justify-between rounded-xl bg-muted/40 px-2.5 py-2" key={label}>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className={`size-2.5 rounded-full ${dot}`} />
                    <span>{label}</span>
                  </span>
                  <strong className="text-base font-bold text-foreground">{value}</strong>
                </div>
              ))}
            </div>
            <Link
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
              to="/exam-timetable"
            >
              View full schedule <ArrowRight className="size-3.5" />
            </Link>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-border/70 bg-card/90 shadow-[0_12px_28px_rgba(15,23,42,0.04)] md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <div>
              <CardTitle className="text-lg font-bold">Upcoming exams</CardTitle>
              <CardDescription className="text-xs">Next scheduled assessment dates</CardDescription>
            </div>
            <Link className="text-xs font-semibold text-primary hover:text-primary/80" to="/exam-timetable">
              View all →
            </Link>
          </CardHeader>
          <CardContent>
            {examData.isLoading ? (
              <div className="space-y-2.5">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : upcomingExams.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No upcoming exams scheduled.</p>
            ) : (
              <div className="space-y-2.5">
                {upcomingExams.map((assessment) => (
                  <div
                    key={assessment.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-gradient-to-r from-muted/25 to-background/70 p-3 transition-colors hover:border-primary/20 hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold leading-tight text-foreground">
                        {assessment.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {GRADE_LABELS[assessment.grade]} · {assessment.assessment_type}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <time className="whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-300">
                        {formatExamDate(assessment.assessment_date)}
                      </time>
                      <Badge variant="outline" className={`whitespace-nowrap text-[10px] font-semibold ${badgeTone(assessment)}`}>
                        {status(assessment)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Card className="rounded-2xl border border-border/70 bg-card/90 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold">Quick actions</CardTitle>
            <CardDescription className="text-xs">Common exam office tasks</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2.5">
            {[
              { label: "Schedule exam", icon: Plus, to: "/assignments" },
              { label: "Manage timetable", icon: Calendar, to: "/exam-timetable" },
              { label: "Assign invigilators", icon: Users, to: "/staff" },
              { label: "Enter marks", icon: ClipboardCheck, to: "/marks" },
              { label: "Generate reports", icon: FileBarChart, to: "/reports" },
            ].map((action) => (
              <Button
                key={action.label}
                asChild
                variant="outline"
                className="h-auto min-h-18 flex-col gap-1.5 rounded-xl border border-border/70 bg-background/60 px-2 py-3 text-[11px] font-semibold leading-tight shadow-[0_1px_7px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:bg-primary/5 hover:text-primary hover:shadow-md"
              >
                <Link to={action.to} className="flex flex-col items-center justify-center gap-1.5">
                  <action.icon className="size-4 text-primary" />
                  <span className="text-center">{action.label}</span>
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-border/70 bg-card/90 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <div>
              <CardTitle className="text-lg font-bold">Events</CardTitle>
              <CardDescription className="text-xs">Coming up this week</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-auto rounded-lg px-1.5 py-0.5 text-[11px]">
              <Link to="/settings">View calendar</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {upcomingEvents.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground">No events scheduled this week.</p>
            ) : (
              upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-gradient-to-r from-sky-50/70 to-transparent p-2.5 text-xs dark:from-sky-950/20 dark:to-transparent">
                  <div className="mt-0.5 grid size-8 place-items-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200">
                    <Calendar className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{event.title}</p>
                    <p className="mt-0.5 text-muted-foreground">{formatExamDate(event.start_date)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-border/70 bg-card/90 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold">Calendar</CardTitle>
            <CardDescription className="text-xs">
              {new Date().toLocaleDateString("en-KE", { month: "long", year: "numeric" })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-muted-foreground">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                <span key={`${day}-${index}`}>{day}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {Array.from({ length: calendarOffset }, (_, index) => (
                <span key={`empty-${index}`} />
              ))}
              {Array.from({ length: calendarDays }, (_, index) => (
                <span
                  key={index}
                  className={cn(
                    "grid size-7 place-items-center rounded-full transition-colors",
                    index + 1 === new Date().getDate() && "bg-primary font-bold text-primary-foreground shadow-sm",
                    index + 1 !== new Date().getDate() && "text-slate-600 hover:bg-muted/70 dark:text-slate-300",
                  )}
                >
                  {index + 1}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card className="rounded-2xl border border-border/70 bg-card/90 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold">Mark entry status</CardTitle>
                <CardDescription className="text-xs">Overall progress</CardDescription>
              </div>
              <strong className="text-xl font-black text-emerald-600 dark:text-emerald-400">{markProgress}%</strong>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2.5 flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span className="font-medium text-foreground">
                  {totalMarked} of {markTotal} marks
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.3)] transition-[width] duration-300"
                  style={{ width: `${markProgress}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              {[
                ["Completed", totalMarked, "text-emerald-600 dark:text-emerald-400"],
                ["Pending", pending, "text-orange-600 dark:text-orange-400"],
                ["Outstanding", Math.max(0, totalLearners - totalMarked), "text-red-600 dark:text-red-400"],
              ].map(([label, value, color]) => (
                <div className="rounded-xl border border-border/60 bg-muted/30 px-2 py-2.5" key={label}>
                  <strong className={`block text-base font-black ${color}`}>{value}</strong>
                  <span className="mt-0.5 text-[10px] text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
            <Link
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80"
              to="/marks"
            >
              Go to mark entry <ArrowRight className="size-3" />
            </Link>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-border/70 bg-card/90 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <div>
              <CardTitle className="text-lg font-bold">Recent activities</CardTitle>
              <CardDescription className="text-xs">Audit trail of changes</CardDescription>
            </div>
            <Link className="text-xs font-semibold text-primary hover:text-primary/80" to="/audit">
              View all →
            </Link>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {activities.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No activity recorded yet.</p>
            ) : (
              activities.map(([title, by, time, Icon, iconClass]) => (
                <div key={title} className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-gradient-to-r from-muted/30 to-background/60 p-2.5 text-xs">
                  <div className={`grid size-8 shrink-0 place-items-center rounded-lg ${iconClass}`}>
                    <Icon className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{title}</p>
                    <p className="mt-0.5 text-muted-foreground">{by}</p>
                  </div>
                  <time className="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">
                    {time}
                  </time>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="rounded-2xl border border-border/70 bg-card/90 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-base font-semibold">Exam alerts</CardTitle>
            <CardDescription className="text-xs">Active notices and reminders</CardDescription>
          </div>
          <Link className="text-xs font-semibold text-primary hover:text-primary/80" to="/exam-timetable">
            View all →
          </Link>
        </CardHeader>
        <CardContent>
          {examData.isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : [
            unassignedSessions > 0 && [
              `${unassignedSessions} exam${unassignedSessions === 1 ? " is" : "s are"} not assigned invigilators.`,
              "Assign now",
              "border-l-4 border-l-red-500 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-200",
              "/exam-timetable",
            ],
            pendingCandidates > 0 && [
              `${pendingCandidates} candidate mark${pendingCandidates === 1 ? " is" : "s are"} pending.`,
              "Enter marks",
              "border-l-4 border-l-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
              "/marks",
            ],
            practicalDueNextWeek > 0 && [
              `${practicalDueNextWeek} practical exam${practicalDueNextWeek === 1 ? " is" : "s are"} due next week.`,
              "View schedule",
              "border-l-4 border-l-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950/30 dark:text-blue-200",
              "/exam-timetable",
            ],
          ].filter(Boolean).length === 0 ? (
            <div className="rounded-lg border border-border/50 bg-muted/30 px-4 py-3 text-center text-xs text-muted-foreground">
              <CheckCircle2 className="mx-auto mb-2 size-4 text-emerald-600" />
              <p>No active exam alerts</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[
                unassignedSessions > 0 && [
                  `${unassignedSessions} exam${unassignedSessions === 1 ? " is" : "s are"} not assigned invigilators.`,
                  "Assign now",
                  "border-l-4 border-l-red-500 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-200",
                  "/exam-timetable",
                ],
                pendingCandidates > 0 && [
                  `${pendingCandidates} candidate mark${pendingCandidates === 1 ? " is" : "s are"} pending.`,
                  "Enter marks",
                  "border-l-4 border-l-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
                  "/marks",
                ],
                practicalDueNextWeek > 0 && [
                  `${practicalDueNextWeek} practical exam${practicalDueNextWeek === 1 ? " is" : "s are"} due next week.`,
                  "View schedule",
                  "border-l-4 border-l-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950/30 dark:text-blue-200",
                  "/exam-timetable",
                ],
              ].filter(Boolean).map((alert) => {
                const [message, action, alertClass, to] = alert as [string, string, string, string];
                return (
                  <Link
                    to={to}
                    className={`flex items-center gap-3 rounded-lg p-3 text-xs font-medium transition-colors hover:opacity-80 ${alertClass}`}
                    key={message}
                  >
                    <CircleAlert className="size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{message}</p>
                      <p className="mt-0.5 text-[10px] font-semibold opacity-75">{action}</p>
                    </div>
                    <ArrowRight className="size-3.5 shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <footer className="flex flex-wrap justify-between gap-2 border-t border-border/50 pt-4 text-xs text-muted-foreground">
        <span>© 2024 School Management System. All rights reserved.</span>
        <span>SMS Version 2.0.0</span>
      </footer>
    </div>
  );
}
