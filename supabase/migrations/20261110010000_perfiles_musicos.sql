-- Etapa 2 · Autenticación con roles.
-- Cada usuario registrado (auth.users) tiene un perfil en public.profiles.
-- Por ahora el único rol de registro es 'musico'. El rol 'admin' existe para
-- la gente de la banda que maneja la cola de pedidos y se asigna a mano
-- desde Supabase Studio (nadie puede auto-asignárselo desde el cliente).
-- Idempotente: se puede aplicar con `supabase db push` o pegándolo en el SQL Editor.

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null default 'musico' check (role in ('musico', 'admin')),
  nombre      text check (nombre is null or char_length(btrim(nombre)) between 1 and 80),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Cada usuario ve su propio perfil (la lectura pública se abre en la migración de perfiles públicos).
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- El cliente sólo puede editar columnas "de perfil": nunca `role` ni `id`.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update (nombre) on public.profiles to authenticated;

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Al registrarse un usuario, se le crea su perfil con rol 'musico'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'musico')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuarios que ya existían antes de esta migración.
insert into public.profiles (id, role)
select id, 'musico' from auth.users
on conflict (id) do nothing;

-- Helper para policies: ¿el usuario actual es admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;
