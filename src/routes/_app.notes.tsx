import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Search,
  Trash2,
  Tag as TagIcon,
  Eye,
  Pencil,
  StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Note = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

const STORAGE_KEY = "atlas.notes.v1";

function loadNotes(): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Note[];
  } catch {
    return [];
  }
}

function saveNotes(notes: Note[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [tagDraft, setTagDraft] = useState("");

  useEffect(() => {
    const initial = loadNotes();
    setNotes(initial);
    setActiveId(initial[0]?.id ?? null);
  }, []);

  useEffect(() => {
    saveNotes(notes);
  }, [notes]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => n.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [notes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes
      .filter((n) => (tagFilter ? n.tags.includes(tagFilter) : true))
      .filter((n) =>
        q
          ? n.title.toLowerCase().includes(q) ||
            n.content.toLowerCase().includes(q) ||
            n.tags.some((t) => t.toLowerCase().includes(q))
          : true,
      )
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [notes, search, tagFilter]);

  const active = notes.find((n) => n.id === activeId) ?? null;

  const createNote = () => {
    const now = new Date().toISOString();
    const note: Note = {
      id: uid(),
      title: "Untitled",
      content: "",
      tags: [],
      created_at: now,
      updated_at: now,
    };
    setNotes((prev) => [note, ...prev]);
    setActiveId(note.id);
    setMode("edit");
  };

  const updateActive = (patch: Partial<Note>) => {
    if (!active) return;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === active.id
          ? { ...n, ...patch, updated_at: new Date().toISOString() }
          : n,
      ),
    );
  };

  const deleteActive = () => {
    if (!active) return;
    const remaining = notes.filter((n) => n.id !== active.id);
    setNotes(remaining);
    setActiveId(remaining[0]?.id ?? null);
    toast.success("Note deleted");
  };

  const addTag = () => {
    const t = tagDraft.trim().toLowerCase();
    if (!t || !active) return;
    if (active.tags.includes(t)) {
      setTagDraft("");
      return;
    }
    updateActive({ tags: [...active.tags, t] });
    setTagDraft("");
  };

  const removeTag = (tag: string) => {
    if (!active) return;
    updateActive({ tags: active.tags.filter((t) => t !== tag) });
  };

  return (
    <div className="flex h-[calc(100vh-3rem)] w-full">
      {/* List pane */}
      <aside className="flex w-72 flex-col border-r border-border bg-muted/20">
        <div className="flex items-center justify-between gap-2 border-b border-border p-3">
          <h2 className="text-sm font-semibold">Notes</h2>
          <Button size="sm" onClick={createNote} className="h-8 gap-1">
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>
        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes..."
              className="h-8 pl-8"
            />
          </div>
          {allTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              <Badge
                variant={tagFilter === null ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => setTagFilter(null)}
              >
                All
              </Badge>
              {allTags.map((t) => (
                <Badge
                  key={t}
                  variant={tagFilter === t ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => setTagFilter(tagFilter === t ? null : t)}
                >
                  #{t}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <ScrollArea className="flex-1">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <StickyNote className="mx-auto mb-2 h-8 w-8 opacity-40" />
              No notes yet
            </div>
          ) : (
            <ul>
              {filtered.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => {
                      setActiveId(n.id);
                      setMode("edit");
                    }}
                    className={cn(
                      "flex w-full flex-col gap-1 border-b border-border/50 px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                      activeId === n.id && "bg-muted",
                    )}
                  >
                    <span className="truncate text-sm font-medium">
                      {n.title || "Untitled"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {n.content.replace(/[#*`>\-]/g, "").trim().slice(0, 60) ||
                        "No content"}
                    </span>
                    {n.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {n.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded bg-secondary px-1.5 text-[10px] text-secondary-foreground"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </aside>

      {/* Editor pane */}
      <section className="flex flex-1 flex-col">
        {!active ? (
          <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
            <StickyNote className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">Select a note or create a new one</p>
            <Button onClick={createNote} className="mt-4 gap-1">
              <Plus className="h-4 w-4" /> New note
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-border p-3">
              <Input
                value={active.title}
                onChange={(e) => updateActive({ title: e.target.value })}
                placeholder="Note title"
                className="h-9 border-0 bg-transparent px-0 text-lg font-semibold focus-visible:ring-0"
              />
              <div className="ml-auto flex items-center gap-1">
                <Button
                  size="sm"
                  variant={mode === "edit" ? "secondary" : "ghost"}
                  onClick={() => setMode("edit")}
                  className="h-8 gap-1"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant={mode === "preview" ? "secondary" : "ghost"}
                  onClick={() => setMode("preview")}
                  className="h-8 gap-1"
                >
                  <Eye className="h-3.5 w-3.5" /> Preview
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={deleteActive}
                  className="h-8 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-2">
              <TagIcon className="h-3.5 w-3.5 text-muted-foreground" />
              {active.tags.map((t) => (
                <Badge
                  key={t}
                  variant="secondary"
                  className="cursor-pointer gap-1 text-xs"
                  onClick={() => removeTag(t)}
                >
                  #{t} ×
                </Badge>
              ))}
              <Input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add tag..."
                className="h-6 w-28 border-0 bg-transparent px-1 text-xs focus-visible:ring-0"
              />
            </div>

            <div className="flex-1 overflow-auto">
              {mode === "edit" ? (
                <Textarea
                  value={active.content}
                  onChange={(e) => updateActive({ content: e.target.value })}
                  placeholder="Start writing in markdown..."
                  className="h-full min-h-full resize-none rounded-none border-0 bg-transparent p-6 font-mono text-sm focus-visible:ring-0"
                />
              ) : (
                <article className="prose prose-sm max-w-none p-6 dark:prose-invert">
                  {active.content.trim() ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {active.content}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground">Nothing to preview yet.</p>
                  )}
                </article>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export const Route = createFileRoute("/_app/notes")({
  component: NotesPage,
  head: () => ({ meta: [{ title: "Notes — EagleVision" }] }),
});