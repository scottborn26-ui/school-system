import { createFileRoute } from "@tanstack/react-router";
import { SecurityDashboardPage } from "@/components/security-attendance-pages";

export const Route = createFileRoute("/_authenticated/security")({
  component: SecurityDashboardPage,
});
