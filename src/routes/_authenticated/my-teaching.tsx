import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck } from "lucide-react";
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
              <Card key={assignment.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {assignment.learning_areas?.name ?? "Learning area"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    {assignment.streams?.grade ? GRADE_LABELS[assignment.streams.grade] : "Class"} · {assignment.streams?.name ?? "Stream"}
                  </span>
                  <Badge variant="secondary">{assignment.periods_per_week} periods/week</Badge>
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
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {timetable.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="flex items-center justify-between gap-3 py-4 text-sm">
                  <div>
                    <div className="font-medium">
                      {entry.learning_areas?.name ?? "Learning area"} · {entry.streams?.name ?? "Class"}
                    </div>
                    <div className="text-muted-foreground">
                      {dayNames[entry.day_of_week - 1] ?? `Day ${entry.day_of_week}`} · Period {entry.period_index}
                    </div>
                  </div>
                  <Badge>Published</Badge>
                </CardContent>
              </Card>
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
