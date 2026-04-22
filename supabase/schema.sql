-- Tags table
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  dimension text not null check (dimension in ('scene', 'style', 'element')),
  color text,
  created_at timestamptz default now()
);

-- Materials table
create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text not null,
  source_url text,
  source_platform text,
  author text,
  is_featured boolean default false,
  created_at timestamptz default now()
);

-- Junction table
create table if not exists material_tags (
  material_id uuid references materials(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (material_id, tag_id)
);

-- Enable RLS
alter table tags enable row level security;
alter table materials enable row level security;
alter table material_tags enable row level security;

-- Public read access
create policy "Public read tags" on tags for select using (true);
create policy "Public read materials" on materials for select using (true);
create policy "Public read material_tags" on material_tags for select using (true);

-- Admin write access (authenticated users)
create policy "Admin insert tags" on tags for insert with check (auth.role() = 'authenticated');
create policy "Admin update tags" on tags for update using (auth.role() = 'authenticated');
create policy "Admin delete tags" on tags for delete using (auth.role() = 'authenticated');

create policy "Admin insert materials" on materials for insert with check (auth.role() = 'authenticated');
create policy "Admin update materials" on materials for update using (auth.role() = 'authenticated');
create policy "Admin delete materials" on materials for delete using (auth.role() = 'authenticated');

create policy "Admin insert material_tags" on material_tags for insert with check (auth.role() = 'authenticated');
create policy "Admin delete material_tags" on material_tags for delete using (auth.role() = 'authenticated');

-- Full text search
alter table materials add column if not exists search_vector tsvector
  generated always as (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))) stored;

create index if not exists materials_search_idx on materials using gin(search_vector);
