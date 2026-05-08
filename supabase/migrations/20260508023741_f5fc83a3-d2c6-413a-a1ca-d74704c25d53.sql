-- Subtasks
alter table public.tasks
  add column if not exists parent_task_id uuid references public.tasks(id) on delete cascade;
create index if not exists tasks_parent_idx on public.tasks (parent_task_id);

-- Tags on tasks
alter table public.tasks
  add column if not exists tags text[] not null default '{}';
create index if not exists tasks_tags_idx on public.tasks using gin (tags);

-- Pages can attach to a project (this is where project plans live)
alter table public.pages
  add column if not exists project_id uuid references public.projects(id) on delete set null;
create index if not exists pages_project_idx on public.pages (user_id, project_id);

-- Full-text search columns
alter table public.tasks
  add column if not exists search tsvector
  generated always as (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,''))) stored;
create index if not exists tasks_search_idx on public.tasks using gin (search);

alter table public.notes
  add column if not exists search tsvector
  generated always as (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,''))) stored;
create index if not exists notes_search_idx on public.notes using gin (search);

alter table public.pages
  add column if not exists search tsvector
  generated always as (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,''))) stored;
create index if not exists pages_search_idx on public.pages using gin (search);

-- Project descriptions
alter table public.projects
  add column if not exists description text;