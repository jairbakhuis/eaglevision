import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Plus,
  Inbox,
  CalendarDays,
  CalendarClock,
  Hash,
  Trash2,
  LayoutList,
  Columns3,
  Flag,
  CheckCircle2,
  Circle,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Repeat,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  format,
  isToday,
  isPast,
  isThisWeek,
  startOfDay,
  endOfDay,
} from "date-fns";
import { parseTask, nextOccurrence } from "@/lib/taskParser";
import * as rruleNamespace from "rrule";
import { compileFilter, validateQuery, describeQuery } from "@/lib/filterQuery";
import { Filter as FilterIcon, Pencil, Eye, EyeOff } from "lucide-react";
import {
  PropertiesManagerButton,
  PropertyChips,
  TaskPropertiesSection,
  useCustomProperties,
  type TaskProperty,
} from "@/components/tasks/CustomProperties";

type RRuleModule = typeof import("rrule");
const rruleCompat = rruleNamespace as unknown as Partial<RRuleModule> & {
  default?: RRuleModule;
  rrule?: RRuleModule;
};
const rrulePkg = (rruleCompat.RRule ? rruleCompat : rruleCompat.default ?? rruleCompat.rrule) as RRuleModule;
const { RRule } = rrulePkg;

export const Route = createFileRoute("/_app/tasks")({
  component: TasksPage,
  head: () => ({ meta: [{ title: "Tasks — J.P.A. OS" }] }),
});

type Project = {
  id: string;
  name: string;
  color: string;
  view: string;
  position: number;
};
type Task = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: number;
  status: string;
  project_id: string | null;
  position: number;
  completed_at: string | null;
  parent_task_id: string | null;
  rrule?: string | null;
};

type Filter =
  | { kind: "inbox" }
  | { kind: "today" }
  | { kind: "upcoming" }
  | { kind: "project"; id: string }
  | { kind: "saved"; id: string };

type SavedFilter = {
  id: string;
  name: string;
  query: string;
  color: string;
  icon: string | null;
  position: number;
};

const PRIORITY_COLORS: Record<number, string> = {
  1: "text-red-500",
  2: "text-orange-500",
  3: "text-blue-500",
  4: "text-muted-foreground",
};
const PROJECT_COLORS = [
  "#ef4444", "#f59e0b", "#10b981", "#3b82f6",
  "#8b5cf6", "#ec4899", "#14b8a6", "#6366f1",
];
const KANBAN_COLUMNS = [
  { id: "todo", label: "To do" },
  { id: "in_progress", label: "In progress" },
  { id: "done", label: "Done" },
];

function TasksPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [filterDialog, setFilterDialog] = useState<SavedFilter | { isNew: true } | null>(null);
  const [filter, setFilter] = useState<Filter>({ kind: "inbox" });
  const [view, setView] = useState<"list" | "kanban">("list");
  const [showCompleted, setShowCompleted] = useState(true);
  const [quickAdd, setQuickAdd] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[3]);
  const [editing, setEditing] = useState<Task | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const quickAddRef = useRef<HTMLInputElement>(null);

  // Notion-style custom properties (workspace-wide)
  const customProps = useCustomProperties(userId);

  // Live preview of what natural-language quick-add will produce
  const parsedPreview = useMemo(
    () => (quickAdd.trim() ? parseTask(quickAdd) : null),
    [quickAdd],
  );

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUserId(data.user?.id ?? null);
      setAuthLoading(false);
    });
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setAuthLoading(false);
    });
    return () => {
      mounted = false;
      authSub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      setProjects([]);
      setTasks([]);
      return;
    }
    loadAll();
  }, [authLoading, userId]);

  async function loadAll() {
    const [
      { data: p, error: projectsError },
      { data: t, error: tasksError },
      { data: f, error: filtersError },
    ] = await Promise.all([
      supabase.from("projects").select("*").order("position"),
      supabase.from("tasks").select("*").order("position"),
      supabase.from("filters").select("*").order("position"),
    ]);
    if (projectsError) toast.error(projectsError.message);
    if (tasksError) toast.error(tasksError.message);
    if (filtersError) toast.error(filtersError.message);
    setProjects(p ?? []);
    setTasks(t ?? []);
    setSavedFilters((f as SavedFilter[]) ?? []);
  }

  async function requireUserId() {
    if (userId) return userId;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      toast.error("Sign in to create projects and tasks.");
      return null;
    }
    setUserId(data.user.id);
    return data.user.id;
  }

  // Stats for dashboard
  const stats = useMemo(() => {
    const open = tasks.filter((t) => t.status !== "done");
    const today = open.filter(
      (t) => t.due_date && isToday(new Date(t.due_date)),
    );
    const overdue = open.filter(
      (t) => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)),
    );
    const completedToday = tasks.filter(
      (t) =>
        t.completed_at &&
        isToday(new Date(t.completed_at)),
    );
    const week = open.filter(
      (t) => t.due_date && isThisWeek(new Date(t.due_date), { weekStartsOn: 1 }),
    );
    return { open: open.length, today: today.length, overdue: overdue.length, completedToday: completedToday.length, week: week.length };
  }, [tasks]);

  // Filtered tasks
  const filtered = useMemo(() => {
    let list = tasks.filter((t) => !t.parent_task_id);
    if (filter.kind === "inbox") list = list.filter((t) => !t.project_id);
    else if (filter.kind === "today")
      list = list.filter(
        (t) =>
          t.due_date &&
          (isToday(new Date(t.due_date)) ||
            (isPast(new Date(t.due_date)) && t.status !== "done")),
      );
    else if (filter.kind === "upcoming")
      list = list.filter(
        (t) => t.due_date && new Date(t.due_date) >= startOfDay(new Date()),
      );
    else if (filter.kind === "project")
      list = list.filter((t) => t.project_id === filter.id);
    else if (filter.kind === "saved") {
      const sf = savedFilters.find((x) => x.id === filter.id);
      if (sf) {
        const pred = compileFilter(sf.query);
        list = list.filter((t) => pred(t as any, projects));
      }
    }
    if (!showCompleted) list = list.filter((t) => t.status !== "done");
    return list;
  }, [tasks, filter, savedFilters, projects, showCompleted]);

  const filterTitle =
    filter.kind === "inbox"
      ? "Inbox"
      : filter.kind === "today"
        ? "Today"
        : filter.kind === "upcoming"
          ? "Upcoming"
          : filter.kind === "project"
            ? projects.find((p) => p.id === filter.id)?.name ?? "Project"
            : savedFilters.find((s) => s.id === filter.id)?.name ?? "Filter";

  async function saveFilter(payload: {
    id?: string;
    name: string;
    query: string;
    color: string;
  }) {
    const currentUserId = await requireUserId();
    if (!currentUserId) return;
    if (payload.id) {
      const { data, error } = await supabase
        .from("filters")
        .update({
          name: payload.name,
          query: payload.query,
          color: payload.color,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payload.id)
        .select()
        .single();
      if (error) return toast.error(error.message);
      setSavedFilters((s) =>
        s.map((x) => (x.id === payload.id ? (data as SavedFilter) : x)),
      );
    } else {
      const { data, error } = await supabase
        .from("filters")
        .insert({
          user_id: currentUserId,
          name: payload.name,
          query: payload.query,
          color: payload.color,
          position: savedFilters.length,
        })
        .select()
        .single();
      if (error) return toast.error(error.message);
      const inserted = data as SavedFilter;
      setSavedFilters((s) => [...s, inserted]);
      setFilter({ kind: "saved", id: inserted.id });
    }
    setFilterDialog(null);
    toast.success("Filter saved");
  }

  async function deleteSavedFilter(id: string) {
    if (!confirm("Delete this filter?")) return;
    await supabase.from("filters").delete().eq("id", id);
    setSavedFilters((s) => s.filter((x) => x.id !== id));
    if (filter.kind === "saved" && filter.id === id) setFilter({ kind: "today" });
  }

  async function addQuick() {
    if (creatingTask) return;
    if (!quickAdd.trim()) {
      quickAddRef.current?.focus();
      return;
    }
    const currentUserId = await requireUserId();
    if (!currentUserId) return;
    const text = quickAdd.trim();
    setCreatingTask(true);
    setQuickAdd("");
    const parsed = parseTask(text);

    // Match #project name to an existing project (case-insensitive)
    let projectId: string | null = filter.kind === "project" ? filter.id : null;
    if (parsed.projectName) {
      const match = projects.find(
        (p) => p.name.toLowerCase() === parsed.projectName!.toLowerCase(),
      );
      if (match) projectId = match.id;
    }

    // Date: parser wins; otherwise default by current view
    const due = parsed.dueDate
      ? parsed.dueDate.toISOString()
      : filter.kind === "today" || filter.kind === "upcoming"
        ? endOfDay(new Date()).toISOString()
        : null;

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: currentUserId,
        title: parsed.title,
        project_id: projectId,
        due_date: due,
        priority: parsed.priority,
        tags: parsed.labels,
        rrule: parsed.rrule,
        status: "todo",
        position: tasks.length,
      })
      .select()
      .single();
    if (error) {
      setQuickAdd(text);
      setCreatingTask(false);
      return toast.error(error.message);
    }
    setTasks((t) => [...t, data as Task]);
    // If the current filter would hide the new task, jump to Inbox so the user sees it.
    const inserted = data as Task;
    const visibleHere =
      (filter.kind === "inbox" && !inserted.project_id) ||
      (filter.kind === "today" && inserted.due_date) ||
      (filter.kind === "upcoming" && inserted.due_date) ||
      (filter.kind === "project" && inserted.project_id === filter.id);
    if (!visibleHere) setFilter({ kind: "inbox" });
    setCreatingTask(false);
    requestAnimationFrame(() => quickAddRef.current?.focus());
    toast.success("Task created");
  }

  async function addSubtask(parent: Task, title: string) {
    if (!title.trim()) return;
    const currentUserId = await requireUserId();
    if (!currentUserId) return;
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: currentUserId,
        title: title.trim(),
        parent_task_id: parent.id,
        project_id: parent.project_id,
        priority: 4,
        status: "todo",
        position: tasks.length,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setTasks((t) => [...t, data as Task]);
    toast.success("Subtask created");
  }

  async function toggleDone(task: Task) {
    const done = task.status !== "done";
    const patch = {
      status: done ? "done" : "todo",
      completed_at: done ? new Date().toISOString() : null,
    };
    setTasks((all) => all.map((x) => (x.id === task.id ? { ...x, ...patch } : x)));
    await supabase.from("tasks").update(patch).eq("id", task.id);

    // Spawn next instance for recurring tasks
    if (done && task.rrule && task.due_date) {
      const next = nextOccurrence(task.rrule, new Date(task.due_date));
      if (next) {
        const { data, error } = await supabase
          .from("tasks")
          .insert({
            user_id: (await supabase.auth.getUser()).data.user?.id,
            title: task.title,
            description: task.description,
            project_id: task.project_id,
            priority: task.priority,
            due_date: next.toISOString(),
            rrule: task.rrule,
            status: "todo",
            position: tasks.length,
          } as any)
          .select()
          .single();
        if (!error && data) {
          setTasks((t) => [...t, data as Task]);
          toast.success(`Next: ${format(next, "MMM d")}`);
        }
      }
    }
  }

  async function deleteTask(id: string) {
    setTasks((t) => t.filter((x) => x.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  }

  async function saveTask(task: Task) {
    const { id, ...patch } = task;
    setTasks((t) => t.map((x) => (x.id === id ? task : x)));
    await supabase.from("tasks").update(patch).eq("id", id);
    setEditing(null);
  }

  async function createProject() {
    if (!newProjectName.trim()) return;
    const currentUserId = await requireUserId();
    if (!currentUserId) return;
    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: currentUserId,
        name: newProjectName.trim(),
        color: newProjectColor,
        position: projects.length,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setProjects((p) => [...p, data as Project]);
    setNewProjectName("");
    setNewProjectOpen(false);
    setFilter({ kind: "project", id: data.id });
    toast.success("Project created");
  }

  async function deleteProject(id: string) {
    if (!confirm("Delete this project and its tasks?")) return;
    await supabase.from("tasks").delete().eq("project_id", id);
    await supabase.from("projects").delete().eq("id", id);
    setProjects((p) => p.filter((x) => x.id !== id));
    setTasks((t) => t.filter((x) => x.project_id !== id));
    if (filter.kind === "project" && filter.id === id) setFilter({ kind: "today" });
  }

  async function moveTaskToColumn(taskId: string, status: string) {
    setTasks((all) =>
      all.map((x) =>
        x.id === taskId
          ? {
              ...x,
              status,
              completed_at: status === "done" ? new Date().toISOString() : null,
            }
          : x,
      ),
    );
    await supabase
      .from("tasks")
      .update({
        status,
        completed_at: status === "done" ? new Date().toISOString() : null,
      })
      .eq("id", taskId);
  }

  return (
    <div className="flex min-h-[calc(100svh-64px)] md:h-[calc(100vh-3rem)] md:min-h-0">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card/40 p-3 md:flex">
        <div className="space-y-0.5">
          <NavBtn
            active={filter.kind === "today"}
            onClick={() => setFilter({ kind: "today" })}
            icon={<CalendarDays className="h-4 w-4" />}
            label="Today"
            count={stats.today}
          />
          <NavBtn
            active={filter.kind === "upcoming"}
            onClick={() => setFilter({ kind: "upcoming" })}
            icon={<CalendarClock className="h-4 w-4" />}
            label="Upcoming"
            count={stats.week}
          />
          <NavBtn
            active={filter.kind === "inbox"}
            onClick={() => setFilter({ kind: "inbox" })}
            icon={<Inbox className="h-4 w-4" />}
            label="Inbox"
          />
        </div>

        <div className="mt-6 mb-2 flex items-center justify-between px-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Projects
          </span>
          <button
            onClick={() => setNewProjectOpen(true)}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="space-y-0.5 overflow-y-auto">
          {projects.map((p) => (
            <div key={p.id} className="group flex items-center">
              <button
                onClick={() => setFilter({ kind: "project", id: p.id })}
                className={cn(
                  "flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                  filter.kind === "project" && filter.id === p.id && "bg-accent",
                )}
              >
                <Hash className="h-4 w-4" style={{ color: p.color }} />
                <span className="truncate">{p.name}</span>
              </button>
              <button
                onClick={() => deleteProject(p.id)}
                className="opacity-0 transition group-hover:opacity-100"
              >
                <Trash2 className="mr-1 h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
          {projects.length === 0 && (
            <p className="px-2 text-xs text-muted-foreground">No projects yet.</p>
          )}
        </div>

        <div className="mt-6 mb-2 flex items-center justify-between px-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Filters
          </span>
          <button
            onClick={() => setFilterDialog({ isNew: true })}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="space-y-0.5">
          {savedFilters.map((sf) => (
            <div key={sf.id} className="group flex items-center">
              <button
                onClick={() => setFilter({ kind: "saved", id: sf.id })}
                className={cn(
                  "flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                  filter.kind === "saved" && filter.id === sf.id && "bg-accent",
                )}
              >
                <FilterIcon className="h-4 w-4" style={{ color: sf.color }} />
                <span className="truncate">{sf.name}</span>
              </button>
              <button
                onClick={() => setFilterDialog(sf)}
                className="opacity-0 transition group-hover:opacity-100"
              >
                <Pencil className="mr-1 h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
              <button
                onClick={() => deleteSavedFilter(sf.id)}
                className="opacity-0 transition group-hover:opacity-100"
              >
                <Trash2 className="mr-1 h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
          {savedFilters.length === 0 && (
            <p className="px-2 text-xs text-muted-foreground">
              Save queries like <code>today &amp; p1</code>
            </p>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 md:px-10 md:py-8">
          {/* Mobile filter pills — compact, single scrollable row */}
          <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1 md:hidden">
            {[
              { k: "today" as const, label: "Today" },
              { k: "upcoming" as const, label: "Upcoming" },
              { k: "inbox" as const, label: "Inbox" },
            ].map((f) => (
              <button
                key={f.k}
                onClick={() => setFilter({ kind: f.k })}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition",
                  filter.kind === f.k
                    ? "bg-foreground text-background"
                    : "bg-card text-muted-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setFilter({ kind: "project", id: p.id })}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition flex items-center gap-1",
                  filter.kind === "project" && filter.id === p.id
                    ? "bg-foreground text-background"
                    : "bg-card text-muted-foreground",
                )}
              >
                <Hash className="h-3 w-3" style={{ color: p.color }} />
                {p.name}
              </button>
            ))}
            <button
              onClick={() => setNewProjectOpen(true)}
              disabled={authLoading}
              className="shrink-0 rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              <Plus className="inline h-3 w-3" />
            </button>
          </div>

          {/* Header — title + subtitle on the left, actions on the right */}
          <div className="mb-8 hidden items-start justify-between gap-6 md:flex">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">{filterTitle}</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Keep tasks moving through your workflow.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 rounded-full border border-border bg-card p-1">
                <button
                  onClick={() => setView("kanban")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                    view === "kanban"
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Columns3 className="h-3.5 w-3.5" /> Board
                </button>
                <button
                  onClick={() => setView("list")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                    view === "list"
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <LayoutList className="h-3.5 w-3.5" /> List
                </button>
              </div>
              <button
                onClick={() => setShowCompleted((v) => !v)}
                title={showCompleted ? "Hide completed" : "Show completed"}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:text-foreground"
              >
                {showCompleted ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
              <PropertiesManagerButton
                properties={customProps.properties}
                onCreate={customProps.createProperty}
                onUpdate={customProps.updateProperty}
                onDelete={customProps.deleteProperty}
              />
              <button
                onClick={() => quickAddRef.current?.focus()}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:opacity-90"
                title="Add task"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Dashboard — desktop only */}
          <div className="mb-8 hidden grid-cols-2 gap-4 md:grid md:grid-cols-4">
            <StatCard
              icon={<Circle className="h-4 w-4" />}
              label="Open"
              value={stats.open}
            />
            <StatCard
              icon={<CalendarDays className="h-4 w-4 text-blue-500" />}
              label="Today"
              value={stats.today}
            />
            <StatCard
              icon={<Flag className="h-4 w-4 text-red-500" />}
              label="Overdue"
              value={stats.overdue}
              tone={stats.overdue > 0 ? "danger" : undefined}
            />
            <StatCard
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
              label="Done today"
              value={stats.completedToday}
            />
          </div>

          {/* Mobile-only header */}
          <div className="mb-4 flex items-center justify-between md:hidden">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{filterTitle}</h1>
              <Badge variant="secondary">{filtered.length}</Badge>
            </div>
            <PropertiesManagerButton
              properties={customProps.properties}
              onCreate={customProps.createProperty}
              onUpdate={customProps.updateProperty}
              onDelete={customProps.deleteProperty}
            />
          </div>

          {/* Quick add */}
          <form
            data-no-swipe
            className="mb-6"
            onSubmit={(e) => {
              e.preventDefault();
              addQuick();
            }}
          >
            <div className="flex gap-2">
              <Input
                ref={quickAddRef}
                value={quickAdd}
                onChange={(e) => setQuickAdd(e.target.value)}
                placeholder="e.g. Buy skittles tomorrow at 14:00 #shopping p1"
                className="flex-1"
              />
              <Button type="submit" disabled={authLoading || creatingTask}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {parsedPreview && parsedPreview.chips.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                {parsedPreview.chips.map((c, i) => (
                  <span
                    key={i}
                    className={cn(
                      "rounded-md px-1.5 py-0.5 font-medium",
                      c.type === "date" && "bg-blue-500/15 text-blue-600 dark:text-blue-400",
                      c.type === "recur" && "bg-purple-500/15 text-purple-600 dark:text-purple-400",
                      c.type === "priority" && "bg-red-500/15 text-red-600 dark:text-red-400",
                      c.type === "project" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                      c.type === "label" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {c.text}
                  </span>
                ))}
              </div>
            )}
          </form>

          {/* Body */}
          {view === "list" ? (
            <ListView
              tasks={filtered}
              allTasks={tasks}
              projects={projects}
              onToggle={toggleDone}
              onEdit={setEditing}
              onDelete={deleteTask}
              onAddSubtask={addSubtask}
            />
          ) : (
            <KanbanView
              tasks={filtered}
              projects={projects}
              onMove={moveTaskToColumn}
              onEdit={setEditing}
              customProperties={customProps.properties}
              valuesByTask={customProps.valuesByTask}
              allTasks={tasks}
            />
          )}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Sparkles className="mb-3 h-8 w-8 opacity-50" />
              <p className="text-sm">Nothing here. Add a task above.</p>
            </div>
          )}
        </div>
      </div>

      {/* New project dialog */}
      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] rounded-2xl sm:rounded-lg" data-no-swipe>
          <form
            className="contents"
            onSubmit={(e) => {
              e.preventDefault();
              createProject();
            }}
          >
            <DialogHeader>
              <DialogTitle>New project</DialogTitle>
            </DialogHeader>
            <Input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project name"
              autoFocus
            />
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewProjectColor(c)}
                  className={cn(
                    "h-9 w-9 rounded-full border-2 transition md:h-7 md:w-7",
                    newProjectColor === c ? "border-foreground" : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewProjectOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!newProjectName.trim()}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit task dialog */}
      <TaskEditor
        task={editing}
        projects={projects}
        allTasks={tasks}
        onClose={() => setEditing(null)}
        onSave={saveTask}
        customProperties={customProps.properties}
        valuesByTask={customProps.valuesByTask}
        onSetPropertyValue={customProps.setValue}
      />

      {/* Filter editor */}
      <FilterEditor
        state={filterDialog}
        tasks={tasks}
        projects={projects}
        onClose={() => setFilterDialog(null)}
        onSave={saveFilter}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "danger";
}) {
  return (
    <Card
      className={cn(
        "rounded-2xl border-border/70 bg-card p-5 shadow-none transition hover:border-border",
        tone === "danger" && "border-destructive/40 bg-destructive/5",
      )}
    >
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-3 text-3xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}

function NavBtn({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
        active && "bg-accent font-medium",
      )}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {count != null && count > 0 && (
        <span className="text-xs text-muted-foreground">{count}</span>
      )}
    </button>
  );
}

function ListView({
  tasks,
  allTasks,
  projects,
  onToggle,
  onEdit,
  onDelete,
  onAddSubtask,
}: {
  tasks: Task[];
  allTasks: Task[];
  projects: Project[];
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
  onAddSubtask: (parent: Task, title: string) => void;
}) {
  const childrenByParent = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of allTasks) {
      if (!t.parent_task_id) continue;
      const arr = map.get(t.parent_task_id) ?? [];
      arr.push(t);
      map.set(t.parent_task_id, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.position - b.position);
    return map;
  }, [allTasks]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [subDraft, setSubDraft] = useState("");
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Recursive progress: completed leaf descendants / total leaf descendants.
  // Falls back to direct children stats when there are no descendants.
  function progress(taskId: string): { done: number; total: number } {
    const kids = childrenByParent.get(taskId) ?? [];
    if (kids.length === 0) return { done: 0, total: 0 };
    let done = 0;
    let total = 0;
    for (const k of kids) {
      const sub = progress(k.id);
      if (sub.total === 0) {
        total += 1;
        if (k.status === "done") done += 1;
      } else {
        total += sub.total;
        done += sub.done;
      }
    }
    return { done, total };
  }

  function renderNode(t: Task, depth: number): React.ReactNode {
    const subs = childrenByParent.get(t.id) ?? [];
    const isCollapsed = collapsed.has(t.id);
    const prog = progress(t.id);
    return (
      <div key={t.id}>
        <TaskRow
          task={t}
          project={projects.find((p) => p.id === t.project_id) ?? null}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
          depth={depth}
          hasChildren={subs.length > 0}
          collapsed={isCollapsed}
          progress={prog}
          onToggleCollapse={() => toggle(t.id)}
          onAddSubtask={() => {
            setAddingFor(t.id);
            setSubDraft("");
            setCollapsed((prev) => {
              const next = new Set(prev);
              next.delete(t.id);
              return next;
            });
          }}
        />
        {!isCollapsed && subs.map((s) => renderNode(s, depth + 1))}
        {addingFor === t.id && (
          <div
            className="flex items-center gap-2 border-l-2 border-border/60 bg-muted/20 py-1.5 pr-3"
            style={{ paddingLeft: 12 + (depth + 1) * 20 }}
          >
            <Input
              autoFocus
              value={subDraft}
              onChange={(e) => setSubDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onAddSubtask(t, subDraft);
                  setSubDraft("");
                  setAddingFor(null);
                } else if (e.key === "Escape") {
                  setAddingFor(null);
                }
              }}
              onBlur={() => setAddingFor(null)}
              placeholder="Subtask title — Enter to add, Esc to cancel"
              className="h-7 text-xs"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 bg-card">
      {tasks.map((t) => renderNode(t, 0))}
    </div>
  );
}

function TaskRow({
  task,
  project,
  onToggle,
  onEdit,
  onDelete,
  depth = 0,
  hasChildren,
  collapsed,
  progress,
  onToggleCollapse,
  onAddSubtask,
}: {
  task: Task;
  project: Project | null;
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
  depth?: number;
  hasChildren?: boolean;
  collapsed?: boolean;
  progress?: { done: number; total: number };
  onToggleCollapse?: () => void;
  onAddSubtask?: () => void;
}) {
  const done = task.status === "done";
  const overdue =
    task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && !done;
  const isSubtask = depth > 0;
  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-3 py-2.5 hover:bg-accent/40",
        isSubtask && "border-l-2 border-border/60 bg-muted/20 py-1.5",
      )}
      style={isSubtask ? { paddingLeft: 12 + depth * 20 } : undefined}
    >
      <button
        onClick={hasChildren ? onToggleCollapse : undefined}
        className={cn(
          "flex h-4 w-4 items-center justify-center text-muted-foreground",
          !hasChildren && "invisible",
        )}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>
      <Checkbox checked={done} onCheckedChange={() => onToggle(task)} />
      <div className="flex-1 cursor-pointer" onClick={() => onEdit(task)}>
        <div
          className={cn(
            isSubtask ? "text-xs" : "text-sm",
            done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          {task.due_date && (
            <span className={cn(overdue && "text-red-500")}>
              {format(new Date(task.due_date), "MMM d")}
            </span>
          )}
          {project && (
            <span className="flex items-center gap-1">
              <Hash className="h-3 w-3" style={{ color: project.color }} />
              {project.name}
            </span>
          )}
          {task.priority < 4 && (
            <Flag className={cn("h-3 w-3", PRIORITY_COLORS[task.priority])} />
          )}
          {task.rrule && (
            <span className="flex items-center gap-1 text-purple-500" title={describeRecurrence(task.rrule)}>
              <Repeat className="h-3 w-3" />
            </span>
          )}
          {progress && progress.total > 0 && (
            <span
              className={cn(
                "flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-medium tabular-nums",
                progress.done === progress.total && "text-emerald-600 dark:text-emerald-400",
              )}
              title={`${progress.done} of ${progress.total} subtasks complete`}
            >
              <CheckCircle2 className="h-3 w-3" />
              {progress.done}/{progress.total}
            </span>
          )}
        </div>
      </div>
      {onAddSubtask && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddSubtask();
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground md:h-auto md:w-auto md:opacity-0 md:group-hover:opacity-100"
          title="Add subtask"
        >
          <Plus className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
        </button>
      )}
      <button
        onClick={() => onDelete(task.id)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive md:h-auto md:w-auto md:opacity-0 md:group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function KanbanView({
  tasks,
  projects,
  onMove,
  onEdit,
  customProperties,
  valuesByTask,
  allTasks,
}: {
  tasks: Task[];
  projects: Project[];
  onMove: (id: string, status: string) => void;
  onEdit: (t: Task) => void;
  customProperties: TaskProperty[];
  valuesByTask: Map<string, Map<string, unknown>>;
  allTasks: Task[];
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const cols = useMemo(() => {
    return KANBAN_COLUMNS.map((c) => ({
      ...c,
      tasks: tasks.filter((t) => t.status === c.id),
    }));
  }, [tasks]);

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const overCol = e.over?.data.current?.column as string | undefined;
    if (overCol) onMove(id, overCol);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {cols.map((c) => (
          <KanbanColumn key={c.id} id={c.id} label={c.label} count={c.tasks.length} index={KANBAN_COLUMNS.findIndex((k) => k.id === c.id)}>
            <SortableContext items={c.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {c.tasks.map((t) => (
                <KanbanCard
                  key={t.id}
                  task={t}
                  project={projects.find((p) => p.id === t.project_id) ?? null}
                  onEdit={onEdit}
                  customProperties={customProperties}
                  values={valuesByTask.get(t.id)}
                  allTasks={allTasks}
                />
              ))}
            </SortableContext>
          </KanbanColumn>
        ))}
      </div>
    </DndContext>
  );
}

function KanbanColumn({
  id,
  label,
  count,
  children,
  index,
}: {
  id: string;
  label: string;
  count: number;
  children: React.ReactNode;
  index?: number;
}) {
  const { setNodeRef, isOver } = useSortable({
    id: `col-${id}`,
    data: { column: id },
  });
  const dotColors = ["bg-slate-400", "bg-blue-500", "bg-emerald-500"];
  const dot = dotColors[(index ?? 0) % dotColors.length];
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[calc(100vh-22rem)] flex-col rounded-2xl border border-border/70 bg-card/60 p-4 transition",
        isOver && "ring-2 ring-primary/40",
      )}
    >
      <div className="mb-4 flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className={cn("h-2 w-2 rounded-full", dot)} />
          <span>{label}</span>
        </div>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">{count}</span>
      </div>
      <div className="flex-1 space-y-2.5">{children}</div>
    </div>
  );
}

function KanbanCard({
  task,
  project,
  onEdit,
  customProperties,
  values,
  allTasks,
}: {
  task: Task;
  project: Project | null;
  onEdit: (t: Task) => void;
  customProperties: TaskProperty[];
  values: Map<string, unknown> | undefined;
  allTasks: Task[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { column: task.status },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onEdit(task)}
      className="cursor-grab rounded-xl border border-border/70 bg-background p-3.5 text-sm shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:cursor-grabbing"
    >
      <div className="font-medium leading-snug">{task.title}</div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {task.due_date && <span>{format(new Date(task.due_date), "MMM d")}</span>}
        {project && (
          <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
            <Hash className="h-3 w-3" style={{ color: project.color }} />
            {project.name}
          </span>
        )}
        {task.priority < 4 && (
          <Flag className={cn("h-3 w-3", PRIORITY_COLORS[task.priority])} />
        )}
        <PropertyChips
          properties={customProperties}
          values={values}
          allTasks={allTasks}
        />
      </div>
    </div>
  );
}

function TaskEditor({
  task,
  projects,
  allTasks,
  onClose,
  onSave,
  customProperties,
  valuesByTask,
  onSetPropertyValue,
}: {
  task: Task | null;
  projects: Project[];
  allTasks: Task[];
  onClose: () => void;
  onSave: (t: Task) => void;
  customProperties: TaskProperty[];
  valuesByTask: Map<string, Map<string, unknown>>;
  onSetPropertyValue: (taskId: string, propertyId: string, value: unknown) => void;
}) {
  const [draft, setDraft] = useState<Task | null>(task);
  useEffect(() => setDraft(task), [task]);

  // Any task can be a parent except the task itself or any of its descendants
  // (otherwise we create a cycle). Computed before the early-return to keep
  // hook order stable.
  const descendantIds = useMemo(() => {
    if (!draft) return new Set<string>();
    const out = new Set<string>();
    const childrenByParent = new Map<string, Task[]>();
    for (const t of allTasks) {
      if (!t.parent_task_id) continue;
      const arr = childrenByParent.get(t.parent_task_id) ?? [];
      arr.push(t);
      childrenByParent.set(t.parent_task_id, arr);
    }
    const stack = [draft.id];
    while (stack.length) {
      const id = stack.pop()!;
      for (const c of childrenByParent.get(id) ?? []) {
        if (!out.has(c.id)) {
          out.add(c.id);
          stack.push(c.id);
        }
      }
    }
    return out;
  }, [allTasks, draft?.id]);

  if (!draft) return null;

  const parentCandidates = allTasks.filter(
    (t) => t.id !== draft.id && !descendantIds.has(t.id),
  );

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Title"
          />
          <Textarea
            value={draft.description ?? ""}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="Description"
            rows={3}
          />
          <div className="grid grid-cols-2 gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {draft.due_date ? format(new Date(draft.due_date), "MMM d, yyyy") : "Due date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={draft.due_date ? new Date(draft.due_date) : undefined}
                  onSelect={(d) =>
                    setDraft({ ...draft, due_date: d ? d.toISOString() : null })
                  }
                />
              </PopoverContent>
            </Popover>
            <Select
              value={String(draft.priority)}
              onValueChange={(v) => setDraft({ ...draft, priority: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">P1 — Urgent</SelectItem>
                <SelectItem value="2">P2 — High</SelectItem>
                <SelectItem value="3">P3 — Medium</SelectItem>
                <SelectItem value="4">P4 — Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={draft.project_id ?? "none"}
              onValueChange={(v) =>
                setDraft({ ...draft, project_id: v === "none" ? null : v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Inbox</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={draft.status}
              onValueChange={(v) => setDraft({ ...draft, status: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {KANBAN_COLUMNS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Select
            value={draft.parent_task_id ?? "none"}
            onValueChange={(v) =>
              setDraft({ ...draft, parent_task_id: v === "none" ? null : v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Parent task" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No parent (top-level)</SelectItem>
              {parentCandidates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <RecurrenceField
            value={draft.rrule ?? null}
            onChange={(v) => setDraft({ ...draft, rrule: v })}
          />
          <TaskPropertiesSection
            taskId={draft.id}
            properties={customProperties}
            valuesByTask={valuesByTask}
            onSetValue={onSetPropertyValue}
            allTasks={allTasks.map((t) => ({ id: t.id, title: t.title }))}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(draft)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Recurrence helpers ───────────────────────────────────────────────────

const RECURRENCE_PRESETS: { label: string; value: string }[] = [
  { label: "Does not repeat", value: "" },
  { label: "Daily", value: "FREQ=DAILY" },
  { label: "Every weekday", value: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
  { label: "Weekly", value: "FREQ=WEEKLY" },
  { label: "Every 2 weeks", value: "FREQ=WEEKLY;INTERVAL=2" },
  { label: "Monthly", value: "FREQ=MONTHLY" },
  { label: "Yearly", value: "FREQ=YEARLY" },
];

export function describeRecurrence(rrule: string | null): string {
  if (!rrule) return "Does not repeat";
  const preset = RECURRENCE_PRESETS.find((p) => p.value === rrule);
  if (preset) return preset.label;
  try {
    return RRule.fromString(rrule.startsWith("RRULE:") ? rrule : `RRULE:${rrule}`).toText();
  } catch {
    return "Custom";
  }
}

function RecurrenceField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const isPreset = !value || RECURRENCE_PRESETS.some((p) => p.value === value);
  const [mode, setMode] = useState<"preset" | "manual">(isPreset ? "preset" : "manual");
  const [manual, setManual] = useState(value ?? "");

  useEffect(() => {
    if (value && !RECURRENCE_PRESETS.some((p) => p.value === value)) {
      setMode("manual");
      setManual(value);
    }
  }, [value]);

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Repeat className="h-4 w-4 text-muted-foreground" />
          Recurrence
        </div>
        <div className="flex gap-1 rounded-md border border-border p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("preset")}
            className={cn(
              "rounded px-2 py-0.5",
              mode === "preset" ? "bg-accent" : "text-muted-foreground",
            )}
          >
            Presets
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={cn(
              "rounded px-2 py-0.5",
              mode === "manual" ? "bg-accent" : "text-muted-foreground",
            )}
          >
            Manual
          </button>
        </div>
      </div>

      {mode === "preset" ? (
        <Select
          value={value || "__none__"}
          onValueChange={(v) => onChange(v === "__none__" ? null : v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RECURRENCE_PRESETS.map((p) => (
              <SelectItem key={p.label} value={p.value || "__none__"}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="space-y-1.5">
          <Input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onBlur={() => onChange(manual.trim() ? manual.trim() : null)}
            placeholder="FREQ=WEEKLY;BYDAY=MO,WE,FR"
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            RFC 5545 RRULE. Examples: <code>FREQ=DAILY;INTERVAL=3</code>,{" "}
            <code>FREQ=MONTHLY;BYMONTHDAY=1</code>,{" "}
            <code>FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR</code>
          </p>
          {value && (
            <p className="text-xs text-purple-500">
              → {describeRecurrence(value)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Filter editor dialog ────────────────────────────────────────────────

const FILTER_COLORS = [
  "#8b5cf6", "#ef4444", "#f59e0b", "#10b981",
  "#3b82f6", "#ec4899", "#14b8a6", "#6366f1",
];

const FILTER_EXAMPLES: { label: string; query: string }[] = [
  { label: "Today + P1", query: "today & p1" },
  { label: "Overdue", query: "overdue" },
  { label: "No date", query: "no-date & open" },
  { label: "This week (P1 or P2)", query: "7d & (p1 | p2)" },
  { label: "@home & open", query: "@home & open" },
];

function FilterEditor({
  state,
  tasks,
  projects,
  onClose,
  onSave,
}: {
  state: SavedFilter | { isNew: true } | null;
  tasks: Task[];
  projects: Project[];
  onClose: () => void;
  onSave: (p: { id?: string; name: string; query: string; color: string }) => void;
}) {
  const isEditing = state && "id" in state;
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [color, setColor] = useState(FILTER_COLORS[0]);

  useEffect(() => {
    if (!state) return;
    if ("id" in state) {
      setName(state.name);
      setQuery(state.query);
      setColor(state.color);
    } else {
      setName("");
      setQuery("");
      setColor(FILTER_COLORS[0]);
    }
  }, [state]);

  const validation = useMemo(() => validateQuery(query), [query]);
  const chips = useMemo(() => describeQuery(query), [query]);
  const preview = useMemo(() => {
    if (!validation.ok) return [];
    const pred = compileFilter(query);
    return tasks
      .filter((t) => !t.parent_task_id)
      .filter((t) => pred(t as any, projects))
      .slice(0, 5);
  }, [query, tasks, projects, validation]);
  const matchCount = useMemo(() => {
    if (!validation.ok) return 0;
    const pred = compileFilter(query);
    return tasks.filter((t) => !t.parent_task_id).filter((t) => pred(t as any, projects)).length;
  }, [query, tasks, projects, validation]);

  if (!state) return null;

  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" data-no-swipe>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit filter" : "New filter"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Filter name"
            autoFocus
          />
          <div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. today & p1"
              className="font-mono text-sm"
            />
            {chips.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {chips.map((c, i) => (
                  <span
                    key={i}
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-xs font-medium",
                      c.type === "priority" && "bg-red-500/15 text-red-600 dark:text-red-400",
                      c.type === "project" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                      c.type === "label" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                      c.type === "keyword" && "bg-blue-500/15 text-blue-600 dark:text-blue-400",
                      c.type === "op" && "bg-muted text-muted-foreground",
                      c.type === "text" && "bg-muted",
                    )}
                  >
                    {c.text}
                  </span>
                ))}
              </div>
            )}
            {!validation.ok && (
              <p className="mt-1 text-xs text-red-500">{validation.error}</p>
            )}
          </div>

          <div>
            <p className="mb-1 text-xs text-muted-foreground">Examples</p>
            <div className="flex flex-wrap gap-1.5">
              {FILTER_EXAMPLES.map((ex) => (
                <button
                  key={ex.query}
                  type="button"
                  onClick={() => { setQuery(ex.query); if (!name) setName(ex.label); }}
                  className="rounded-md border border-border px-2 py-0.5 text-xs hover:bg-accent"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Color</span>
            {FILTER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  "h-6 w-6 rounded-full border-2",
                  color === c ? "border-foreground" : "border-transparent",
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-2">
            <p className="mb-1 text-xs text-muted-foreground">
              {validation.ok ? `${matchCount} match${matchCount === 1 ? "" : "es"}` : "—"}
            </p>
            <ul className="space-y-0.5 text-sm">
              {preview.map((t) => (
                <li key={t.id} className="truncate">
                  • {t.title}
                </li>
              ))}
              {validation.ok && preview.length === 0 && (
                <li className="text-xs text-muted-foreground">No tasks match.</li>
              )}
            </ul>
          </div>

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Query syntax</summary>
            <div className="mt-1 space-y-0.5">
              <div><code>today</code>, <code>overdue</code>, <code>upcoming</code>, <code>no-date</code>, <code>inbox</code>, <code>done</code>, <code>open</code></div>
              <div><code>p1</code>..<code>p4</code> priority · <code>#project</code> · <code>@label</code></div>
              <div><code>7d</code> = next 7 days · combine with <code>&amp;</code>, <code>|</code>, <code>!</code>, parens</div>
            </div>
          </details>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onSave({
              id: isEditing ? (state as SavedFilter).id : undefined,
              name: name.trim() || "Untitled filter",
              query,
              color,
            })}
            disabled={!name.trim() || !validation.ok}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
