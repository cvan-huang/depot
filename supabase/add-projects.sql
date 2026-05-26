create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table materials add column if not exists project_id uuid references projects(id) on delete set null;

create index if not exists materials_project_id_idx on materials(project_id);

alter table projects enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'projects' and policyname = 'Public read projects'
  ) then
    create policy "Public read projects" on projects for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'projects' and policyname = 'Admin insert projects'
  ) then
    create policy "Admin insert projects" on projects for insert with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'projects' and policyname = 'Admin update projects'
  ) then
    create policy "Admin update projects" on projects for update using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'projects' and policyname = 'Admin delete projects'
  ) then
    create policy "Admin delete projects" on projects for delete using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'projects' and policyname = 'Public insert projects'
  ) then
    create policy "Public insert projects" on projects for insert with check (true);
  end if;
end $$;

notify pgrst, 'reload schema';
