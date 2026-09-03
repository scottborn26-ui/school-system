import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Eye, Mail, Phone, Search, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { RequireSchool } from "@/components/require-school";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useSchool } from "@/hooks/use-school";

export const Route = createFileRoute("/_authenticated/parents")({
  head: () => ({
    meta: [{ title: "Parents · SHANSCOTT CBE" }],
  }),
  component: () => (
    <RequireSchool roles={["admin", "principal", "deputy"]}>
      <ParentsPage />
    </RequireSchool>
  ),
});

type Guardian = {
  id: string;
  full_name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  portal_access: boolean;
  learner_guardians: Array<{ learner_id: string }>;
};

type LinkedLearner = { id: string; first_name: string; last_name: string; current_grade: string | null };

function ParentsPage() {
  const school = useSchool();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedParent, setSelectedParent] = useState<Guardian | null>(null);
  const [parentToDelete, setParentToDelete] = useState<Guardian | null>(null);
  const parentsQuery = useQuery({
    queryKey: ["parents", school.schoolId],
    enabled: Boolean(school.schoolId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guardians")
        .select("id, full_name, relationship, phone, email, address, portal_access, learner_guardians(learner_id)")
        .eq("school_id", school.schoolId!)
        .eq("is_archived", false)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Guardian[];
    },
  });

  const learnersQuery = useQuery({
    queryKey: ["parent-learners", selectedParent?.id],
    enabled: Boolean(selectedParent),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learner_guardians")
        .select("learners(id, first_name, last_name, current_grade)")
        .eq("guardian_id", selectedParent!.id)
        .eq("school_id", school.schoolId!);
      if (error) throw error;
      return (data ?? []).flatMap((row) => row.learners as unknown as LinkedLearner[]);
    },
  });

  const deleteParent = useMutation({
    mutationFn: async (parent: Guardian) => {
      const { error } = await supabase
        .from("guardians")
        .update({ is_archived: true })
        .eq("id", parent.id)
        .eq("school_id", school.schoolId!);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["parents", school.schoolId] });
      setParentToDelete(null);
    },
  });

  const parents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (parentsQuery.data ?? []).filter((parent) =>
      !query || [parent.full_name, parent.phone, parent.email, parent.relationship]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [parentsQuery.data, search]);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(parents.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedParents = parents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parents"
        description="View parent and guardian contacts linked to learners in your school."
        icon={Users}
      />
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search parents"
              aria-label="Search parents"
              className="pl-9"
            />
          </div>
          {parentsQuery.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading parents...</p>
          ) : parentsQuery.isError ? (
            <p className="py-8 text-center text-sm text-destructive">Parents could not be loaded.</p>
          ) : parents.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {search ? "No parents match your search." : "No parents have been registered yet."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Parent / guardian</th>
                    <th className="px-4 py-3 font-semibold">Contact</th>
                    <th className="px-4 py-3 font-semibold">Relationship</th>
                    <th className="px-4 py-3 font-semibold">Learners</th>
                    <th className="px-4 py-3 font-semibold">Portal</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedParents.map((parent) => (
                    <tr key={parent.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{parent.full_name}</p>
                        {parent.address && <p className="mt-1 text-xs text-muted-foreground">{parent.address}</p>}
                      </td>
                      <td className="space-y-1 px-4 py-3 text-muted-foreground">
                        {parent.phone && <p className="flex items-center gap-2"><Phone className="size-3.5" />{parent.phone}</p>}
                        {parent.email && <p className="flex items-center gap-2"><Mail className="size-3.5" />{parent.email}</p>}
                        {!parent.phone && !parent.email && "No contact details"}
                      </td>
                      <td className="px-4 py-3 capitalize">{parent.relationship || "Parent"}</td>
                      <td className="px-4 py-3">{parent.learner_guardians.length}</td>
                      <td className="px-4 py-3">
                        <Badge variant={parent.portal_access ? "default" : "secondary"}>
                          {parent.portal_access ? "Enabled" : "Not enabled"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" aria-label={`View ${parent.full_name}`} onClick={() => setSelectedParent(parent)}>
                            <Eye className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label={`Delete ${parent.full_name}`} className="text-destructive hover:text-destructive" onClick={() => setParentToDelete(parent)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
                <span>
                  Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, parents.length)} of {parents.length} parents
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="size-4" /> Previous
                  </Button>
                  <span className="min-w-20 text-center">Page {currentPage} of {pageCount}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                    disabled={currentPage === pageCount}
                  >
                    Next <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={Boolean(selectedParent)} onOpenChange={(open) => !open && setSelectedParent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedParent?.full_name}</DialogTitle>
            <DialogDescription>Linked learners and parent contact details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <p><span className="font-medium">Phone:</span> {selectedParent?.phone || "Not provided"}</p>
              <p><span className="font-medium">Email:</span> {selectedParent?.email || "Not provided"}</p>
              <p><span className="font-medium">Relationship:</span> {selectedParent?.relationship || "Parent"}</p>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Students</h3>
              {learnersQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading students...</p>
              ) : learnersQuery.data?.length ? (
                <div className="space-y-2">
                  {learnersQuery.data.map((learner) => (
                    <div key={learner.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <span className="font-medium">{learner.first_name} {learner.last_name}</span>
                      <Badge variant="secondary">{learner.current_grade || "Grade not assigned"}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No students are linked to this parent.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(parentToDelete)} onOpenChange={(open) => !open && setParentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {parentToDelete?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the parent from the active parent list while preserving linked learner history.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => parentToDelete && deleteParent.mutate(parentToDelete)} disabled={deleteParent.isPending}>
              Delete parent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
