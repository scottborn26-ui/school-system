import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarDays, Layers3 } from "lucide-react";
import {
  DataTable,
  MetricStrip,
  PlatformPage,
  StatusBadge,
  fetchPlatformRows,
} from "@/components/platform-page";

export const Route = createFileRoute("/_authenticated/super-admin/academics")({
  component: AcademicsPage,
});
type Year = {
  id: string;
  school_id: string;
  name: string;
  is_current: boolean;
  start_date: string;
  end_date: string;
};
type Area = { id: string; school_id: string; name: string; is_active: boolean };
type Offering = {
  id: string;
  school_id: string;
  grade: string;
  level: string;
  pathway: string | null;
  is_active: boolean;
};

function AcademicsPage() {
  const years = useQuery({
    queryKey: ["platform-academic-years"],
    queryFn: () =>
      fetchPlatformRows<Year>("academic_years", "id,school_id,name,is_current,start_date,end_date"),
  });
  const areas = useQuery({
    queryKey: ["platform-learning-areas"],
    queryFn: () => fetchPlatformRows<Area>("learning_areas", "id,school_id,name,is_active"),
  });
  const offerings = useQuery({
    queryKey: ["platform-grade-offerings"],
    queryFn: () =>
      fetchPlatformRows<Offering>(
        "school_grade_offerings",
        "id,school_id,grade,level,pathway,is_active",
      ),
  });
  return (
    <PlatformPage
      eyebrow="Academics & CBC / CBE"
      title="Academic configuration"
      description="Review academic years, grade offerings, learning areas, pathways, competencies, and assessment foundations across every school."
    >
      <MetricStrip
        items={[
          { label: "Academic years", value: years.data?.length ?? "-", icon: CalendarDays },
          {
            label: "Grade offerings",
            value: offerings.data?.length ?? "-",
            icon: Layers3,
            tone: "blue",
          },
          {
            label: "Learning areas",
            value: areas.data?.length ?? "-",
            icon: BookOpen,
            tone: "amber",
          },
        ]}
      />
      <DataTable
        columns={["Grade", "CBE level", "Pathway", "School ID", "Status"]}
        loading={offerings.isLoading}
        error={
          offerings.error
            ? "Academic configuration is unavailable. Apply the academic migrations and platform read policies."
            : undefined
        }
        empty="No grade offerings configured yet."
      >
        {(offerings.data ?? []).map((offering) => (
          <tr key={offering.id} className="border-b border-border/60">
            <td className="px-4 py-4 font-bold">{offering.grade}</td>
            <td className="px-4 py-4 capitalize">{offering.level.replaceAll("_", " ")}</td>
            <td className="px-4 py-4 text-sm text-muted-foreground">
              {offering.pathway ?? "Core"}
            </td>
            <td className="px-4 py-4 font-mono text-xs">{offering.school_id.slice(0, 12)}...</td>
            <td className="px-4 py-4">
              <StatusBadge value={offering.is_active ? "active" : "archived"} />
            </td>
          </tr>
        ))}
      </DataTable>
    </PlatformPage>
  );
}
