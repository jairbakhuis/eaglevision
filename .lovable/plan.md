## What we're building (in order)

You picked four areas. I checked the code: `_app.calendar.tsx` is only **7 lines — a stub**, not a polish job. So calendar is a real build, not a tweak. Re-ordered accordingly.

---

### 1. Saved filters & custom views  *(primary focus)*

Todoist's killer feature: type a query, save it, pin it in the sidebar.

**New table** `filters`: `id, user_id, name, query, icon, color, position, created_at`. RLS = own-only.

**Query language** (start small, extend later):
```
today              — due today or overdue
overdue
upcoming           — due in next 7 days
no date
inbox
p1 / p2 / p3 / p4
#projectname
@label
done
&  (and)   |  (or)   !  (not)
```
Examples:
- `today & p1`
- `overdue | (today & #work)`
- `@home & !done`
- `7 days & #personal`

Parser: tokenize → recursive-descent → returns a predicate `(task, projects) => boolean`. Pure JS, ~150 LOC.

**UI**:
- Sidebar gets a **Filters** section under Projects. `+` button → dialog with name, icon, color, query input with **live preview** count + first 5 matching tasks.
- Click filter → `setFilter({ kind: "saved", id })` rendering filtered tasks.
- Right-click → Edit / Delete / Reorder (drag).
- Add 3 starter filters seeded on first visit: **Today + P1**, **Overdue**, **No date**.

---

### 2. Calendar — real build (stub today)

The existing `_app.calendar.tsx` has 7 lines. Build:
- **Month / Week / Day** view toggle.
- Renders all tasks with `due_date`, color-coded by project.
- **Drag a task** to a new day/time → updates `due_date` (uses `dnd-kit` already installed).
- Click empty day → quick-add task pre-filled with that date.
- Click task → opens existing TaskEditor.
- Recurring tasks show 🔁 badge; show only the next occurrence (don't fan out the whole rrule yet).
- Today highlighted, week starts Monday (matches existing `isThisWeek` config).

Library: build with native CSS grid + date-fns (already installed). No heavy calendar library needed for v1.

---

### 3. Documents & Notes upgrades

**Notes (328 LOC currently — basic markdown)**
- Full-text search across title + content (already have `search tsvector` column — just wire it up with `to_tsquery`).
- Tag chips with click-to-filter.
- "Send to chat as context" button → opens chat with note pre-loaded as system context.

**Documents (388 LOC, basic page tree)**
- **Slash menu** (`/`) for inserting blocks: H1, H2, bullet, checkbox, code, divider, quote.
- **Markdown shortcuts** while typing: `# `, `## `, `- `, `[] `, `> `, ``` ``` `.
- **Drag-to-reorder** pages in the tree (dnd-kit).
- "Ask AI about this page" inline button → opens chat with page as context.
- Export current page as Markdown (one-click download).

(Skipping image uploads, embeds, backlinks, cover images for v1 — bigger lift, push to a later round.)

---

### 4. Chat upgrades

- **Streaming response polish**: typewriter cursor, stop button, regenerate.
- **Image attach** for vision models (Gemini 2.5 Flash, GPT-5) — uploads to Supabase storage, sent as `image_url` content part.
- **Conversation search** in left rail (matches title + first message).
- **Per-conversation system prompt** editor (column already exists).
- **Edit & resend** a previous user message — truncates conversation at that point.

---

## Build order across messages

To keep each iteration shippable and reviewable:

1. **Filters** (table + parser + sidebar UI + dialog) — one build.
2. **Calendar** Month + Week views with drag-to-reschedule — one build.
3. **Calendar** Day view + click-to-create + recurring badge — small follow-up.
4. **Notes** search + chat-context button — one build.
5. **Documents** slash menu + markdown shortcuts + drag pages — one build.
6. **Documents** "ask AI" + export — small follow-up.
7. **Chat** streaming polish + edit/resend + search — one build.
8. **Chat** image attachments — one build (needs storage bucket).

You don't have to commit to all 8 — we can stop after any step.

---

## Technical notes

- Filter parser lives in `src/lib/filterQuery.ts`, returns `(task, projects, allTasks) => boolean` plus a `tokenize()` helper for the live-preview chips.
- Calendar uses CSS grid, no extra deps.
- Slash menu uses existing `cmdk` (`@/components/ui/command`).
- Image upload needs a new `chat-images` storage bucket with user-folder RLS.
- All new server logic stays in the existing `chat` edge function or direct Supabase calls (no new edge functions for steps 1–7).

---

## What I'm starting with

**Step 1: Saved filters & custom views** — biggest power-user payoff and unblocks better Today/Overdue muscle memory.

Reply "go" (or pick a different starting step) and I'll implement.