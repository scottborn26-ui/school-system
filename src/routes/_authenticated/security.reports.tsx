import { createFileRoute } from "@tanstack/react-router";
import { SecurityReportsPage } from "@/components/security-attendance-pages";

export const Route = createFileRoute("/_authenticated/security/reports")({
  component: SecurityReportsPage,
});
