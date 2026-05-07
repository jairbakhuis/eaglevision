import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";
export const Route = createFileRoute("/_app/tasks")({
  component: () => (
    <PageStub
      title="Tasks"
      description="Todoist-style projects with list ↔ kanban toggle and a dashboard on top."
    />
  ),
  head: () => ({ meta: [{ title: "Tasks — Atlas" }] }),
});