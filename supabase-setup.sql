
-- LÓTUS CONFEITARIA 3.0
create extension if not exists "pgcrypto";

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text default '',
  position integer not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null default 'Sem categoria',
  price numeric(10,2) not null default 0,
  image_url text,
  available boolean not null default true,
  featured boolean not null default false,
  stock integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.products add column if not exists featured boolean not null default false;
alter table public.products add column if not exists stock integer not null default 0;

create table if not exists public.settings (
  id integer primary key default 1,
  title text default 'Lótus Confeitaria',
  subtitle text default 'Doces artesanais, bolos e encomendas especiais.',
  banner_title text default 'Monte seu pedido online',
  banner_text text default 'Escolha os produtos e finalize pelo WhatsApp.',
  pix_key text default '',
  pix_name text default '',
  delivery_fee numeric(10,2) not null default 0,
  min_order numeric(10,2) not null default 0
);

alter table public.settings add column if not exists pix_key text default '';
alter table public.settings add column if not exists pix_name text default '';
alter table public.settings add column if not exists delivery_fee numeric(10,2) not null default 0;
alter table public.settings add column if not exists min_order numeric(10,2) not null default 0;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_phone text not null,
  delivery_type text not null default 'retirada',
  address text default '',
  neighborhood text default '',
  scheduled_date date,
  scheduled_time time,
  payment_method text default 'pix',
  notes text default '',
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  status text not null default 'novo',
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.settings enable row level security;
alter table public.orders enable row level security;

drop policy if exists "Public can view categories" on public.categories;
create policy "Public can view categories" on public.categories for select using (true);
drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories" on public.categories for all to authenticated using (true) with check (true);

drop policy if exists "Public can view products" on public.products;
create policy "Public can view products" on public.products for select using (true);
drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products" on public.products for all to authenticated using (true) with check (true);

drop policy if exists "Public can view settings" on public.settings;
create policy "Public can view settings" on public.settings for select using (true);
drop policy if exists "Admins manage settings" on public.settings;
create policy "Admins manage settings" on public.settings for all to authenticated using (true) with check (true);

drop policy if exists "Public can create orders" on public.orders;
create policy "Public can create orders" on public.orders for insert with check (true);
drop policy if exists "Admins can view orders" on public.orders;
create policy "Admins can view orders" on public.orders for select to authenticated using (true);
drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders" on public.orders for update to authenticated using (true) with check (true);
drop policy if exists "Admins can delete orders" on public.orders;
create policy "Admins can delete orders" on public.orders for delete to authenticated using (true);

insert into public.settings (id,title,subtitle,banner_title,banner_text)
values (1,'Lótus Confeitaria','Doces artesanais, bolos e encomendas especiais.','Monte seu pedido online','Escolha os produtos e finalize pelo WhatsApp.')
on conflict (id) do nothing;

insert into public.categories (name,position,visible)
select distinct category,row_number() over(order by category)::integer-1,true
from public.products
where category is not null and btrim(category)<>''
on conflict (name) do nothing;
