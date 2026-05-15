import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  FileText,
  Eye,
  Pencil,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Page = {
  id: string;
  title: string;
  content: string;
  parent_id: string | null;
  project_id: string | null;
  icon: string | null;
  position: number;
  updated_at: string;
};

function DocumentsPage() {
  const [pages, setPages] = useState<Page[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [treeOpen, setTreeOpen] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setUserId(u.user?.id ?? null);
      const { data, error } = await supabase
        .from("pages")
        .select("id,title,content,parent_id,project_id,icon,position,updated_at")
        .order("position");
      if (error) toast.error(error.message);
      const list = (data as Page[]) ?? [];
      setPages(list);
      setActiveId(list.find((p) => !p.parent_id)?.id ?? list[0]?.id ?? null);
      setLoading(false);
    })();
  }, []);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, Page[]>();
    for (const p of pages) {
      const arr = map.get(p.parent_id) ?? [];
      arr.push(p);
      map.set(p.parent_id, arr);
    }
    return map;
  }, [pages]);

  const active = pages.find((p) => p.id === activeId) ?? null;

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function requireUserId() {
    if (userId) return userId;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      toast.error("Sign in to create documents.");
      return null;
    }
    setUserId(data.user.id);
    return data.user.id;
  }

  async function createPage(parentId: string | null) {
    const currentUserId = await requireUserId();
    if (!currentUserId) return;
    const { data, error } = await supabase
      .from("pages")
      .insert({
        user_id: currentUserId,
        title: "Untitled",
        content: "",
        parent_id: parentId,
        position: pages.filter((p) => p.parent_id === parentId).length,
      })
      .select("id,title,content,parent_id,project_id,icon,position,updated_at")
      .single();
    if (error) return toast.error(error.message);
    const page = data as Page;
    setPages((prev) => [...prev, page]);
    if (parentId) {
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(parentId);
        return next;
      });
    }
    setActiveId(page.id);
    setMode("edit");
    setTreeOpen(false);
    toast.success(parentId ? "Sub-page created" : "Document created");
  }

  function collectDescendants(rootId: string): string[] {
    const out: string[] = [rootId];
    const queue = [rootId];
    while (queue.length) {
      const cur = queue.shift()!;
      const kids = childrenByParent.get(cur) ?? [];
      for (const k of kids) {
        out.push(k.id);
        queue.push(k.id);
      }
    }
    return out;
  }

  async function deletePage(id: string) {
    if (!confirm("Delete this page and all sub-pages?")) return;
    const ids = collectDescendants(id);
    setPages((prev) => prev.filter((p) => !ids.includes(p.id)));
    if (activeId && ids.includes(activeId)) setActiveId(null);
    const { error } = await supabase.from("pages").delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`Deleted ${ids.length} page${ids.length > 1 ? "s" : ""}`);
  }

  function updateActiveLocal(patch: Partial<Page>) {
    if (!active) return;
    const next = { ...active, ...patch, updated_at: new Date().toISOString() };
    setPages((prev) => prev.map((p) => (p.id === active.id ? next : p)));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from("pages")
        .update({ ...patch, updated_at: next.updated_at })
        .eq("id", active.id);
      if (error) toast.error(error.message);
    }, 500);
  }

  return (
    <div className="flex min-h-[calc(100svh-64px)] w-full md:h-[calc(100vh-3rem)] md:min-h-0">
      {/* Tree pane */}
      <aside
        className={cn(
          "w-full flex-col border-r border-border bg-muted/20 md:flex md:w-72",
          treeOpen ? "flex" : "hidden",
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border p-3">
          <h2 className="text-sm font-semibold">Documents</h2>
          <Button size="sm" onClick={() => createPage(null)} className="h-8 gap-1">
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (childrenByParent.get(null) ?? []).length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
              No pages yet
            </div>
          ) : (
            <div className="p-2">
              {(childrenByParent.get(null) ?? []).map((p) => (
                <PageNode
                  key={p.id}
                  page={p}
                  depth={0}
                  childrenByParent={childrenByParent}
                  activeId={activeId}
                  collapsed={collapsed}
                  onSelect={(id) => {
                    setActiveId(id);
                    setMode("edit");
                    setTreeOpen(false);
                  }}
                  onToggleCollapse={toggleCollapse}
                  onAddChild={(parentId) => createPage(parentId)}
                  onDelete={deletePage}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </aside>

      {/* Editor pane */}
      <section className={cn("flex flex-1 flex-col", treeOpen && "hidden md:flex")}>
        <div className="flex items-center justify-between border-b border-border p-3 md:hidden">
          <Button size="icon" variant="ghost" onClick={() => setTreeOpen(true)} aria-label="Open documents">
            <Menu className="h-5 w-5" />
          </Button>
          <span className="max-w-[180px] truncate text-sm font-semibold">{active?.title || "Documents"}</span>
          <Button size="icon" variant="ghost" onClick={() => createPage(null)} aria-label="New document">
            <Plus className="h-5 w-5" />
          </Button>
        </div>
        {!active ? (
          <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
            <FileText className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">Select a page or create a new one</p>
            <Button onClick={() => createPage(null)} className="mt-4 gap-1">
              <Plus className="h-4 w-4" /> New page
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-border p-3">
              <Input
                value={active.title}
                onChange={(e) => updateActiveLocal({ title: e.target.value })}
                placeholder="Page title"
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
                  onClick={() => createPage(active.id)}
                  className="h-8 gap-1"
                  title="Add sub-page"
                >
                  <Plus className="h-3.5 w-3.5" /> Sub-page
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deletePage(active.id)}
                  className="h-8 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              {mode === "edit" ? (
                <Textarea
                  value={active.content}
                  onChange={(e) => updateActiveLocal({ content: e.target.value })}
                  placeholder="Start writing in markdown…"
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

function PageNode({
  page,
  depth,
  childrenByParent,
  activeId,
  collapsed,
  onSelect,
  onToggleCollapse,
  onAddChild,
  onDelete,
}: {
  page: Page;
  depth: number;
  childrenByParent: Map<string | null, Page[]>;
  activeId: string | null;
  collapsed: Set<string>;
  onSelect: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
}) {
  const kids = childrenByParent.get(page.id) ?? [];
  const isCollapsed = collapsed.has(page.id);
  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md px-1.5 py-1 text-sm hover:bg-muted/60",
          activeId === page.id && "bg-muted",
        )}
        style={{ paddingLeft: 6 + depth * 12 }}
      >
        <button
          onClick={() => onToggleCollapse(page.id)}
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground",
            kids.length === 0 && "invisible",
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          onClick={() => onSelect(page.id)}
          className="flex-1 truncate text-left"
        >
          {page.title || "Untitled"}
        </button>
        <button
          onClick={() => onAddChild(page.id)}
          className="opacity-0 transition group-hover:opacity-100"
          title="Add sub-page"
        >
          <Plus className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
        </button>
        <button
          onClick={() => onDelete(page.id)}
          className="opacity-0 transition group-hover:opacity-100"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </button>
      </div>
      {!isCollapsed &&
        kids.map((k) => (
          <PageNode
            key={k.id}
            page={k}
            depth={depth + 1}
            childrenByParent={childrenByParent}
            activeId={activeId}
            collapsed={collapsed}
            onSelect={onSelect}
            onToggleCollapse={onToggleCollapse}
            onAddChild={onAddChild}
            onDelete={onDelete}
          />
        ))}
    </div>
  );
}

export const Route = createFileRoute("/_app/documents")({
  component: DocumentsPage,
  head: () => ({ meta: [{ title: "Documents — J.P.A. OS" }] }),
});