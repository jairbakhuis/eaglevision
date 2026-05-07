# Personal AI Assistant Hub

A private app (Google login, single user) combining a Claude-style chat with multiple AI providers, a Todoist-style task manager with dashboard, a Notion-style document workspace, notes, calendar, and a credits tracker.

## Research summary

Comparable apps: TypingMind, LibreChat, Open WebUI, Msty, ChatHub, BoltAI. Common gaps yours fills:
- Most are chat-only — yours bundles tasks, docs, notes, and calendar.
- Few track per-provider credit usage with direct top-up links.
- None tailored to a single-user personal hub.

## App layout

Collapsible sidebar: Chat, Tasks, Calendar, Notes, Documents, Credits, Settings. Top bar shows model selector and quick-new buttons.

## Pages

### 1. Chat (`/`) — homepage
- Claude-style centered conversation, streaming responses, markdown + code highlighting
- Model picker: OpenRouter, Anthropic, OpenAI, Google Gemini (your own keys)
- Conversations list in left rail: rename, delete, pin, search
- Per-message: copy, regenerate, edit-and-resend
- Attach images (vision models) and reference a Document or Note as context
- System prompt per conversation
- Token usage logged per message → feeds Credits page

### 2. Tasks (`/tasks`) — Todoist clone
- Sidebar of Projects (color + icon) + Inbox, Today, Upcoming
- Inside a project: toggle **List** ↔ **Kanban** (Todo / In Progress / Done, drag-and-drop)
- Tasks: title, markdown description, due date, priority P1–P4, labels, subtasks, comments
- Quick-add bar with natural language ("Pay rent tomorrow 9am p1")
- Filters: today, overdue, by label, by priority

### 3. Dashboard (top of Tasks page)
- Today's tasks + completion ring
- Overdue tasks list
- Upcoming this week mini-timeline
- 14-day completion streak chart
- Per-project open vs done stats
- "Ask AI to plan my day" → drafts an order via the chat assistant

### 4. Calendar (`/calendar`)
- Month / week / day views of all tasks with due dates
- Drag tasks to reschedule
- Color-coded by project

### 5. Notes (`/notes`)
- Markdown notes with tags and folders
- Full-text search
- "Send to chat as context" action

### 6. Documents (`/documents`) — Notion-style workspace
- **Nested page tree** in left rail: pages can contain sub-pages infinitely; drag to reorder/reparent; collapse/expand; favorites and trash
- **Block-based editor** (one block per line/element):
  - Text, H1–H3, bullet/numbered/toggle lists, checkboxes, quote, divider, callout
  - Code blocks with syntax highlighting
  - Tables
  - Images (uploaded to storage)
  - File attachments (PDF, etc.) with inline preview
  - Embeds (YouTube, links with preview cards)
- **Slash menu** (`/`) to insert any block; **drag handle** on each block to reorder; **markdown shortcuts** (`# `, `- `, `[]`)
- Cover image and emoji icon per page (Notion-style)
- Backlinks: see which other pages link here
- `@mention` other pages to link them
- Full-text search across all pages
- "Use page in chat" → sends page content as context to the AI
- "Ask AI about this page" inline action
- Share/export page as Markdown or PDF

### 7. Credits & Models (`/credits`)
- Card per provider (OpenRouter, Anthropic, OpenAI, Gemini):
  - Tokens used today / week / month (from chat logs)
  - Estimated cost using current pricing table
  - Direct link to that provider's billing/top-up page
- Per-model breakdown table
- Usage chart over last 30 days

### 8. Settings (`/settings`)
- Google login / sign out
- API keys per provider (encrypted server-side)
- Default model, default system prompt, theme (light/dark)
- Export data

## Design

Clean, minimal, Claude/Linear/Notion-inspired. Light + dark mode. Rounded cards, subtle borders, generous whitespace, monospace for code.

## Technical notes

- **Auth**: Lovable Cloud, Google sign-in only (your email allow-listed)
- **Backend**: Lovable Cloud (Postgres, storage, server functions)
- **AI**: server functions proxy to OpenRouter / Anthropic / OpenAI / Gemini using your stored keys; SSE streaming
- **Token logging**: every completion writes `usage_log` (provider, model, prompt/completion tokens, cost estimate)
- **Notion editor**: TipTap (ProseMirror) with block extensions; stored as JSON document per page
- **Page tree**: self-referencing `pages` table with `parent_id`, `position`, `icon`, `cover_url`
- **Drag-and-drop**: dnd-kit for Kanban, calendar reschedule, page tree reorder
- **Markdown**: react-markdown + rehype-highlight in chat
- **Storage**: Supabase storage bucket for page covers, document images, attachments
- **Schema**: `conversations`, `messages`, `usage_log`, `projects`, `tasks`, `subtasks`, `labels`, `notes`, `pages` (nested), `page_links`, `page_blocks` (or JSON), `attachments`, `api_keys`, `settings`

## Build order (after approval)

1. Auth + Cloud + sidebar shell + Settings (API keys)
2. Chat with streaming for all 4 providers + usage logging
3. Tasks: projects, list view, quick-add
4. Tasks: Kanban + dashboard widgets
5. Calendar
6. Credits page (reads usage_log)
7. Notes
8. Documents (Notion-style nested pages + block editor)
