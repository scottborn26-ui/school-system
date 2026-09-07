import { createFileRoute } from "@tanstack/react-router";
import { SecurityTodayPage } from "@/components/security-attendance-pages";

export const Route = createFileRoute("/_authenticated/security/today")({
  component: SecurityTodayPage,
});
