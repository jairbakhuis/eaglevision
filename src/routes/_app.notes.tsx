import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "@/components/PageStub";
export const Route = createFileRoute("/_app/notes")({
  component: () => (
    <PageStub title="Notes" description="Markdown notes with tags and full-text search." />
  ),
  head: () => ({ meta: [{ title: "Notes — Atlas" }] }),
});