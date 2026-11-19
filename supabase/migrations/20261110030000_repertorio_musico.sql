-- Etapa 2 · Repertorio del músico.
-- Las canciones que cada músico puede tocar, con SU versión: tonalidad,
-- descripción de la versión/arreglo, link de referencia y notas.
-- Idempotente: se puede aplicar con `supabase db push` o pegándolo en el SQL Editor.

create table if not exists public.musico_canciones (
  id                uuid primary key default gen_random_uuid(),
  musico_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  titulo            text not null check (char_length(btrim(titulo)) between 1 and 200),
  artista           text not null check (char_length(btrim(artista)) between 1 and 200),
  spotify_track_id  text check (spotify_track_id is null or char_length(spotify_track_id) <= 64),
  tonalidad         text check (tonalidad is null or char_length(tonalidad) <= 12),
  version           text check (version is null or char_length(version) <= 120),
  referencia_url    text check (referencia_url is null or char_length(referencia_url) <= 500),
  notas             text check (notas is null or char_length(notas) <= 500),
  created_at        timestamptz not null default now()
);

-- Un músico no puede tener la misma canción (título + artista) dos veces.
create unique index if not exists musico_canciones_unica
  on public.musico_canciones (musico_id, lower(btrim(titulo)), lower(btrim(artista)));

create index if not exists musico_canciones_musico_idx on public.musico_canciones (musico_id);

alter table public.musico_canciones enable row level security;

-- Lectura: el repertorio es visible si el perfil es público (tiene slug), o si es el propio.
drop policy if exists "musico_canciones_select" on public.musico_canciones;
create policy "musico_canciones_select"
  on public.musico_canciones for select
  to anon, authenticated
  using (
    musico_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = musico_canciones.musico_id and p.slug is not null
    )
  );

-- Escritura: sólo el dueño.
drop policy if exists "musico_canciones_insert_own" on public.musico_canciones;
create policy "musico_canciones_insert_own"
  on public.musico_canciones for insert
  to authenticated
  with check (musico_id = auth.uid());

drop policy if exists "musico_canciones_update_own" on public.musico_canciones;
create policy "musico_canciones_update_own"
  on public.musico_canciones for update
  to authenticated
  using (musico_id = auth.uid())
  with check (musico_id = auth.uid());

drop policy if exists "musico_canciones_delete_own" on public.musico_canciones;
create policy "musico_canciones_delete_own"
  on public.musico_canciones for delete
  to authenticated
  using (musico_id = auth.uid());

grant select on public.musico_canciones to anon, authenticated;
grant insert, update, delete on public.musico_canciones to authenticated;
