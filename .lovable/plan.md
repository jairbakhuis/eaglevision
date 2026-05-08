## Goal

Make the task input feel "telepathic" like Todoist, plus add the power-user features that established to-do apps have proven valuable. We don't reinvent — we copy what already works.

## 1. Smart natural-language quick add (the headline feature)

Type one line, parser extracts metadata and shows colored chips inline before submit (so you see what was understood and can confirm/edit).

**Date & time**
- `today`, `tomorrow`, `tom`, `tonight`, `next week`, `next monday`, `mon`, `in 3 days`, `in 2 weeks`
- Specific: `25 dec`, `dec 25`, `25/12`, `2026-01-15`
- Times: `at 14:00`, `at 2pm`, `9am`, `noon`, `midnight`
- Combined: `buy skittles tomorrow at 2pm`

**Recurring**
- `every day`, `every monday`, `every weekday`, `every 2 weeks`, `every month`, `every 1st`, `every last friday`

**Priority**
- `p1`, `p2`, `p3`, `p4` (Todoist convention; P1 = urgent)
- `!!!` shortcut

**Project / labels**
- `#projectname` → routes into that project (autocomplete dropdown)
- `@label` → tag (autocomplete)

**Duration / reminder (lightweight)**
- `for 30m`, `for 2h` → duration
- `*30m before` → reminder offset

Library: use `chrono-node` (battle-tested NLP date parser, handles all the above for English) + a thin custom layer for `#`, `@`, `p1`, `every …`.

## 2. Recurring tasks

When a recurring task is completed, auto-create the next instance based on the rule. Show 🔁 icon. Common patterns: daily, weekly on weekday, monthly on date, every N days.

## 3. Smart Inbox & Today behavior

- **Postpone / Reschedule menu**: Today, Tomorrow, This weekend, Next week, No date, Pick date.
- **Bulk reschedule**: select multiple → move all.
- **Drag-into-day**: from Upcoming, drag onto another day.

## 4. Sections inside projects

Lightweight subdivisions (e.g. "Shopping" project → "Groceries / Hardware"). Already partly possible via subtasks, but a flat "section" header is more usable for grouping.

## 5. Filters & saved views

User-defined filter expressions like `today & p1`, `@home`, `overdue`, `7 days & #work`. Save as named view in sidebar. (Todoist's killer power-user feature.)

## 6. Reminders & notifications

- Browser web push at the due time.
- "Smart reminder": if task has a time, remind 10 min before by default.

## 7. Productivity & habit features

- **Streaks / completion stats** (Todoist Karma, TickTick habit). Already partially in dashboard plan — wire it up.
- **Daily goal**: e.g. "complete 5 tasks today" with progress ring.

## 8. Inline polish

- **Markdown in titles & description** (links, bold).
- **Comments** on tasks.
- **Task duplicate / convert to subtask** via right-click.
- **Keyboard shortcuts**: `q` quick-add anywhere, `t` set today, `enter` save, `cmd+k` command palette.

## 9. AI assists (we already have Lovable AI — leverage it)

- "Plan my day" → AI orders today's tasks by priority/dependencies.
- "Break this task into subtasks" button.
- "Capture from text/image": paste a meeting note or screenshot → AI extracts tasks with dates (Todoist's newest feature; we can match it cheaply via Gemini vision).

## 10. Calendar 2-way

- Drag tasks on calendar to reschedule (already planned).
- Show time-blocked tasks as events with duration.

---

## Recommended build order (incremental, each shippable)

1. **Smart quick-add parser (chrono-node + projects/labels/priority/recurring)** — biggest perceived upgrade, fixes your skittles example today.
2. **Recurring task engine** — auto-spawns next instance on complete.
3. **Reschedule menu + Today/Tomorrow/Next-week shortcuts**.
4. **Saved filters / custom views**.
5. **AI: Plan my day + Break into subtasks**.
6. **Web push reminders**.
7. **Sections, comments, keyboard shortcuts, polish**.

## Technical notes

- Add `chrono-node` (`bun add chrono-node`) — pure JS, Worker-safe.
- Recurrence: store `rrule` string on `tasks` (`rrule` npm package, also Worker-safe) — no schema migration needed beyond adding `rrule text` and `reminder_at timestamptz` columns.
- Filters: store as rows in a new `filters` table (`name`, `query`, `position`).
- Notifications: Web Push API + service worker; store subscription server-side.
- AI features: existing `chat` edge function + structured JSON output.

---

## Decision needed before I implement

Pick what to build first (or "all of #1"):

- **A.** Just smart quick-add + recurring (steps 1–2). Fastest path to your skittles example. ~1 build.
- **B.** A + reschedule shortcuts + saved filters (steps 1–4). Full Todoist-class core. ~2–3 builds.
- **C.** Full plan (1–7) phased over several iterations.

Tell me A / B / C (or pick specific numbers) and I'll implement.