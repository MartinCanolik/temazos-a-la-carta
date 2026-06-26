-- Fase 2 — Tabla de pedidos (cola global del show) + RLS + Realtime
-- Idempotente: se puede aplicar con `supabase db push` o pegándolo en el SQL Editor.

create table if not exists public.pedidos (
  id            uuid primary key default gen_random_uuid(),
  track_id      text not null check (char_length(track_id) between 1 and 64),
  track_name    text not null check (char_length(track_name) between 1 and 300),
  artist_name   text not null check (char_length(artist_name) between 1 and 300),
  album_image   text check (album_image is null or char_length(album_image) <= 600),
  requester     text not null check (char_length(btrim(requester)) between 1 and 60),
  device_id     text not null check (char_length(device_id) between 1 and 64),
  wants_to_sing boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Un track no puede estar dos veces en la cola (bloqueo duro de duplicados)
create unique index if not exists pedidos_track_unico on public.pedidos (track_id);

-- Orden de la cola
create index if not exists pedidos_created_at_idx on public.pedidos (created_at);

alter table public.pedidos enable row level security;

-- Lectura pública (necesaria también para que Realtime entregue eventos)
drop policy if exists "pedidos_select_public" on public.pedidos;
create policy "pedidos_select_public"
  on public.pedidos for select
  using (true);

-- Inserción pública (cualquiera puede pedir)
drop policy if exists "pedidos_insert_public" on public.pedidos;
create policy "pedidos_insert_public"
  on public.pedidos for insert
  with check (true);

-- Sin policy de DELETE/UPDATE a propósito: nadie puede borrar/editar desde el cliente
-- (se habilitará cuando exista el panel de la banda).

-- Activar Realtime sobre la tabla (sólo si no está ya en la publicación)
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pedidos'
  ) then
    alter publication supabase_realtime add table public.pedidos;
  end if;
end $$;
