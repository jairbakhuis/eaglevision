import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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

export const Route = createFileRoute("/_app/tasks")({
  component: TasksPage,
  head: () => ({ meta: [{ title: "Tasks — EagleVision" }] }),
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
};

type Filter =
  | { kind: "inbox" }
  | { kind: "today" }
  | { kind: "upcoming" }
  | { kind: "project"; id: string };

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
  const [filter, setFilter] = useState<Filter>({ kind: "today" });
  const [view, setView] = useState<"list" | "kanban">("list");
  const [quickAdd, setQuickAdd] = useState("");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[3]);
  const [editing, setEditing] = useState<Task | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    loadAll();
  }, []);

  async function loadAll() {
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from("projects").select("*").order("position"),
      supabase.from("tasks").select("*").order("position"),
    ]);
    setProjects(p ?? []);
    setTasks(t ?? []);
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
    return list;
  }, [tasks, filter]);

  const filterTitle =
    filter.kind === "inbox"
      ? "Inbox"
      : filter.kind === "today"
        ? "Today"
        : filter.kind === "upcoming"
          ? "Upcoming"
          : projects.find((p) => p.id === filter.id)?.name ?? "Project";

  async function addQuick() {
    if (!quickAdd.trim() || !userId) return;
    const text = quickAdd.trim();
    setQuickAdd("");
    const projectId = filter.kind === "project" ? filter.id : null;
    const due =
      filter.kind === "today"
        ? endOfDay(new Date()).toISOString()
        : null;
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        title: text,
        project_id: projectId,
        due_date: due,
        priority: 4,
        status: "todo",
        position: tasks.length,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setTasks((t) => [...t, data as Task]);
  }

  async function toggleDone(task: Task) {
    const done = task.status !== "done";
    const patch = {
      status: done ? "done" : "todo",
      completed_at: done ? new Date().toISOString() : null,
    };
    setTasks((all) => all.map((x) => (x.id === task.id ? { ...x, ...patch } : x)));
    await supabase.from("tasks").update(patch).eq("id", task.id);
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
    if (!newProjectName.trim() || !userId) return;
    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: userId,
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
    <div className="flex h-[calc(100vh-3rem)]">
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
      </aside>

      {/* Main */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl p-6">
          {/* Dashboard */}
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
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

          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{filterTitle}</h1>
              <Badge variant="secondary">{filtered.length}</Badge>
            </div>
            <div className="flex gap-1 rounded-md border border-border bg-card p-0.5">
              <button
                onClick={() => setView("list")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition",
                  view === "list" ? "bg-accent text-foreground" : "text-muted-foreground",
                )}
              >
                <LayoutList className="h-3.5 w-3.5" /> List
              </button>
              <button
                onClick={() => setView("kanban")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition",
                  view === "kanban" ? "bg-accent text-foreground" : "text-muted-foreground",
                )}
              >
                <Columns3 className="h-3.5 w-3.5" /> Kanban
              </button>
            </div>
          </div>

          {/* Quick add */}
          <div className="mb-4 flex gap-2">
            <Input
              value={quickAdd}
              onChange={(e) => setQuickAdd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addQuick()}
              placeholder="Add a task and press Enter…"
              className="flex-1"
            />
            <Button onClick={addQuick}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Body */}
          {view === "list" ? (
            <ListView
              tasks={filtered}
              allTasks={tasks}
              projects={projects}
              onToggle={toggleDone}
              onEdit={setEditing}
              onDelete={deleteTask}
            />
          ) : (
            <KanbanView
              tasks={filtered}
              projects={projects}
              onMove={moveTaskToColumn}
              onEdit={setEditing}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          </DialogHeader>
          <Input
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Project name"
            onKeyDown={(e) => e.key === "Enter" && createProject()}
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewProjectColor(c)}
                className={cn(
                  "h-7 w-7 rounded-full border-2 transition",
                  newProjectColor === c ? "border-foreground" : "border-transparent",
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewProjectOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createProject}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit task dialog */}
      <TaskEditor
        task={editing}
        projects={projects}
        onClose={() => setEditing(null)}
        onSave={saveTask}
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
        "p-4",
        tone === "danger" && "border-destructive/40 bg-destructive/5",
      )}
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
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
}: {
  tasks: Task[];
  allTasks: Task[];
  projects: Project[];
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
}) {
  const childrenByParent = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of allTasks) {
      if (!t.parent_task_id) continue;
      const arr = map.get(t.parent_task_id) ?? [];
      arr.push(t);
      map.set(t.parent_task_id, arr);
    }
    return map;
  }, [allTasks]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-card">
      {tasks.map((t) => {
        const subs = childrenByParent.get(t.id) ?? [];
        const isCollapsed = collapsed.has(t.id);
        return (
          <div key={t.id}>
            <TaskRow
              task={t}
              project={projects.find((p) => p.id === t.project_id) ?? null}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              hasChildren={subs.length > 0}
              collapsed={isCollapsed}
              onToggleCollapse={() => toggle(t.id)}
            />
            {!isCollapsed &&
              subs.map((s) => (
                <TaskRow
                  key={s.id}
                  task={s}
                  project={projects.find((p) => p.id === s.project_id) ?? null}
                  onToggle={onToggle}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  isSubtask
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}

function TaskRow({
  task,
  project,
  onToggle,
  onEdit,
  onDelete,
  isSubtask,
  hasChildren,
  collapsed,
  onToggleCollapse,
}: {
  task: Task;
  project: Project | null;
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
  isSubtask?: boolean;
  hasChildren?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const done = task.status === "done";
  const overdue =
    task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && !done;
  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-3 py-2.5 hover:bg-accent/40",
        isSubtask && "border-l-2 border-border/60 bg-muted/20 py-1.5 pl-[36px]",
      )}
    >
      {!isSubtask && (
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
      )}
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
        </div>
      </div>
      <button
        onClick={() => onDelete(task.id)}
        className="opacity-0 transition group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
      </button>
    </div>
  );
}

function KanbanView({
  tasks,
  projects,
  onMove,
  onEdit,
}: {
  tasks: Task[];
  projects: Project[];
  onMove: (id: string, status: string) => void;
  onEdit: (t: Task) => void;
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
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {cols.map((c) => (
          <KanbanColumn key={c.id} id={c.id} label={c.label} count={c.tasks.length}>
            <SortableContext items={c.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {c.tasks.map((t) => (
                <KanbanCard
                  key={t.id}
                  task={t}
                  project={projects.find((p) => p.id === t.project_id) ?? null}
                  onEdit={onEdit}
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
}: {
  id: string;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useSortable({
    id: `col-${id}`,
    data: { column: id },
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[300px] flex-col rounded-lg border border-border bg-card/50 p-2",
        isOver && "ring-2 ring-primary/40",
      )}
    >
      <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        <span>{count}</span>
      </div>
      <div className="flex-1 space-y-2">{children}</div>
    </div>
  );
}

function KanbanCard({
  task,
  project,
  onEdit,
}: {
  task: Task;
  project: Project | null;
  onEdit: (t: Task) => void;
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
      className="cursor-grab rounded-md border border-border bg-background p-2.5 text-sm shadow-sm hover:border-primary/40 active:cursor-grabbing"
    >
      <div className="font-medium leading-snug">{task.title}</div>
      <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
        {task.due_date && <span>{format(new Date(task.due_date), "MMM d")}</span>}
        {project && (
          <span className="flex items-center gap-1">
            <Hash className="h-3 w-3" style={{ color: project.color }} />
            {project.name}
          </span>
        )}
        {task.priority < 4 && (
          <Flag className={cn("h-3 w-3", PRIORITY_COLORS[task.priority])} />
        )}
      </div>
    </div>
  );
}

function TaskEditor({
  task,
  projects,
  onClose,
  onSave,
}: {
  task: Task | null;
  projects: Project[];
  onClose: () => void;
  onSave: (t: Task) => void;
}) {
  const [draft, setDraft] = useState<Task | null>(task);
  useEffect(() => setDraft(task), [task]);

  if (!draft) return null;

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
