-- Shared song catalog.
-- Songs are identified once in `canciones` (normalized key + optional Spotify id)
-- and every musician's repertoire row points at it, so matches between
-- musicians are exact and detectable server-side.
-- Idempotent: can be applied with `supabase db push` or pasted in the SQL Editor.

-- ─── Normalization ──────────────────────────────────────────────────────────
-- MUST stay in sync with `normalizarTexto` in src/lib/canciones.ts:
--   strip accents, lowercase, drop "(...)" / "[...]" groups, drop a trailing
--   " - suffix", collapse runs of non [a-z0-9] into one space, trim.
-- Accents are stripped with translate() (only characters that decompose under
-- Unicode NFD, like the JS version) so we do not depend on the unaccent extension.
create or replace function public.normalizar_texto(texto text)
returns text
language sql
immutable
strict
parallel safe
as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          lower(
            translate(
              texto,
              'àáâãäåāăąçćĉċčďèéêëēĕėęěĝğġģĥìíîïĩīĭįĵķĺļľñńņňòóôõöōŏőŕŗřśŝşšţťùúûüũūŭůűųŵýÿŷźżžÀÁÂÃÄÅĀĂĄÇĆĈĊČĎÈÉÊËĒĔĖĘĚĜĞĠĢĤÌÍÎÏĨĪĬĮĴĶĹĻĽÑŃŅŇÒÓÔÕÖŌŎŐŔŖŘŚŜŞŠŢŤÙÚÛÜŨŪŬŮŰŲŴÝŸŶŹŻŽ',
              'aaaaaaaaacccccdeeeeeeeeegggghiiiiiiiijklllnnnnoooooooorrrssssttuuuuuuuuuuwyyyzzzAAAAAAAAACCCCCDEEEEEEEEEGGGGHIIIIIIIIJKLLLNNNNOOOOOOOORRRSSSSTTUUUUUUUUUUWYYYZZZ'
            )
          ),
          -- "(En vivo)", "[Remastered]". [^...] instead of a lazy .*? because in
          -- Postgres the first greedy atom would make the whole pattern greedy.
          '\s*[(\[][^)\]\n\r]*[)\]]\s*', ' ', 'g'
        ),
        '\s+-\s+.*$', ''          -- " - Remastered 2011"
      ),
      '[^a-z0-9]+', ' ', 'g'
    ),
    ' '
  )
$$;

-- ─── Catalog ────────────────────────────────────────────────────────────────
create table if not exists public.canciones (
  id                uuid primary key default gen_random_uuid(),
  titulo            text not null check (char_length(btrim(titulo)) between 1 and 200),
  artista           text not null check (char_length(btrim(artista)) between 1 and 200),
  clave             text generated always as (
                      public.normalizar_texto(titulo) || '|' || public.normalizar_texto(artista)
                    ) stored,
  spotify_track_id  text check (spotify_track_id is null or char_length(spotify_track_id) <= 64),
  created_by        uuid references auth.users (id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  constraint canciones_clave_key unique (clave),
  constraint canciones_spotify_track_id_key unique (spotify_track_id)
);

alter table public.canciones enable row level security;

-- The catalog is public. Clients cannot write directly: they go through
-- `obtener_o_crear_cancion`, which dedupes.
drop policy if exists "canciones_select" on public.canciones;
create policy "canciones_select"
  on public.canciones for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate on public.canciones from anon, authenticated;
grant select on public.canciones to anon, authenticated;

-- ─── Resolve-or-create RPC ──────────────────────────────────────────────────
create or replace function public.obtener_o_crear_cancion(
  p_titulo text,
  p_artista text,
  p_spotify_track_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titulo   text := btrim(coalesce(p_titulo, ''));
  v_artista  text := btrim(coalesce(p_artista, ''));
  v_spotify  text := nullif(btrim(coalesce(p_spotify_track_id, '')), '');
  v_clave    text;
  v_id       uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if char_length(v_titulo) not between 1 and 200 then
    raise exception 'Invalid title' using errcode = '22023';
  end if;
  if char_length(v_artista) not between 1 and 200 then
    raise exception 'Invalid artist' using errcode = '22023';
  end if;
  if v_spotify is not null and char_length(v_spotify) > 64 then
    raise exception 'Invalid Spotify track id' using errcode = '22023';
  end if;

  v_clave := normalizar_texto(v_titulo) || '|' || normalizar_texto(v_artista);

  -- 1. Spotify id is the strongest identity.
  if v_spotify is not null then
    select id into v_id from canciones where spotify_track_id = v_spotify;
    if found then return v_id; end if;
  end if;

  -- 2. Normalized title + artist.
  select id into v_id from canciones where clave = v_clave;
  if found then
    if v_spotify is not null then
      begin
        update canciones c
           set spotify_track_id = v_spotify
         where c.id = v_id
           and c.spotify_track_id is null
           and not exists (select 1 from canciones o where o.spotify_track_id = v_spotify);
      exception when unique_violation then
        null; -- someone else claimed that Spotify id first; keep the song as is
      end;
    end if;
    return v_id;
  end if;

  -- 3. Create. ON CONFLICT without a target covers both unique keys (race-safe).
  insert into canciones (titulo, artista, spotify_track_id)
  values (v_titulo, v_artista, v_spotify)
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    -- Lost a race: the row exists now, find it again.
    if v_spotify is not null then
      select id into v_id from canciones where spotify_track_id = v_spotify;
    end if;
    if v_id is null then
      select id into v_id from canciones where clave = v_clave;
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.obtener_o_crear_cancion(text, text, text) from public, anon;
grant execute on function public.obtener_o_crear_cancion(text, text, text) to authenticated;

-- ─── Repertoire now points at the catalog ───────────────────────────────────
alter table public.musico_canciones
  add column if not exists cancion_id uuid references public.canciones (id) on delete restrict;
alter table public.musico_canciones
  add column if not exists instrumento text
    check (instrumento is null or char_length(instrumento) <= 60);

-- One-time data migration (skipped once the old columns are gone).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'musico_canciones' and column_name = 'titulo'
  ) then
    return;
  end if;

  -- 1. One catalog row per distinct key, using the earliest row's spelling.
  --    A Spotify id is carried over only to the first song claiming it.
  insert into canciones (titulo, artista, spotify_track_id)
  select g.titulo, g.artista,
         case when row_number() over (partition by g.spotify_track_id order by g.created_at, g.id) = 1
              then g.spotify_track_id end
  from (
    select distinct on (normalizar_texto(m.titulo) || '|' || normalizar_texto(m.artista))
           m.id, m.created_at, btrim(m.titulo) as titulo, btrim(m.artista) as artista,
           (select s.spotify_track_id from musico_canciones s
             where normalizar_texto(s.titulo) || '|' || normalizar_texto(s.artista)
                 = normalizar_texto(m.titulo) || '|' || normalizar_texto(m.artista)
               and s.spotify_track_id is not null
             order by s.created_at, s.id limit 1) as spotify_track_id
    from musico_canciones m
    order by normalizar_texto(m.titulo) || '|' || normalizar_texto(m.artista), m.created_at, m.id
  ) g
  on conflict do nothing;

  update musico_canciones m
     set cancion_id = c.id
    from canciones c
   where m.cancion_id is null
     and c.clave = normalizar_texto(m.titulo) || '|' || normalizar_texto(m.artista);

  -- 2. Two rows of the same musician can collapse onto one catalog song
  --    (e.g. "Hotel California" and "Hotel California (Live)"). Keep the earliest,
  --    re-point setlist rows to it, drop the duplicate. Per-musician fields of the
  --    duplicate (key, notes...) are discarded.
  drop table if exists pg_temp._mc_dup;
  create temp table _mc_dup as
  select id as dup_id, keep_id
  from (
    select id,
           first_value(id) over w as keep_id,
           row_number() over w as rn
    from musico_canciones
    window w as (partition by musico_id, cancion_id order by created_at, id)
  ) x
  where rn > 1;

  -- setlist rows that would collide with the kept row in the same show
  delete from toque_canciones tc
  using _mc_dup d
  where tc.cancion_id = d.dup_id
    and exists (
      select 1 from toque_canciones k
      where k.toque_id = tc.toque_id and k.cancion_id = d.keep_id
    );

  -- setlist rows where several duplicates sit in the same show: keep the first
  delete from toque_canciones tc
  using (
    select tc2.toque_id, tc2.cancion_id,
           row_number() over (partition by tc2.toque_id, d.keep_id order by tc2.orden, tc2.cancion_id) as rn
    from toque_canciones tc2
    join _mc_dup d on d.dup_id = tc2.cancion_id
  ) r
  where tc.toque_id = r.toque_id and tc.cancion_id = r.cancion_id and r.rn > 1;

  update toque_canciones tc
     set cancion_id = d.keep_id
    from _mc_dup d
   where tc.cancion_id = d.dup_id;

  delete from musico_canciones m using _mc_dup d where m.id = d.dup_id;
  drop table _mc_dup;
end
$$;

create unique index if not exists musico_canciones_musico_cancion_unica
  on public.musico_canciones (musico_id, cancion_id);

alter table public.musico_canciones alter column cancion_id set not null;

drop index if exists public.musico_canciones_unica;

alter table public.musico_canciones drop column if exists titulo;
alter table public.musico_canciones drop column if exists artista;
alter table public.musico_canciones drop column if exists spotify_track_id;

create index if not exists musico_canciones_cancion_idx on public.musico_canciones (cancion_id);
