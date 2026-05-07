
-- profiles
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, new.raw_user_meta_data->>'name');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- conversations
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null default 'New chat',
  provider text not null default 'lovable',
  model text not null default 'google/gemini-3-flash-preview',
  system_prompt text,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.conversations enable row level security;
create policy "own conv all" on public.conversations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.conversations (user_id, updated_at desc);

-- messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  prompt_tokens int,
  completion_tokens int,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create policy "own msg all" on public.messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.messages (conversation_id, created_at);

-- usage log
create table public.usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  provider text not null,
  model text not null,
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  cost_usd numeric(10,6) not null default 0,
  created_at timestamptz not null default now()
);
alter table public.usage_log enable row level security;
create policy "own usage all" on public.usage_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.usage_log (user_id, created_at desc);

-- projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  color text not null default '#3b82f6',
  icon text,
  view text not null default 'list' check (view in ('list','kanban')),
  position int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.projects enable row level security;
create policy "own proj all" on public.projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  project_id uuid references public.projects on delete cascade,
  title text not null,
  description text,
  due_date timestamptz,
  priority int not null default 4 check (priority between 1 and 4),
  status text not null default 'todo' check (status in ('todo','in_progress','done')),
  position int not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tasks enable row level security;
create policy "own task all" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.tasks (user_id, project_id);
create index on public.tasks (user_id, due_date);

-- notes
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null default 'Untitled',
  content text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.notes enable row level security;
create policy "own note all" on public.notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- pages (notion-style nested)
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  parent_id uuid references public.pages on delete cascade,
  title text not null default 'Untitled',
  icon text,
  cover_url text,
  content text not null default '',
  position int not null default 0,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pages enable row level security;
create policy "own page all" on public.pages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.pages (user_id, parent_id);
