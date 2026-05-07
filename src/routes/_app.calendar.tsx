import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";
export const Route = createFileRoute("/_app/calendar")({
  component: () => (
    <PageStub title="Calendar" description="Month/week/day views with drag-to-reschedule." />
  ),
  head: () => ({ meta: [{ title: "Calendar — Atlas" }] }),
});