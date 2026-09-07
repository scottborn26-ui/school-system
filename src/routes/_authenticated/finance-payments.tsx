import { createFileRoute } from "@tanstack/react-router";
import { FinancePage } from "./finance";
import { RequireSchool } from "@/components/require-school";

export const Route = createFileRoute("/_authenticated/finance-payments")({
  component: () => (
    <RequireSchool roles={["admin", "accountant", "principal", "deputy", "super_admin"]}>
      <FinancePage initialTab="payments" standalone />
    </RequireSchool>
  ),
});
