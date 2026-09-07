import { createFileRoute } from "@tanstack/react-router";
import { GeneralLedgerPage } from "./general-ledger";
import { RequireSchool } from "@/components/require-school";

export const Route = createFileRoute("/_authenticated/finance-general-ledger")({
  component: () => (
    <RequireSchool roles={["admin", "accountant", "principal", "deputy", "super_admin"]}>
      <GeneralLedgerPage />
    </RequireSchool>
  ),
});
