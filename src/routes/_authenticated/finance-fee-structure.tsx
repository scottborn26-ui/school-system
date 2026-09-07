import { createFileRoute } from "@tanstack/react-router";
import { FinancePage } from "./finance";
import { RequireSchool } from "@/components/require-school";

export const Route = createFileRoute("/_authenticated/finance-fee-structure")({
  component: () => (
    <RequireSchool roles={["admin", "accountant", "principal", "deputy", "super_admin"]}>
      <FinancePage initialTab="items" standalone />
    </RequireSchool>
  ),
});
