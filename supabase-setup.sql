create extension if not exists "pgcrypto";

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null default 'Sem categoria',
  price numeric(10,2) not null default 0,
  image_url text,
  available boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.products add column if not exists featured boolean not null default false;
alter table public.products enable row level security;

drop policy if exists "Public can view products" on public.products;
create policy "Public can view products" on public.products for select using (true);
drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products" on public.products for insert to authenticated with check (true);
drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products" on public.products for update to authenticated using (true) with check (true);
drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products" on public.products for delete to authenticated using (true);

create table if not exists public.settings (
  id int primary key default 1,
  title text default 'Lótus Confeitaria',
  subtitle text default 'Doces artesanais, bolos e encomendas especiais.',
  banner_title text default 'Monte seu pedido online',
  banner_text text default 'Escolha os produtos e finalize no WhatsApp.'
);

alter table public.settings enable row level security;
drop policy if exists "Public can view settings" on public.settings;
create policy "Public can view settings" on public.settings for select using (true);
drop policy if exists "Admins can insert settings" on public.settings;
create policy "Admins can insert settings" on public.settings for insert to authenticated with check (true);
drop policy if exists "Admins can update settings" on public.settings;
create policy "Admins can update settings" on public.settings for update to authenticated using (true) with check (true);

insert into public.settings (id,title,subtitle,banner_title,banner_text)
values (1,'Lótus Confeitaria','Doces artesanais, bolos e encomendas especiais.','Monte seu pedido online','Escolha os produtos e finalize no WhatsApp.')
on conflict (id) do nothing;