import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, CalendarDays, Clock3, Users } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { RequireSchool } from "@/components/require-school";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSchool } from "@/hooks/use-school";
import { GRADE_LABELS, type CbeGrade } from "@/lib/cbe";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/my-teaching")({
  head: () => ({
    meta: [
      { title: "My Teaching · SHANSCOTT CBE" },
      { name: "description", content: "View your assigned learning areas, classes and timetable." },
    ],
  }),
  component: () => (
    <RequireSchool roles={["teacher", "class_teacher"]}>
      <MyTeachingPage />
    </RequireSchool>
  ),
});

type Assignment = {
  id: string;
  stream_id: string;
  learning_area_id: string;
  periods_per_week: number;
  streams: { name: string; grade: CbeGrade } | null;
  learning_areas: { name: string } | null;
};

type TimetableEntry = {
  id: string;
  day_of_week: number;
  period_index: number;
  stream_id: string;
  learning_area_id: string;
  streams: { name: string } | null;
  learning_areas: { name: string } | null;
};

function MyTeachingPage() {
  const school = useSchool();
  const schoolId = school.schoolId!;
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  const teaching = useQuery({
    queryKey: ["my-teaching", schoolId, school.userId, school.academicYearId],
    queryFn: async () => {
      const { data: staff, error: staffError } = await supabase
        .from("staff")
        .select("id")
        .eq("school_id", schoolId)
        .eq("user_id", school.userId)
        .eq("is_archived", false)
        .eq("status", "active")
        .maybeSingle();
      if (staffError) throw staffError;
      if (!staff) return { assignments: [] as Assignment[], timetable: [] as TimetableEntry[] };

      const [assignments, timetable] = await Promise.all([
        supabase
          .from("teacher_allocations")
          .select("id, stream_id, learning_area_id, periods_per_week, streams(name, grade), learning_areas(name)")
          .eq("school_id", schoolId)
          .eq("staff_id", staff.id)
          .or(`academic_year_id.is.null,academic_year_id.eq.${school.academicYearId}`)
          .eq("is_active", true),
        supabase
          .from("timetable_slots")
          .select("id, day_of_week, period_index, stream_id, learning_area_id, streams(name), learning_areas(name), timetables!inner(status, academic_year_id)")
          .eq("school_id", schoolId)
          .eq("staff_id", staff.id)
          .eq("timetables.status", "published")
          .eq("timetables.academic_year_id", school.academicYearId!)
          .order("day_of_week")
          .order("period_index"),
      ]);
      if (assignments.error) throw assignments.error;
      if (timetable.error) throw timetable.error;
      return {
        assignments: (assignments.data ?? []) as Assignment[],
        timetable: (timetable.data ?? []) as TimetableEntry[],
      };
    },
  });

  const assignments = teaching.data?.assignments ?? [];
  const timetable = teaching.data?.timetable ?? [];
  const timetableByDay = dayNames.map((day, index) => ({
    day,
    entries: timetable.filter((entry) => entry.day_of_week === index + 1),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Teaching"
        description="Your assigned learning areas, classes and published timetable lessons."
        icon={BookOpenCheck}
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Learning areas and classes</h2>
          <p className="text-sm text-muted-foreground">These are the assignments available to you.</p>
        </div>
        {assignments.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {assignments.map((assignment) => (
              <Card key={assignment.id} className="overflow-hidden border-l-4 border-l-primary shadow-sm">
                <CardHeader className="gap-3 bg-muted/25 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base leading-tight">
                    {assignment.learning_areas?.name ?? "Learning area"}
                    </CardTitle>
                    <Badge variant="secondary" className="shrink-0">
                      {assignment.periods_per_week} / week
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="size-4 text-primary" />
                    <span>
                      {assignment.streams?.grade ? GRADE_LABELS[assignment.streams.grade] : "Class"} · {assignment.streams?.name ?? "Stream"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center gap-2 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Clock3 className="size-4" /> Teaching load
                  <span className="ml-auto normal-case tracking-normal text-foreground">{assignment.periods_per_week} periods per week</span>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              No active teaching assignments are available for this academic year.
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Published timetable</h2>
          <p className="text-sm text-muted-foreground">Lessons currently available for attendance and teaching.</p>
        </div>
        {timetable.length ? (
          <div className="space-y-5">
            {timetableByDay.filter((day) => day.entries.length > 0).map((day) => (
              <div key={day.day} className="space-y-2">
                <div className="flex items-center gap-2 border-b pb-2">
                  <CalendarDays className="size-4 text-primary" />
                  <h3 className="font-semibold">{day.day}</h3>
                  <Badge variant="outline" className="ml-auto">{day.entries.length} {day.entries.length === 1 ? "lesson" : "lessons"}</Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {day.entries.map((entry) => (
                    <Card key={entry.id} className="border-l-4 border-l-emerald-500 shadow-sm">
                      <CardContent className="flex items-center justify-between gap-3 py-4 text-sm">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">
                            {entry.learning_areas?.name ?? "Learning area"}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                            <Users className="size-3.5" /> {entry.streams?.name ?? "Class"}
                          </div>
                        </div>
                        <Badge className="shrink-0 gap-1">
                          <Clock3 className="size-3" /> P{entry.period_index}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              No published timetable lessons are assigned to you yet.
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
