import { createFileRoute } from "@tanstack/react-router";
import { AdmissionsPage } from "@/components/admissions-page";
import { RequireSchool } from "@/components/require-school";

export const Route = createFileRoute("/_authenticated/admissions")({
  head: () => ({ meta: [{ title: "Admissions · SHANSCOTT CBE" }] }),
  component: () => (
    <RequireSchool roles={["principal", "deputy"]}>
      <AdmissionsPage />
    </RequireSchool>
  ),
});
