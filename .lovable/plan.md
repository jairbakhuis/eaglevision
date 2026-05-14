# Notion-style custom properties for tasks

Add a workspace-wide property system. Users define properties once (Text, Number, Select, Multi-select, Date, Checkbox, URL, Formula, Relation), then every task can fill them in. Values appear inline on Kanban cards and are fully editable in the task detail panel.

## Scope (v1)

- **Global** properties — one shared schema across all tasks/projects
- **Types shipped now:** Text, Number, Select, Multi-select, Date, Checkbox, URL
- **Types shipped as v1.1 stubs:** Formula (read-only computed expression), Relation (link to another task). These will appear in the type picker but with a "Beta" tag — basic implementations, more polish later.
- **Display:** task detail panel (full edit) + chip preview on Kanban cards (configurable per property: "show on card" toggle)

## Database

New tables:

```text
task_properties              -- the schema definitions
  id, user_id, name, type, position
  config jsonb               -- type-specific: select options, formula expr, relation target
  show_on_card boolean
  created_at, updated_at

task_property_values         -- per-task values
  id, user_id, task_id, property_id
  value jsonb                -- shape depends on type
  created_at, updated_at
  unique(task_id, property_id)
```

Both with RLS scoped to `auth.uid() = user_id`.

`config` examples:
- select / multi_select: `{ options: [{ id, label, color }] }`
- formula: `{ expression: "priority * 2" }` (safe sandboxed eval)
- relation: `{ target: "task" }` (only tasks for now)

## UI

1. **"Properties" manager** — new button in the tasks header opens a sheet listing all properties. Add / rename / reorder / delete / toggle "show on card". For Select types, manage options inline (label + color swatch).
2. **Task detail dialog** — adds a "Properties" section under description. Each property renders the right input (text field, number, color-tagged select, calendar, checkbox, URL, etc.).
3. **Kanban card** — properties marked `show_on_card` render as compact chips below the title (select chips colored, dates as `MMM d`, checkbox as ✓, etc.).

## Technical notes

- All reads/writes go through the existing browser Supabase client (matches current pattern in `_app.tasks.tsx`); no new server functions needed.
- Property values stored as `jsonb` keeps schema flexible without per-type tables.
- Formula evaluator: tiny safe expression parser limited to numeric ops + reference to other property names. No arbitrary JS.
- Relation v1: stores an array of task IDs, renders as linked chips. No back-references yet.

## Out of scope (backlog)

- Per-project property scoping
- People / Email / Phone types
- Showing properties as columns in List view (you chose detail-panel + cards only)
- Filtering/sorting by custom properties
- Formula references across relations
