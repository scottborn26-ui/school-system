import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, IdCard, Loader2, Mail, Phone, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { RequireSchool } from "@/components/require-school";
import { DataTable, type Column } from "@/components/data-table";
import { ACTIONS_COLUMN_CLASS, RowActions } from "@/components/row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
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
import { Checkbox } from "@/components/ui/checkbox";
import { DetailPanel, PersonAvatar } from "@/components/detail-panel";
import { PhotoUploader } from "@/components/photo-uploader";
import { supabase } from "@/lib/supabase";
import { useSchool } from "@/hooks/use-school";
import { GRADE_LABELS, type CbeGrade } from "@/lib/cbe";
import { canViewSensitiveStaffDocuments, getPersonDisplayName } from "@/lib/detail-panel";
import { formatDate, KE_PHONE_REGEX, normalizeKePhone } from "@/lib/format";
import {
  createStaffWithAccount,
  deleteStaffAccountPermanently,
  resendStaffCredentials,
} from "@/lib/staff-account.functions";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [
      { title: "Staff register · SHANSCOTT CBE" },
      {
        name: "description",
        content:
          "Maintain the school staff register with TSC numbers, job titles, employment type and contact details.",
      },
      { property: "og:title", content: "Staff register · SHANSCOTT CBE" },
      {
        property: "og:description",
        content: "Teaching and support staff records for Kenyan CBE schools.",
      },
    ],
  }),
  component: () => (
    <RequireSchool roles={["principal", "deputy"]}>
      <StaffPage />
    </RequireSchool>
  ),
});

interface StaffRow {
  id: string;
  user_id: string | null;
  staff_number: string;
  full_name: string;
  tsc_number: string | null;
  job_title: string | null;
  employment_type: string | null;
  phone: string | null;
  email: string | null;
  employment_date: string | null;
  status: string;
  assigned_grade: CbeGrade | null;
  assigned_grades: CbeGrade[];
  class_teacher_grade: CbeGrade | null;
  class_teacher_stream_id: string | null;
  class_teacher_stream_name: string | null;
  photo_url: string | null;
  gender: string | null;
  national_id: string | null;
}

interface ClassStream {
  id: string;
  grade: CbeGrade;
  name: string;
  class_teacher_id: string | null;
}

const JOB_TITLE_OPTIONS = [
  "Teacher",
  "Class Teacher",
  "Subject Teacher",
  "Exam Officer",
  "Admin staff",
] as const;

function StaffPage() {
  const school = useSchool();
  const schoolId = school.schoolId!;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<{
    staffName: string;
    email: string;
    password: string;
  } | null>(null);
  const openStaffTriggerRef = useRef<HTMLButtonElement | null>(null);
  const canViewStaffDocuments = canViewSensitiveStaffDocuments(school.roles);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["staff", schoolId],
    queryFn: async () => {
      const [staffQuery, streamsQuery] = await Promise.all([
        supabase
          .from("staff")
          .select(
            "id, user_id, staff_number, full_name, tsc_number, job_title, employment_type, phone, email, employment_date, status, assigned_grade, assigned_grades, class_teacher_grade, photo_url, gender, national_id",
          )
          .eq("school_id", schoolId)
          .eq("is_archived", false)
          .order("full_name"),
        supabase.from("streams").select("id, grade, name, class_teacher_id").eq("school_id", schoolId),
      ]);
      const { data: rows, error } = staffQuery;
      const streams = (streamsQuery.data ?? []) as ClassStream[];
      if (!error)
        return (rows ?? []).map((row) => {
          const stream = streams.find((item) => item.class_teacher_id === row.id);
          return {
            ...row,
            class_teacher_stream_id: stream?.id ?? null,
            class_teacher_stream_name: stream?.name ?? null,
          };
        }) as StaffRow[];

      const fallback = await supabase
        .from("staff")
        .select(
          "id, user_id, staff_number, full_name, tsc_number, job_title, employment_type, phone, email, employment_date, status, assigned_grade",
        )
        .eq("school_id", schoolId)
        .eq("is_archived", false)
        .order("full_name");
      if (fallback.error) throw fallback.error;
      return (fallback.data ?? []).map((row) => ({
        ...row,
        assigned_grades: row.assigned_grade ? [row.assigned_grade] : [],
        class_teacher_grade: null,
        class_teacher_stream_id: null,
        class_teacher_stream_name: null,
        photo_url: null,
        gender: null,
        national_id: null,
      })) as StaffRow[];
    },
  });

  const selectedStaffDetail = useQuery({
    queryKey: ["staff-detail-drawer", schoolId, selectedStaffId],
    enabled: Boolean(selectedStaffId),
    queryFn: async () => {
      const [member, allocations, timetable, classStream] = await Promise.all([
        supabase
          .from("staff")
          .select(
            "id, user_id, staff_number, full_name, tsc_number, job_title, employment_type, phone, email, employment_date, status, assigned_grade, assigned_grades, class_teacher_grade, photo_url, department_id, gender, national_id, created_at",
          )
          .eq("school_id", schoolId)
          .eq("id", selectedStaffId!)
          .eq("is_archived", false)
          .single(),
        supabase
          .from("teacher_allocations")
          .select(
            "id, stream_id, learning_area_id, periods_per_week, is_active, streams(name, grade), learning_areas(name)",
          )
          .eq("school_id", schoolId)
          .eq("staff_id", selectedStaffId!)
          .eq("is_active", true),
        supabase
          .from("timetable_slots")
          .select(
            "id, day_of_week, period_index, stream_id, learning_area_id, room_id, streams(name), learning_areas(name)",
          )
          .eq("school_id", schoolId)
          .eq("staff_id", selectedStaffId!)
          .order("day_of_week")
          .order("period_index"),
        supabase
          .from("streams")
          .select("id, grade, name")
          .eq("school_id", schoolId)
          .eq("class_teacher_id", selectedStaffId!)
          .maybeSingle(),
      ]);

      if (member.error) throw member.error;
      return {
        member: member.data,
        allocations: allocations.data ?? [],
        timetable: timetable.data ?? [],
        classStream: classStream.data,
      };
    },
  });

  const rows = (data ?? []).filter((s) => typeFilter === "all" || s.employment_type === typeFilter);

  const archiveStaff = useMutation({
    mutationFn: async (member: StaffRow) => {
      const { error } = await supabase
        .from("staff")
        .update({ is_archived: true, status: "inactive" })
        .eq("id", member.id)
        .eq("school_id", schoolId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Staff member archived successfully.");
      void qc.invalidateQueries({ queryKey: ["staff", schoolId] });
    },
    onError: () => toast.error("The staff member could not be archived."),
  });

  const bulkArchiveStaff = useMutation({
    mutationFn: async () => {
      if (!selectedStaff.size) return;
      if (!window.confirm(`Archive ${selectedStaff.size} selected staff records?`)) return;
      const { error } = await supabase
        .from("staff")
        .update({ is_archived: true, status: "inactive" })
        .eq("school_id", schoolId)
        .in("id", [...selectedStaff]);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelectedStaff(new Set());
      toast.success("Selected staff records archived successfully.");
      void qc.invalidateQueries({ queryKey: ["staff", schoolId] });
    },
    onError: (error: Error) =>
      toast.error("Staff records could not be archived.", { description: error.message }),
  });

  const deleteStaff = useMutation({
    mutationFn: (member: StaffRow) => {
      if (
        !window.confirm(
          `Permanently delete ${member.full_name}'s staff record and login account? This cannot be undone.`,
        )
      ) {
        return null;
      }
      return deleteStaffAccountPermanently({ data: { schoolId, staffId: member.id } });
    },
    onSuccess: (result) => {
      if (!result) return;
      toast.success(`${result.fullName}'s staff account was permanently deleted.`);
      void qc.invalidateQueries({ queryKey: ["staff", schoolId] });
    },
    onError: (error: Error) =>
      toast.error("The staff account could not be deleted.", { description: error.message }),
  });

  const resendCredentials = useMutation({
    mutationFn: (member: StaffRow) =>
      resendStaffCredentials({ data: { schoolId, staffId: member.id } }),
    onSuccess: (result) => {
      if (result.password && result.email) {
        setPasswordNotice({
          staffName: result.staffName || result.email,
          email: result.email,
          password: result.password,
        });
        toast.success("New password ready to copy.", {
          description: "Share it securely with the staff member once. It will not be shown again.",
        });
        return;
      }

      toast.error("The password could not be generated for display.", {
        description: result.error ?? "Please try again.",
      });
    },
    onError: (error: Error) => {
      const userFriendlyMessage = error.message
        .replace(/Only a principal or deputy/, "You do not have permission to")
        .replace(/\.$/, "");

      toast.error("Credentials could not be resent.", {
        description:
          userFriendlyMessage ||
          "An unexpected error occurred. Please try again or contact support.",
      });
    },
  });

  const columns: Column<StaffRow>[] = [
    {
      key: "staff_number",
      header: "Staff no.",
      sortable: true,
      className: "whitespace-nowrap",
      sortValue: (r) => r.staff_number,
      cell: (r) => <span className="font-medium">{r.staff_number}</span>,
    },
    {
      key: "full_name",
      header: "Name",
      sortable: true,
      className: "min-w-[170px]",
      sortValue: (r) => r.full_name,
      cell: (r) => (
        <button
          type="button"
          className="block text-left"
          onClick={() => setSelectedStaffId(r.id)}
          aria-label={`Open ${r.full_name} staff profile`}
        >
          <div className="flex items-center gap-2.5">
            <PersonAvatar name={r.full_name} photoUrl={r.photo_url} className="size-9" />
            <div>
              <p className="font-medium leading-tight hover:text-primary">{r.full_name}</p>
              <p className="text-xs leading-tight text-muted-foreground">
                {r.tsc_number ? `TSC ${r.tsc_number}` : "No TSC number"}
              </p>
            </div>
          </div>
        </button>
      ),
    },
    {
      key: "job_title",
      header: "Job title",
      className: "max-w-[190px]",
      cell: (r) => (
        <span className="block max-w-[190px] truncate" title={r.job_title ?? "No job title"}>
          {r.job_title ?? "—"}
        </span>
      ),
    },
    {
      key: "assigned_grade",
      header: "Assigned grade",
      className: "min-w-[150px]",
      cell: (r) => <StaffGradeChips staff={r} />,
    },
    {
      key: "class_teacher",
      header: "Class teacher",
      className: "min-w-[150px]",
      cell: (r) =>
        r.class_teacher_stream_name ? (
          <Badge variant="outline">
            {r.class_teacher_grade ? GRADE_LABELS[r.class_teacher_grade] : "Class"} · {r.class_teacher_stream_name}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "phone",
      header: "Phone",
      className: "min-w-[140px]",
      cell: (r) => r.phone || "—",
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <Badge variant={r.status === "active" ? "default" : "secondary"} className="capitalize">
          {r.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: ACTIONS_COLUMN_CLASS,
      cell: (r) => (
        <RowActions
          onEdit={() => setEditing(r)}
          onArchive={() => archiveStaff.mutate(r)}
          extra={
            <>
              {r.user_id && r.email ? (
                <DropdownMenuItem onSelect={() => resendCredentials.mutate(r)}>
                  <Mail className="mr-2 size-4" /> Resend credentials
                </DropdownMenuItem>
              ) : undefined}
              <DropdownMenuItem
                onSelect={() => deleteStaff.mutate(r)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-4" /> Delete account permanently
              </DropdownMenuItem>
            </>
          }
          disabled={archiveStaff.isPending || resendCredentials.isPending || deleteStaff.isPending}
          archiveLabel="Archive staff member"
        />
      ),
    },
  ];

  const drawerMember = selectedStaffDetail.data?.member;
  const drawerName = drawerMember
    ? getPersonDisplayName({ full_name: drawerMember.full_name })
    : "Staff profile";

  return (
    <>
      <DetailPanel
        open={Boolean(selectedStaffId)}
        onOpenChange={(next) => {
          if (!next) {
            setSelectedStaffId(null);
            requestAnimationFrame(() => openStaffTriggerRef.current?.focus());
          }
        }}
        entityType="staff"
        photoUrl={drawerMember?.photo_url ?? null}
        title={drawerName}
        subtitle={
          drawerMember
            ? (drawerMember.job_title ?? drawerMember.employment_type ?? "Staff member")
            : "Loading…"
        }
        onEdit={() => {
          const staffRow = rows.find((row) => row.id === selectedStaffId);
          if (staffRow) {
            setEditing(staffRow);
            setSelectedStaffId(null);
          }
        }}
        onCloseFocus={() => openStaffTriggerRef.current?.focus()}
        onPrint={() => window.print()}
      >
        {selectedStaffDetail.isLoading ? (
          <div className="space-y-3 py-8 text-sm text-muted-foreground">
            <div className="h-10 animate-pulse rounded-md bg-muted" />
            <div className="h-20 animate-pulse rounded-md bg-muted" />
            <div className="h-16 animate-pulse rounded-md bg-muted" />
          </div>
        ) : !drawerMember ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Staff details could not be loaded.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3 rounded-xl border border-border/80 bg-card p-3">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Status
                </div>
                <div className="mt-2 w-fit rounded-full bg-primary/10 px-2 py-1 text-xs font-medium capitalize text-primary">
                  {drawerMember.status}
                </div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <div>{drawerMember.job_title ?? "No title"}</div>
                {selectedStaffDetail.data?.classStream && (
                  <div className="mt-1 text-xs font-medium text-primary">
                    Class teacher · {GRADE_LABELS[selectedStaffDetail.data.classStream.grade]} · {selectedStaffDetail.data.classStream.name}
                  </div>
                )}
                <div className="mt-2 flex max-w-[220px] flex-wrap justify-end gap-1.5">
                  {(drawerMember.assigned_grades?.length
                    ? drawerMember.assigned_grades
                    : drawerMember.assigned_grade
                      ? [drawerMember.assigned_grade]
                      : []
                  ).map((grade) => (
                    <Badge key={grade} variant="secondary" className="px-1.5 py-0 text-[11px]">
                      {GRADE_LABELS[grade]}
                    </Badge>
                  ))}
                  {!drawerMember.assigned_grades?.length && !drawerMember.assigned_grade && (
                    <span>No grade</span>
                  )}
                </div>
              </div>
            </div>

            <section className="space-y-3 rounded-xl border border-border/80 bg-card p-3">
              <div className="text-sm font-semibold text-foreground">
                Personal & employment information
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FactItem icon={IdCard} label="Gender" value={drawerMember.gender ?? "Not captured"} />
                <FactItem icon={Phone} label="Phone" value={drawerMember.phone ?? "Not captured"} />
                <FactItem icon={Mail} label="Email" value={drawerMember.email ?? "Not captured"} />
                <FactItem icon={CalendarDays} label="Date joined" value={formatDate(drawerMember.employment_date)} />
                <FactItem label="Employment type" value={drawerMember.employment_type?.toUpperCase() ?? "Not captured"} />
                <FactItem icon={IdCard} label="TSC number" value={drawerMember.tsc_number ?? "Not captured"} />
                <FactItem icon={IdCard} label="National ID" value={drawerMember.national_id ?? "Not captured"} />
              </div>
              <div className="border-t border-border/70 pt-3">
                <FactItem
                  label="Class teacher assignment"
                  value={
                    selectedStaffDetail.data?.classStream
                      ? `${GRADE_LABELS[selectedStaffDetail.data.classStream.grade]} · ${selectedStaffDetail.data.classStream.name}`
                      : "Not assigned"
                  }
                />
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-border/80 bg-card p-3">
              <div className="text-sm font-semibold text-foreground">Teaching assignments</div>
              {selectedStaffDetail.data?.allocations.length ? (
                <div className="space-y-2 text-sm text-muted-foreground">
                  {selectedStaffDetail.data.allocations.map((allocation: any) => (
                    <div
                      key={allocation.id}
                      className="rounded-md border border-border/70 bg-muted/20 p-3"
                    >
                      <div className="font-medium text-foreground">
                        {allocation.streams?.grade
                          ? GRADE_LABELS[allocation.streams.grade]
                          : "Class"}{" "}
                        {allocation.streams?.name ?? "stream"}
                      </div>
                      <div className="mt-1">
                        {allocation.learning_areas?.name ?? "Learning area"} ·{" "}
                        {allocation.periods_per_week ?? 0} periods/week
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No teaching assignments recorded.
                </div>
              )}
            </section>

            <section className="space-y-3 rounded-xl border border-border/80 bg-card p-3">
              <div className="text-sm font-semibold text-foreground">Timetable</div>
              {selectedStaffDetail.data?.timetable.length ? (
                <div className="space-y-3 text-sm text-muted-foreground">
                  {Object.entries(
                    selectedStaffDetail.data.timetable.reduce<Record<string, any[]>>(
                      (days, slot: any) => {
                        const day =
                          ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][
                            slot.day_of_week - 1
                          ] ?? `Day ${slot.day_of_week}`;
                        (days[day] ??= []).push(slot);
                        return days;
                      },
                      {},
                    ),
                  ).map(([day, daySlots]) => (
                    <div key={day} className="space-y-1.5">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {day}
                      </div>
                      {daySlots
                        .sort((a, b) => a.period_index - b.period_index)
                        .map((slot) => (
                          <div
                            key={slot.id}
                            className="rounded-md border border-border/70 bg-muted/20 p-2.5"
                          >
                            {slot.learning_areas?.name ?? "Subject"} ·{" "}
                            {slot.streams?.name ?? "Class"} · Period {slot.period_index}
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No timetable entries for this staff member.
                </div>
              )}
            </section>

            {canViewStaffDocuments && (
              <section className="space-y-3 rounded-xl border border-border/80 bg-card p-3">
                <div className="text-sm font-semibold text-foreground">Documents / notes</div>
                <div className="text-sm text-muted-foreground">
                  No confidential staff documents are currently attached to this profile.
                </div>
              </section>
            )}
          </div>
        )}
      </DetailPanel>

      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Staff register</h1>
            <p className="text-sm text-muted-foreground">
              {rows.length} staff record{rows.length === 1 ? "" : "s"} on file.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 size-4" /> Add staff member
              </Button>
            </DialogTrigger>
            <StaffDialog
              schoolId={schoolId}
              onPasswordNotice={setPasswordNotice}
              onDone={async () => {
                setOpen(false);
                await qc.invalidateQueries({ queryKey: ["staff", schoolId] });
                await qc.invalidateQueries({ queryKey: ["class-teacher-streams", schoolId] });
                await refetch();
              }}
            />
          </Dialog>
        </div>

        <DataTable
          rows={rows}
          columns={columns}
          loading={isLoading}
          rowKey={(r) => r.id}
          selectable
          selectedKeys={selectedStaff}
          onSelectionChange={setSelectedStaff}
          toolbar={
            selectedStaff.size > 0 ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => bulkArchiveStaff.mutate()}
                disabled={bulkArchiveStaff.isPending}
              >
                <Trash2 className="size-4" /> Archive {selectedStaff.size} selected
              </Button>
            ) : null
          }
          searchPlaceholder="Search by name, staff number or TSC number…"
          searchValue={(r) => `${r.full_name} ${r.staff_number} ${r.tsc_number ?? ""}`}
          onReset={() => setTypeFilter("all")}
          emptyTitle="No staff records yet"
          emptyDescription="Add teaching and support staff so they can be assigned to streams and learning areas."
          filters={
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[170px]" aria-label="Filter by employment type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employment types</SelectItem>
                <SelectItem value="tsc">TSC employed</SelectItem>
                <SelectItem value="bom">BOM employed</SelectItem>
                <SelectItem value="intern">Intern</SelectItem>
                <SelectItem value="support">Support staff</SelectItem>
              </SelectContent>
            </Select>
          }
        />
        {isError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Staff records could not be loaded. {error instanceof Error ? error.message : "Please try again."}
          </div>
        )}
        {editing && (
          <Dialog open onOpenChange={(value) => !value && setEditing(null)}>
            <EditStaffDialog
              staff={editing}
              schoolId={schoolId}
              onDone={async () => {
                setEditing(null);
                await qc.invalidateQueries({ queryKey: ["staff", schoolId] });
                await qc.invalidateQueries({ queryKey: ["class-teacher-streams", schoolId] });
                await refetch();
              }}
            />
          </Dialog>
        )}
      </div>

      {passwordNotice && (
        <TemporaryPasswordDialog
          staffName={passwordNotice.staffName}
          email={passwordNotice.email}
          password={passwordNotice.password}
          onOpenChange={(open) => {
            if (!open) setPasswordNotice(null);
          }}
        />
      )}
    </>
  );
}

function StaffGradeChips({ staff }: { staff: StaffRow }) {
  const grades = staff.assigned_grades?.length
    ? staff.assigned_grades
    : staff.assigned_grade
      ? [staff.assigned_grade]
      : [];
  const visibleGrades = grades.slice(0, 3);
  const remaining = grades.length - visibleGrades.length;
  const allGrades = grades.map((grade) => GRADE_LABELS[grade]).join(", ");

  if (!grades.length) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="flex max-w-[190px] flex-wrap gap-1" title={allGrades}>
      {visibleGrades.map((grade) => (
        <Badge key={grade} variant="secondary" className="px-1.5 py-0 text-[11px] font-medium">
          {GRADE_LABELS[grade]}
        </Badge>
      ))}
      {remaining > 0 && (
        <Badge variant="outline" className="px-1.5 py-0 text-[11px] font-medium">
          +{remaining} more
        </Badge>
      )}
    </div>
  );
}

function FactItem({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Phone;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-[68px] items-start gap-2.5 rounded-lg border border-border/70 bg-muted/20 p-3">
      {Icon ? (
        <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      ) : (
        <div className="size-4 shrink-0" />
      )}
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 break-words text-sm text-foreground">{value}</div>
      </div>
    </div>
  );
}

function TemporaryPasswordDialog({
  staffName,
  email,
  password,
  onOpenChange,
}: {
  staffName: string;
  email: string;
  password: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [visible, setVisible] = useState(true);
  const [copied, setCopied] = useState(false);

  async function copyPassword() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(password);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = password;
        textArea.setAttribute("readonly", "true");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Copy failed", {
        description: "Please copy the password manually from the field.",
      });
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="border-border/80 bg-background p-6 shadow-xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Temporary password created</DialogTitle>
          <DialogDescription>
            Share this securely with {staffName}. It will not be shown again.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 text-sm shadow-sm">
            <div className="flex items-center justify-between gap-2 text-muted-foreground">
              <span>Staff</span>
              <span className="font-medium text-foreground">{staffName}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-muted-foreground">
              <span>Login</span>
              <span className="font-medium text-foreground">{email}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="temporary-password">Temporary password</Label>
            <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
              <div className="flex gap-2">
                <Input
                  id="temporary-password"
                  type={visible ? "text" : "password"}
                  value={password}
                  readOnly
                />
                <Button type="button" variant="outline" onClick={() => setVisible((v) => !v)}>
                  {visible ? "Hide" : "Show"}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="bg-primary text-primary-foreground"
              onClick={() => void copyPassword()}
            >
              {copied ? "Copied!" : "Copy password"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            This password will not be shown again. Copy it now and share it securely with the staff
            member.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditStaffDialog({
  staff,
  schoolId,
  onDone,
}: {
  staff: StaffRow;
  schoolId: string;
  onDone: () => void;
}) {
  const school = useSchool();
  const [form, setForm] = useState({
    full_name: staff.full_name,
    tsc_number: staff.tsc_number ?? "",
    gender: staff.gender ?? "",
    photo_url: staff.photo_url ?? null,
    job_title: staff.job_title ?? "",
    employment_type: staff.employment_type ?? "bom",
    phone: staff.phone ?? "",
    email: staff.email ?? "",
    employment_date: staff.employment_date ?? "",
    assigned_grades: staff.assigned_grades?.length
      ? staff.assigned_grades
      : staff.assigned_grade
        ? [staff.assigned_grade]
        : [],
    class_teacher_grade: staff.class_teacher_grade ?? "",
    class_teacher_stream_id: staff.class_teacher_stream_id ?? "",
  });
  const { data: classStreams = [] } = useQuery({
    queryKey: ["class-teacher-streams", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streams")
        .select("id, grade, name, class_teacher_id")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("grade")
        .order("name");
      if (error) throw error;
      return (data ?? []) as ClassStream[];
    },
  });
  const availableClassStreams = classStreams.filter(
    (stream) =>
      stream.grade === form.class_teacher_grade &&
      (!stream.class_teacher_id || stream.class_teacher_id === staff.id),
  );
  useEffect(() => {
    if (
      form.class_teacher_stream_id &&
      !availableClassStreams.some((stream) => stream.id === form.class_teacher_stream_id)
    ) {
      set("class_teacher_stream_id", "");
    }
  }, [availableClassStreams, form.class_teacher_stream_id]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const mutation = useMutation({
    mutationFn: async () => {
      if (
        staff.user_id &&
        form.email.trim().toLowerCase() !== (staff.email ?? "").trim().toLowerCase()
      ) {
        throw new Error("Email cannot be changed after a login account is linked.");
      }
      const update = await supabase
        .from("staff")
        .update({
          full_name: form.full_name.trim(),
          tsc_number: form.tsc_number.trim() || null,
          gender: form.gender || null,
          photo_url: form.photo_url,
          job_title: form.job_title.trim() || null,
          employment_type: form.employment_type,
          phone: form.phone ? normalizeKePhone(form.phone) : null,
          email: form.email.trim() || null,
          employment_date: form.employment_date || null,
          assigned_grade: form.assigned_grades[0] ?? null,
          assigned_grades: form.assigned_grades,
          class_teacher_grade: form.class_teacher_grade
            ? (form.class_teacher_grade as CbeGrade)
            : null,
        })
        .eq("id", staff.id)
        .eq("school_id", schoolId)
        .select("id");
      if (update.error) throw update.error;
      if (!update.data?.length) {
        throw new Error("The staff record was not found or you do not have permission to update it.");
      }
      if (form.class_teacher_stream_id) {
        const claim = await supabase
          .from("streams")
          .update({ class_teacher_id: staff.id })
          .eq("id", form.class_teacher_stream_id)
          .eq("school_id", schoolId)
          .or(`class_teacher_id.is.null,class_teacher_id.eq.${staff.id}`)
          .select("id");
        if (claim.error) throw claim.error;
        if (!claim.data?.length) {
          throw new Error("That stream already has a class teacher. Choose another stream.");
        }
      }
      if (staff.class_teacher_stream_id && staff.class_teacher_stream_id !== form.class_teacher_stream_id) {
        const clear = await supabase
          .from("streams")
          .update({ class_teacher_id: null })
          .eq("id", staff.class_teacher_stream_id)
          .eq("school_id", schoolId)
          .eq("class_teacher_id", staff.id);
        if (clear.error) throw clear.error;
      }
      await supabase.from("audit_logs").insert({
        school_id: schoolId,
        actor_id: school.userId,
        actor_name: school.fullName,
        action: "update",
        entity: "staff",
        entity_id: staff.id,
        after_data: { full_name: form.full_name.trim() },
      });
    },
    onSuccess: () => {
      toast.success("Staff member updated successfully.");
      onDone();
    },
    onError: (error: Error) =>
      toast.error("The staff member could not be updated.", { description: error.message }),
  });
  function submit() {
    const next: Record<string, string> = {};
    if (form.full_name.trim().length < 3) next.full_name = "Enter the full name.";
    if (form.phone && !KE_PHONE_REGEX.test(form.phone.replace(/\s/g, "")))
      next.phone = "Enter a valid Kenyan phone number.";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = "Enter a valid email address.";
    setErrors(next);
    if (Object.keys(next).length) return;
    mutation.mutate();
  }
  return (
    <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
      <DialogHeader className="border-b border-border/70 bg-card px-6 py-5 pr-12">
        <DialogTitle>Edit staff member</DialogTitle>
        <DialogDescription>Update this staff record.</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5 [scrollbar-color:var(--color-primary)_transparent] [scrollbar-width:thin]">
        <section className="rounded-xl border border-border/80 bg-card/70 p-4 shadow-sm">
          <SectionHeading title="Identity" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <PhotoUploader
                value={form.photo_url}
                name={form.full_name}
                onChange={(photo_url) => set("photo_url", photo_url)}
                size="md"
              />
            </div>
            <FieldRow label="Full name *" error={errors.full_name}>
              <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
            </FieldRow>
            <FieldRow label="TSC number">
              <Input value={form.tsc_number} onChange={(e) => set("tsc_number", e.target.value)} />
            </FieldRow>
            <FieldRow label="Gender">
              <Select value={form.gender} onValueChange={(value) => set("gender", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
          </div>
        </section>
        <section className="rounded-xl border border-border/80 bg-card/70 p-4 shadow-sm">
          <SectionHeading title="Role & assignments" />
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label="Job title">
              <Select value={form.job_title} onValueChange={(value) => set("job_title", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a job title" />
                </SelectTrigger>
                <SelectContent>
                  {form.job_title &&
                    !JOB_TITLE_OPTIONS.includes(
                      form.job_title as (typeof JOB_TITLE_OPTIONS)[number],
                    ) && <SelectItem value={form.job_title}>{form.job_title}</SelectItem>}
                  {JOB_TITLE_OPTIONS.map((title) => (
                    <SelectItem key={title} value={title}>
                      {title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Class-teacher grade">
              <Select
                value={form.class_teacher_grade}
                onValueChange={(value) => set("class_teacher_grade", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not a class teacher" />
                </SelectTrigger>
                <SelectContent>
                  {form.assigned_grades.map((grade) => (
                    <SelectItem key={grade} value={grade}>
                      {GRADE_LABELS[grade]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Class-teacher stream">
              <Select
                value={form.class_teacher_stream_id}
                onValueChange={(value) => set("class_teacher_stream_id", value)}
                disabled={!form.class_teacher_grade}
              >
                <SelectTrigger>
                  <SelectValue placeholder={form.class_teacher_grade ? "Select a stream" : "Choose a grade first"} />
                </SelectTrigger>
                <SelectContent>
                  {availableClassStreams.map((stream) => (
                    <SelectItem key={stream.id} value={stream.id}>
                      {stream.name}
                      {stream.class_teacher_id === staff.id ? " (current)" : ""}
                    </SelectItem>
                  ))}
                  {!availableClassStreams.length && <SelectItem value="none" disabled>No available streams</SelectItem>}
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Assigned grades" className="sm:col-span-2">
              <div className="rounded-xl border border-primary/25 bg-background/50 p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between border-b border-border/60 pb-2">
                  <span className="text-xs text-muted-foreground">
                    Select the grades this staff member can access.
                  </span>
                  <div className="flex gap-2 text-xs font-medium">
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => set("assigned_grades", school.grades)}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground hover:underline"
                      onClick={() => {
                        set("assigned_grades", []);
                        set("class_teacher_grade", "");
                      }}
                    >
                      Clear all
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {school.grades.map((grade) => {
                    const checked = form.assigned_grades.includes(grade);
                    return (
                      <label
                        key={grade}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition-colors ${checked ? "border-primary/30 bg-primary/10 text-foreground" : "border-transparent hover:bg-muted/70"}`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(nextChecked) => {
                            set(
                              "assigned_grades",
                              nextChecked
                                ? [...form.assigned_grades, grade]
                                : form.assigned_grades.filter((selected) => selected !== grade),
                            );
                            if (!nextChecked && form.class_teacher_grade === grade)
                              set("class_teacher_grade", "");
                          }}
                        />
                        {GRADE_LABELS[grade]}
                      </label>
                    );
                  })}
                </div>
              </div>
            </FieldRow>
          </div>
        </section>
        <section className="rounded-xl border border-border/80 bg-card/70 p-4 shadow-sm">
          <SectionHeading title="Employment & contact" />
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label="Employment type">
              <Select value={form.employment_type} onValueChange={(v) => set("employment_type", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tsc">TSC employed</SelectItem>
                  <SelectItem value="bom">BOM employed</SelectItem>
                  <SelectItem value="intern">Intern</SelectItem>
                  <SelectItem value="support">Support staff</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Employment date">
              <Input
                type="date"
                value={form.employment_date}
                onChange={(e) => set("employment_date", e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Phone" error={errors.phone}>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </FieldRow>
            <FieldRow label="Email" error={errors.email}>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </FieldRow>
          </div>
        </section>
      </div>
      <DialogFooter className="sticky bottom-0 border-t border-border/70 bg-background/95 px-6 py-4 backdrop-blur">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <h3 className="mb-4 border-b border-border/60 pb-2 text-sm font-semibold text-primary">
      {title}
    </h3>
  );
}

function StaffDialog({
  schoolId,
  onPasswordNotice,
  onDone,
}: {
  schoolId: string;
  onPasswordNotice: (notice: { staffName: string; email: string; password: string }) => void;
  onDone: () => void;
}) {
  const school = useSchool();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    full_name: "",
    tsc_number: "",
    national_id: "",
    gender: "",
    job_title: "Teacher",
    role: "teacher",
    employment_type: "bom",
    phone: "",
    email: "",
    confirmEmail: "",
    employment_date: new Date().toISOString().slice(0, 10),
    assigned_grades: [] as CbeGrade[],
    class_teacher_grade: "",
    class_teacher_stream_id: "",
  });

  const { data: classStreams = [] } = useQuery({
    queryKey: ["class-teacher-streams", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streams")
        .select("id, grade, name, class_teacher_id")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("grade")
        .order("name");
      if (error) throw error;
      return (data ?? []) as ClassStream[];
    },
  });
  const availableClassStreams = classStreams.filter(
    (stream) => stream.grade === form.class_teacher_grade && !stream.class_teacher_id,
  );

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const account = await createStaffWithAccount({
        data: {
          schoolId,
          email: form.email,
          fullName: form.full_name,
          tscNumber: form.tsc_number,
          nationalId: form.national_id,
          gender: form.gender,
          jobTitle: form.job_title,
          role: form.role as "teacher" | "class_teacher" | "exam_officer",
          employmentType: form.employment_type,
          phone: form.phone ? normalizeKePhone(form.phone) : "",
          employmentDate: form.employment_date,
          assignedGrades: form.assigned_grades,
          classTeacherGrade: form.class_teacher_grade,
          classTeacherStreamId: form.class_teacher_stream_id || undefined,
        },
      });
      await supabase.from("audit_logs").insert({
        school_id: schoolId,
        actor_id: school.userId,
        actor_name: school.fullName,
        action: "create",
        entity: "staff",
        entity_id: account.staffId,
        after_data: { staff_number: account.staffNumber, full_name: form.full_name },
      });
      return account;
    },
    onSuccess: (account) => {
      const notice = {
        staffName: form.full_name.trim(),
        email: account.email,
        password: account.password,
      };
      // This is displayed only once in-memory on the admin screen.
      onPasswordNotice(notice);
      toast.success("Staff account created.", {
        description: `They must change their password on first login. Temporary password is in the secure modal.`,
      });
      onDone();
    },
    onError: (error: Error) => {
      // Provide user-friendly error messages
      let title = "The staff account could not be created.";
      let description = error.message || "An unexpected error occurred. Please try again.";

      // Map specific error patterns to user-friendly messages
      if (error.message.includes("already exists for")) {
        title = "Email address already in use";
        description = error.message;
      } else if (error.message.includes("principal or deputy")) {
        title = "Permission denied";
        description = "Only school principals or deputy principals can create staff accounts.";
      } else if (error.message.includes("valid email")) {
        title = "Invalid email address";
        description = error.message;
      }

      toast.error(title, {
        description,
      });
    },
  });

  function submit() {
    const e: Record<string, string> = {};
    if (form.full_name.trim().length < 3) e["full_name"] = "Enter the full name.";
    if (!form.email.trim()) e["email"] = "Enter an email for the login account.";
    if (form.phone && !KE_PHONE_REGEX.test(form.phone.replace(/\s/g, "")))
      e["phone"] = "Enter a valid Kenyan phone number.";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      e["email"] = "Enter a valid email address.";
    if (form.email.trim() !== form.confirmEmail.trim())
      e["confirmEmail"] = "Email addresses must match exactly.";
    setErrors(e);
    if (Object.keys(e).length) {
      toast.warning("Please correct the highlighted fields.");
      return;
    }
    mutation.mutate();
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Add a staff member</DialogTitle>
        <DialogDescription>Create the staff profile and login account together.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldRow label="Full name *" error={errors["full_name"]}>
          <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
        </FieldRow>
        <FieldRow label="TSC number">
          <Input value={form.tsc_number} onChange={(e) => set("tsc_number", e.target.value)} />
        </FieldRow>
        <FieldRow label="National ID">
          <Input value={form.national_id} onChange={(e) => set("national_id", e.target.value)} />
        </FieldRow>
        <FieldRow label="Gender">
          <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="male">Male</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Job title">
          <Input value={form.job_title} onChange={(e) => set("job_title", e.target.value)} />
        </FieldRow>
        <FieldRow label="Account role *">
          <Select
            value={form.role}
            onValueChange={(v) => {
              set("role", v);
              if (v === "exam_officer") {
                set("assigned_grades", []);
                set("class_teacher_grade", "");
                set("class_teacher_stream_id", "");
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="teacher">Teacher</SelectItem>
              <SelectItem value="class_teacher">Class teacher</SelectItem>
              <SelectItem value="exam_officer">Exam Officer</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        {form.role !== "exam_officer" && (
          <FieldRow label="Assigned grades">
            <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
              {school.grades.map((grade) => (
                <label key={grade} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.assigned_grades.includes(grade)}
                    onCheckedChange={(checked) => {
                      set(
                        "assigned_grades",
                        checked
                          ? [...form.assigned_grades, grade]
                          : form.assigned_grades.filter((selected) => selected !== grade),
                      );
                      if (!checked && form.class_teacher_grade === grade) {
                        set("class_teacher_grade", "");
                        set("class_teacher_stream_id", "");
                      }
                    }}
                  />
                  {GRADE_LABELS[grade]}
                </label>
              ))}
            </div>
          </FieldRow>
        )}
        {form.role !== "exam_officer" && (
          <>
            <FieldRow label="Class-teacher grade">
            <Select
              value={form.class_teacher_grade}
              onValueChange={(value) => set("class_teacher_grade", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Not a class teacher" />
              </SelectTrigger>
              <SelectContent>
                {form.assigned_grades.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    {GRADE_LABELS[grade]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </FieldRow>
            <FieldRow label="Class-teacher stream">
            <Select
              value={form.class_teacher_stream_id}
              onValueChange={(value) => set("class_teacher_stream_id", value)}
              disabled={!form.class_teacher_grade}
            >
              <SelectTrigger>
                <SelectValue placeholder={form.class_teacher_grade ? "Select a stream" : "Choose a grade first"} />
              </SelectTrigger>
              <SelectContent>
                {availableClassStreams.map((stream) => (
                  <SelectItem key={stream.id} value={stream.id}>
                    {stream.name}
                  </SelectItem>
                ))}
                {!availableClassStreams.length && <SelectItem value="none" disabled>No available streams</SelectItem>}
              </SelectContent>
            </Select>
            </FieldRow>
          </>
        )}
        <FieldRow label="Employment type">
          <Select value={form.employment_type} onValueChange={(v) => set("employment_type", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tsc">TSC employed</SelectItem>
              <SelectItem value="bom">BOM employed</SelectItem>
              <SelectItem value="intern">Intern</SelectItem>
              <SelectItem value="support">Support staff</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Employment date">
          <Input
            type="date"
            value={form.employment_date}
            onChange={(e) => set("employment_date", e.target.value)}
          />
        </FieldRow>
        <FieldRow label="Phone" error={errors["phone"]}>
          <Input
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="0712345678"
          />
        </FieldRow>
        <FieldRow label="Email" error={errors["email"]}>
          <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </FieldRow>
        <FieldRow label="Confirm email *" error={errors["confirmEmail"]}>
          <Input
            type="email"
            value={form.confirmEmail}
            onChange={(e) => set("confirmEmail", e.target.value)}
          />
        </FieldRow>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" /> Saving…
            </>
          ) : (
            "Add staff member"
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function FieldRow({
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
