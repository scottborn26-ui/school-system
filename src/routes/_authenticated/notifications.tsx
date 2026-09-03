import { createFileRoute } from "@tanstack/react-router";
import { NotificationsPage } from "@/components/notifications-page";
import { RequireSchool } from "@/components/require-school";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications · SHANSCOTT CBE" }] }),
  component: () => (
    <RequireSchool>
      <NotificationsPage />
    </RequireSchool>
  ),
});
