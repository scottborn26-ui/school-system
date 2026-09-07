import { createFileRoute } from "@tanstack/react-router";
import { InventoryPage } from "./inventory";
import { RequireSchool } from "@/components/require-school";

export const Route = createFileRoute("/_authenticated/finance-inventory")({
  component: () => (
    <RequireSchool roles={["admin", "accountant", "principal", "deputy", "super_admin"]}>
      <InventoryPage />
    </RequireSchool>
  ),
});
