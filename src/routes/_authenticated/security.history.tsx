import { createFileRoute } from "@tanstack/react-router";
import { SecurityHistoryPage } from "@/components/security-attendance-pages";

export const Route = createFileRoute("/_authenticated/security/history")({
  component: SecurityHistoryPage,
});
