import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";
export const Route = createFileRoute("/_app/documents")({
  component: () => (
    <PageStub
      title="Documents"
      description="Notion-style nested pages with block editor, slash menu, and sub-pages."
    />
  ),
  head: () => ({ meta: [{ title: "Documents — EagleVision" }] }),
});