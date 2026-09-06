import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";

const PAGE_SIZE = 10;
export const Route = createFileRoute("/_authenticated/super-admin/schools")({
  component: SchoolsPage,
});
function SchoolsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const { data: schools = [], isLoading } = useQuery({
    queryKey: ["super-admin-schools"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("id, name, slug, county, curriculum_type, status, storage_used_mb, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const filtered = schools.filter(
    (school) =>
      `${school.name} ${school.slug ?? ""} ${school.county ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (status === "all" || school.status === status),
  );
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-emerald-600">Tenant registry</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">Schools</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage every school connected to the SHANSCOTT platform.
          </p>
        </div>
        <Button asChild>
          <Link to="/super-admin/schools/new">
            <Plus /> Onboard school
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>
            All tenants{" "}
            <span className="ml-2 text-sm font-normal text-slate-500">{filtered.length}</span>
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
              <Input
                className="pl-9"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
                placeholder="Search schools..."
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">School</th>
                  <th className="px-3 py-3">Curriculum</th>
                  <th className="px-3 py-3">Students</th>
                  <th className="px-3 py-3">Storage</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                      Loading schools...
                    </td>
                  </tr>
                ) : (
                  pageRows.map((school) => (
                    <tr key={school.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                      <td className="px-3 py-4">
                        <p className="font-medium">{school.name}</p>
                        <p className="text-xs text-slate-500">
                          {school.slug
                            ? `${school.slug}.shanscott.com`
                            : (school.county ?? "No subdomain")}
                        </p>
                      </td>
                      <td className="px-3 py-4 capitalize">
                        {school.curriculum_type?.replaceAll("_", " ")}
                      </td>
                      <td className="px-3 py-4">Tracked in tenant</td>
                      <td className="px-3 py-4">{school.storage_used_mb ?? 0} MB</td>
                      <td className="px-3 py-4">
                        <Badge
                          variant={
                            school.status === "active"
                              ? "default"
                              : school.status === "suspended"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {school.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-4 text-right">
                        <Button asChild variant="ghost" size="icon">
                          <Link
                            to="/super-admin/schools/$schoolId"
                            params={{ schoolId: school.id }}
                            aria-label={`Open ${school.name}`}
                          >
                            <ArrowRight />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!isLoading && pageRows.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">
              No schools match these filters.
            </p>
          )}
          <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm text-slate-500">
            <span>
              Page {page + 1} of {pages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pages - 1}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
