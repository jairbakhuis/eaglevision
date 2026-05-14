import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  CalendarDays,
  Check,
  ChevronDown,
  GripVertical,
  Plus,
  Settings2,
  Sigma,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export type PropertyType =
  | "text"
  | "number"
  | "select"
  | "multi_select"
  | "date"
  | "checkbox"
  | "url"
  | "formula"
  | "relation";

export type SelectOption = { id: string; label: string; color: string };

export type PropertyConfig = {
  options?: SelectOption[]; // select / multi_select
  expression?: string;       // formula
  target?: "task";           // relation
};

export type TaskProperty = {
  id: string;
  user_id: string;
  name: string;
  type: PropertyType;
  config: PropertyConfig;
  position: number;
  show_on_card: boolean;
};

export type PropertyValue = {
  id: string;
  task_id: string;
  property_id: string;
  value: unknown;
};

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  text: "Text",
  number: "Number",
  select: "Select",
  multi_select: "Multi-select",
  date: "Date",
  checkbox: "Checkbox",
  url: "URL",
  formula: "Formula",
  relation: "Relation",
};

const SELECT_COLORS = [
  "#94a3b8", "#ef4444", "#f59e0b", "#eab308",
  "#10b981", "#14b8a6", "#3b82f6", "#8b5cf6",
  "#ec4899", "#f472b6",
];

// ──────────────────────────────────────────────────────────────
// Hook: load + mutate properties / values
// ──────────────────────────────────────────────────────────────

export function useCustomProperties(userId: string | null) {
  const [properties, setProperties] = useState<TaskProperty[]>([]);
  const [values, setValues] = useState<PropertyValue[]>([]);

  const reload = useCallback(async () => {
    if (!userId) {
      setProperties([]);
      setValues([]);
      return;
    }
    const [{ data: p, error: pe }, { data: v, error: ve }] = await Promise.all([
      supabase.from("task_properties").select("*").order("position"),
      supabase.from("task_property_values").select("*"),
    ]);
    if (pe) toast.error(pe.message);
    if (ve) toast.error(ve.message);
    setProperties((p ?? []) as TaskProperty[]);
    setValues((v ?? []) as PropertyValue[]);
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const valuesByTask = useMemo(() => {
    const m = new Map<string, Map<string, unknown>>();
    for (const v of values) {
      let inner = m.get(v.task_id);
      if (!inner) {
        inner = new Map();
        m.set(v.task_id, inner);
      }
      inner.set(v.property_id, v.value);
    }
    return m;
  }, [values]);

  async function createProperty(input: {
    name: string;
    type: PropertyType;
    config?: PropertyConfig;
    show_on_card?: boolean;
  }) {
    if (!userId) return;
    const position = properties.length;
    const { data, error } = await supabase
      .from("task_properties")
      .insert({
        user_id: userId,
        name: input.name.trim() || PROPERTY_TYPE_LABELS[input.type],
        type: input.type,
        config: input.config ?? {},
        position,
        show_on_card: input.show_on_card ?? false,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setProperties((prev) => [...prev, data as TaskProperty]);
  }

  async function updateProperty(id: string, patch: Partial<TaskProperty>) {
    setProperties((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
    const { error } = await supabase
      .from("task_properties")
      .update(patch)
      .eq("id", id);
    if (error) toast.error(error.message);
  }

  async function deleteProperty(id: string) {
    setProperties((prev) => prev.filter((p) => p.id !== id));
    setValues((prev) => prev.filter((v) => v.property_id !== id));
    const { error } = await supabase
      .from("task_properties")
      .delete()
      .eq("id", id);
    if (error) toast.error(error.message);
  }

  async function setValue(taskId: string, propertyId: string, value: unknown) {
    if (!userId) return;
    // optimistic
    setValues((prev) => {
      const idx = prev.findIndex(
        (v) => v.task_id === taskId && v.property_id === propertyId,
      );
      if (idx === -1) {
        return [
          ...prev,
          { id: `tmp-${taskId}-${propertyId}`, task_id: taskId, property_id: propertyId, value },
        ];
      }
      const next = prev.slice();
      next[idx] = { ...next[idx], value };
      return next;
    });
    const { data, error } = await supabase
      .from("task_property_values")
      .upsert(
        {
          user_id: userId,
          task_id: taskId,
          property_id: propertyId,
          value: value as never,
        },
        { onConflict: "task_id,property_id" },
      )
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setValues((prev) => {
      const idx = prev.findIndex(
        (v) => v.task_id === taskId && v.property_id === propertyId,
      );
      if (idx === -1) return [...prev, data as PropertyValue];
      const next = prev.slice();
      next[idx] = data as PropertyValue;
      return next;
    });
  }

  return {
    properties,
    values,
    valuesByTask,
    reload,
    createProperty,
    updateProperty,
    deleteProperty,
    setValue,
  };
}

// ──────────────────────────────────────────────────────────────
// Tiny safe formula evaluator
// Supports: + - * / % ( ) numbers, and {Property Name} references
// ──────────────────────────────────────────────────────────────

export function evalFormula(
  expression: string,
  context: Record<string, unknown>,
): string | number | null {
  if (!expression.trim()) return null;
  try {
    // Substitute {Name} → numeric value (or 0)
    const substituted = expression.replace(/\{([^}]+)\}/g, (_, key) => {
      const v = context[key.trim()];
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? String(n) : "0";
    });
    // Strict allow-list: digits, operators, parens, dot, whitespace
    if (!/^[\d+\-*/%().\s]+$/.test(substituted)) return "—";
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${substituted});`)();
    if (typeof result === "number" && Number.isFinite(result)) return result;
    return "—";
  } catch {
    return "—";
  }
}

// ──────────────────────────────────────────────────────────────
// Property value editor (used in task detail panel)
// ──────────────────────────────────────────────────────────────

export function PropertyValueInput({
  property,
  value,
  onChange,
  allTasks,
  contextValues,
}: {
  property: TaskProperty;
  value: unknown;
  onChange: (v: unknown) => void;
  allTasks?: { id: string; title: string }[];
  contextValues?: Record<string, unknown>;
}) {
  switch (property.type) {
    case "text":
      return (
        <Input
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Empty"
        />
      );
    case "number":
      return (
        <Input
          type="number"
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
          placeholder="Empty"
        />
      );
    case "url":
      return (
        <Input
          type="url"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://"
        />
      );
    case "checkbox":
      return (
        <Checkbox
          checked={Boolean(value)}
          onCheckedChange={(c) => onChange(Boolean(c))}
        />
      );
    case "date":
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start font-normal">
              <CalendarDays className="mr-2 h-4 w-4" />
              {value ? format(new Date(value as string), "MMM d, yyyy") : "Empty"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value ? new Date(value as string) : undefined}
              onSelect={(d) => onChange(d ? d.toISOString() : null)}
              className="pointer-events-auto p-3"
            />
          </PopoverContent>
        </Popover>
      );
    case "select": {
      const options = property.config.options ?? [];
      const current = options.find((o) => o.id === value);
      return (
        <Select
          value={(value as string) ?? "__none__"}
          onValueChange={(v) => onChange(v === "__none__" ? null : v)}
        >
          <SelectTrigger>
            <SelectValue>
              {current ? (
                <span
                  className="rounded px-1.5 py-0.5 text-xs"
                  style={{ background: `${current.color}22`, color: current.color }}
                >
                  {current.label}
                </span>
              ) : (
                <span className="text-muted-foreground">Empty</span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Empty</SelectItem>
            {options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                <span
                  className="rounded px-1.5 py-0.5 text-xs"
                  style={{ background: `${o.color}22`, color: o.color }}
                >
                  {o.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    case "multi_select": {
      const options = property.config.options ?? [];
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-2 py-1 text-left text-sm"
            >
              {selected.length === 0 && (
                <span className="text-muted-foreground">Empty</span>
              )}
              {selected.map((id) => {
                const o = options.find((x) => x.id === id);
                if (!o) return null;
                return (
                  <span
                    key={id}
                    className="rounded px-1.5 py-0.5 text-xs"
                    style={{ background: `${o.color}22`, color: o.color }}
                  >
                    {o.label}
                  </span>
                );
              })}
              <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1" align="start">
            {options.length === 0 && (
              <div className="p-2 text-xs text-muted-foreground">
                No options yet. Add some in Properties.
              </div>
            )}
            {options.map((o) => {
              const checked = selected.includes(o.id);
              return (
                <button
                  type="button"
                  key={o.id}
                  onClick={() =>
                    onChange(
                      checked
                        ? selected.filter((x) => x !== o.id)
                        : [...selected, o.id],
                    )
                  }
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <span
                    className="rounded px-1.5 py-0.5 text-xs"
                    style={{ background: `${o.color}22`, color: o.color }}
                  >
                    {o.label}
                  </span>
                  {checked && <Check className="ml-auto h-3.5 w-3.5" />}
                </button>
              );
            })}
          </PopoverContent>
        </Popover>
      );
    }
    case "relation": {
      const items = allTasks ?? [];
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-2 py-1 text-left text-sm"
            >
              {selected.length === 0 && (
                <span className="text-muted-foreground">Empty</span>
              )}
              {selected.map((id) => {
                const t = items.find((x) => x.id === id);
                if (!t) return null;
                return (
                  <span
                    key={id}
                    className="rounded bg-muted px-1.5 py-0.5 text-xs"
                  >
                    {t.title}
                  </span>
                );
              })}
              <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-1" align="start">
            <div className="max-h-64 overflow-y-auto">
              {items.map((t) => {
                const checked = selected.includes(t.id);
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() =>
                      onChange(
                        checked
                          ? selected.filter((x) => x !== t.id)
                          : [...selected, t.id],
                      )
                    }
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <span className="truncate">{t.title}</span>
                    {checked && <Check className="ml-auto h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      );
    }
    case "formula": {
      const result = evalFormula(property.config.expression ?? "", contextValues ?? {});
      return (
        <div className="flex h-9 items-center gap-2 rounded-md border border-dashed border-input bg-muted/30 px-3 text-sm">
          <Sigma className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{result === null ? <span className="text-muted-foreground">—</span> : String(result)}</span>
        </div>
      );
    }
    default:
      return null;
  }
}

// ──────────────────────────────────────────────────────────────
// Properties section for the task editor
// ──────────────────────────────────────────────────────────────

export function TaskPropertiesSection({
  taskId,
  properties,
  valuesByTask,
  onSetValue,
  allTasks,
}: {
  taskId: string;
  properties: TaskProperty[];
  valuesByTask: Map<string, Map<string, unknown>>;
  onSetValue: (taskId: string, propertyId: string, value: unknown) => void;
  allTasks: { id: string; title: string }[];
}) {
  if (properties.length === 0) return null;
  const current = valuesByTask.get(taskId) ?? new Map<string, unknown>();

  // For formula references, build name → numeric value
  const contextValues: Record<string, unknown> = {};
  for (const p of properties) {
    contextValues[p.name] = current.get(p.id) ?? null;
  }

  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Properties
      </div>
      <div className="grid grid-cols-[120px_1fr] items-center gap-x-3 gap-y-2">
        {properties.map((p) => (
          <div key={p.id} className="contents">
            <div className="truncate text-xs text-muted-foreground" title={p.name}>
              {p.name}
            </div>
            <PropertyValueInput
              property={p}
              value={current.get(p.id) ?? null}
              onChange={(v) => onSetValue(taskId, p.id, v)}
              allTasks={allTasks}
              contextValues={contextValues}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Compact chips for kanban / list cards
// ──────────────────────────────────────────────────────────────

export function PropertyChips({
  properties,
  values,
  allTasks,
}: {
  properties: TaskProperty[];
  values: Map<string, unknown> | undefined;
  allTasks: { id: string; title: string }[];
}) {
  if (!values || properties.length === 0) return null;
  const visible = properties.filter((p) => p.show_on_card);
  if (visible.length === 0) return null;

  const contextValues: Record<string, unknown> = {};
  for (const p of properties) {
    contextValues[p.name] = values.get(p.id) ?? null;
  }

  return (
    <>
      {visible.map((p) => {
        const v = values.get(p.id);
        const empty = v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
        if (empty && p.type !== "formula" && p.type !== "checkbox") return null;
        const chipBase = "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]";
        switch (p.type) {
          case "select": {
            const opt = p.config.options?.find((o) => o.id === v);
            if (!opt) return null;
            return (
              <span
                key={p.id}
                className={chipBase}
                style={{ background: `${opt.color}22`, color: opt.color }}
              >
                {opt.label}
              </span>
            );
          }
          case "multi_select": {
            const ids = Array.isArray(v) ? (v as string[]) : [];
            return ids.slice(0, 3).map((id) => {
              const opt = p.config.options?.find((o) => o.id === id);
              if (!opt) return null;
              return (
                <span
                  key={`${p.id}-${id}`}
                  className={chipBase}
                  style={{ background: `${opt.color}22`, color: opt.color }}
                >
                  {opt.label}
                </span>
              );
            });
          }
          case "date":
            return (
              <span key={p.id} className={chipBase}>
                <CalendarDays className="h-3 w-3" />
                {format(new Date(v as string), "MMM d")}
              </span>
            );
          case "checkbox":
            return (
              <span key={p.id} className={chipBase}>
                {v ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 opacity-50" />}
                {p.name}
              </span>
            );
          case "url":
            return (
              <span key={p.id} className={cn(chipBase, "max-w-[140px] truncate underline-offset-2")}>
                {String(v)}
              </span>
            );
          case "number":
          case "text":
            return (
              <span key={p.id} className={chipBase}>
                {String(v)}
              </span>
            );
          case "relation": {
            const ids = Array.isArray(v) ? (v as string[]) : [];
            const titles = ids
              .map((id) => allTasks.find((t) => t.id === id)?.title)
              .filter(Boolean);
            if (titles.length === 0) return null;
            return (
              <span key={p.id} className={chipBase}>
                {titles.length === 1 ? titles[0] : `${titles[0]} +${titles.length - 1}`}
              </span>
            );
          }
          case "formula": {
            const r = evalFormula(p.config.expression ?? "", contextValues);
            if (r === null) return null;
            return (
              <span key={p.id} className={chipBase}>
                <Sigma className="h-3 w-3" />
                {String(r)}
              </span>
            );
          }
          default:
            return null;
        }
      })}
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// Properties Manager Sheet
// ──────────────────────────────────────────────────────────────

export function PropertiesManagerButton({
  properties,
  onCreate,
  onUpdate,
  onDelete,
}: {
  properties: TaskProperty[];
  onCreate: (p: { name: string; type: PropertyType; config?: PropertyConfig }) => void;
  onUpdate: (id: string, patch: Partial<TaskProperty>) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Manage properties"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:text-foreground"
      >
        <Settings2 className="h-4 w-4" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Properties</SheetTitle>
            <SheetDescription>
              Define custom fields for every task. Like Notion databases.
            </SheetDescription>
          </SheetHeader>
          <PropertiesEditorList
            properties={properties}
            onCreate={onCreate}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

function PropertiesEditorList({
  properties,
  onCreate,
  onUpdate,
  onDelete,
}: {
  properties: TaskProperty[];
  onCreate: (p: { name: string; type: PropertyType; config?: PropertyConfig }) => void;
  onUpdate: (id: string, patch: Partial<TaskProperty>) => void;
  onDelete: (id: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<PropertyType>("text");

  function addProp() {
    if (!newName.trim()) {
      toast.error("Name is required");
      return;
    }
    const config: PropertyConfig = {};
    if (newType === "select" || newType === "multi_select") config.options = [];
    if (newType === "formula") config.expression = "";
    if (newType === "relation") config.target = "task";
    onCreate({ name: newName, type: newType, config });
    setNewName("");
    setNewType("text");
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
        <div className="text-xs font-medium text-muted-foreground">
          Add property
        </div>
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Status, Priority, Owner..."
            onKeyDown={(e) => e.key === "Enter" && addProp()}
          />
          <Select value={newType} onValueChange={(v) => setNewType(v as PropertyType)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PROPERTY_TYPE_LABELS) as PropertyType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {PROPERTY_TYPE_LABELS[t]}
                  {(t === "formula" || t === "relation") && (
                    <span className="ml-1 text-[10px] text-muted-foreground">Beta</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="icon" onClick={addProp}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {properties.length === 0 && (
          <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            No properties yet. Add your first one above.
          </div>
        )}
        {properties.map((p) => (
          <PropertyRow
            key={p.id}
            property={p}
            onUpdate={(patch) => onUpdate(p.id, patch)}
            onDelete={() => onDelete(p.id)}
          />
        ))}
      </div>
    </div>
  );
}

function PropertyRow({
  property,
  onUpdate,
  onDelete,
}: {
  property: TaskProperty;
  onUpdate: (patch: Partial<TaskProperty>) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const needsConfig =
    property.type === "select" ||
    property.type === "multi_select" ||
    property.type === "formula";

  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground/40" />
        <Input
          value={property.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="h-8 flex-1"
        />
        <span className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {PROPERTY_TYPE_LABELS[property.type]}
        </span>
        {needsConfig && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setExpanded((v) => !v)}
          >
            <ChevronDown
              className={cn("h-4 w-4 transition", expanded && "rotate-180")}
            />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-2 flex items-center gap-2 pl-6 text-xs text-muted-foreground">
        <Switch
          checked={property.show_on_card}
          onCheckedChange={(c) => onUpdate({ show_on_card: c })}
        />
        <span>Show on cards</span>
      </div>

      {expanded && needsConfig && (
        <div className="mt-3 border-t border-border/60 pt-3">
          {(property.type === "select" || property.type === "multi_select") && (
            <SelectOptionsEditor
              options={property.config.options ?? []}
              onChange={(options) =>
                onUpdate({ config: { ...property.config, options } })
              }
            />
          )}
          {property.type === "formula" && (
            <div className="space-y-2">
              <Input
                value={property.config.expression ?? ""}
                onChange={(e) =>
                  onUpdate({
                    config: { ...property.config, expression: e.target.value },
                  })
                }
                placeholder="e.g. {Hours} * {Rate}"
              />
              <p className="text-[11px] text-muted-foreground">
                Use <code>{"{Property Name}"}</code> to reference numeric properties. Operators: + − × ÷ %
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SelectOptionsEditor({
  options,
  onChange,
}: {
  options: SelectOption[];
  onChange: (next: SelectOption[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function addOption() {
    const label = draft.trim();
    if (!label) return;
    const color = SELECT_COLORS[options.length % SELECT_COLORS.length];
    onChange([
      ...options,
      { id: crypto.randomUUID(), label, color },
    ]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOption())}
          placeholder="Add option…"
          className="h-8"
        />
        <Button size="icon" variant="outline" className="h-8 w-8" onClick={addOption}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-1">
        {options.map((o, i) => (
          <div key={o.id} className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="h-5 w-5 rounded-full border border-border"
                  style={{ background: o.color }}
                />
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="flex flex-wrap gap-1">
                  {SELECT_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        const next = options.slice();
                        next[i] = { ...o, color: c };
                        onChange(next);
                      }}
                      className="h-5 w-5 rounded-full border border-border"
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Input
              value={o.label}
              onChange={(e) => {
                const next = options.slice();
                next[i] = { ...o, label: e.target.value };
                onChange(next);
              }}
              className="h-8 flex-1"
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onChange(options.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}