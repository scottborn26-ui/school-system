import { createFileRoute } from "@tanstack/react-router";
import { MessageCenter } from "@/components/message-center";
import { RequireSchool } from "@/components/require-school";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({ meta: [{ title: "Messages · SHANSCOTT CBE" }] }),
  component: () => (
    <RequireSchool>
      <MessageCenter />
    </RequireSchool>
  ),
});
