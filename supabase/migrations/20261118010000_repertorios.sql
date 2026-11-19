-- Setlists ("repertorios") built for a lineup.
-- A setlist is an ordered list of catalog songs, the lineup it was built for and,
-- per song, a manual "needs rehearsal" mark. Setlists are standalone: later a
-- show will point at one, and one setlist can be reused across shows.
-- Idempotent: can be applied with `supabase db push` or pasted in the SQL Editor.

-- ─── Tables ─────────────────────────────────────────────────────────────────
create table if not exists public.repertorios (
  id           uuid primary key default gen_random_uuid(),
  creado_por   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre       text not null check (char_length(btrim(nombre)) between 1 and 120),
  notas        text check (notas is null or char_length(notas) <= 1000),
  -- Setlist this one was duplicated / started from.
  basado_en    uuid references public.repertorios (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists repertorios_creado_por_idx on public.repertorios (creado_por, updated_at desc);
create index if not exists repertorios_basado_en_idx on public.repertorios (basado_en);

drop trigger if exists repertorios_set_updated_at on public.repertorios;
create trigger repertorios_set_updated_at
  before update on public.repertorios
  for each row execute function public.set_updated_at();

-- The lineup the setlist was built for. The creator is always part of it.
create table if not exists public.repertorio_musicos (
  repertorio_id  uuid not null references public.repertorios (id) on delete cascade,
  musico_id      uuid not null references auth.users (id) on delete cascade,
  primary key (repertorio_id, musico_id)
);

create index if not exists repertorio_musicos_musico_idx on public.repertorio_musicos (musico_id);

-- Songs point at the shared CATALOG (not at one musician's repertoire row), so the
-- setlist stays valid when the lineup changes. `a_preparar` is the manual
-- "needs rehearsal" mark; "nobody-else-knows-it" is computed on the client.
create table if not exists public.repertorio_canciones (
  repertorio_id  uuid not null references public.repertorios (id) on delete cascade,
  cancion_id     uuid not null references public.canciones (id) on delete restrict,
  orden          integer not null check (orden >= 0),
  a_preparar     boolean not null default false,
  notas          text check (notas is null or char_length(notas) <= 500),
  primary key (repertorio_id, cancion_id),
  constraint repertorio_canciones_orden_key unique (repertorio_id, orden) deferrable initially deferred
);

create index if not exists repertorio_canciones_cancion_idx on public.repertorio_canciones (cancion_id);

-- ─── Access ─────────────────────────────────────────────────────────────────
-- Decision: setlists are readable by ANY authenticated musician. Song lists are not
-- sensitive and reusing setlists across the community is the point of the feature.
-- Anonymous visitors get nothing. Writes happen through the RPCs below
-- (SECURITY DEFINER), which allow the creator or a lineup member to edit; the only
-- direct write is DELETE, and only for the creator.
alter table public.repertorios enable row level security;
alter table public.repertorio_musicos enable row level security;
alter table public.repertorio_canciones enable row level security;

drop policy if exists "repertorios_select" on public.repertorios;
create policy "repertorios_select"
  on public.repertorios for select to authenticated using (true);

drop policy if exists "repertorios_delete_creador" on public.repertorios;
create policy "repertorios_delete_creador"
  on public.repertorios for delete to authenticated using (creado_por = auth.uid());

drop policy if exists "repertorio_musicos_select" on public.repertorio_musicos;
create policy "repertorio_musicos_select"
  on public.repertorio_musicos for select to authenticated using (true);

drop policy if exists "repertorio_canciones_select" on public.repertorio_canciones;
create policy "repertorio_canciones_select"
  on public.repertorio_canciones for select to authenticated using (true);

revoke all on public.repertorios, public.repertorio_musicos, public.repertorio_canciones from public, anon, authenticated;
grant select on public.repertorios, public.repertorio_musicos, public.repertorio_canciones to authenticated;
grant delete on public.repertorios to authenticated;

-- Can the current user edit this setlist? (creator or lineup member)
create or replace function public.puede_editar_repertorio(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    exists (select 1 from repertorios r where r.id = p_id and r.creado_por = auth.uid())
    or exists (select 1 from repertorio_musicos m where m.repertorio_id = p_id and m.musico_id = auth.uid())
  );
$$;

revoke all on function public.puede_editar_repertorio(uuid) from public, anon;
grant execute on function public.puede_editar_repertorio(uuid) to authenticated;

-- ─── Atomic save ────────────────────────────────────────────────────────────
-- p_canciones: jsonb array of {cancion_id, orden, a_preparar, notas}. Songs are
-- stored with a contiguous `orden` (0..n-1) following the given `orden` (array
-- position breaks ties); repeated songs keep the first occurrence.
create or replace function public.guardar_repertorio(
  p_id uuid,
  p_nombre text,
  p_notas text,
  p_musicos uuid[],
  p_canciones jsonb,
  p_basado_en uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_nombre  text := btrim(coalesce(p_nombre, ''));
  v_notas   text := nullif(btrim(coalesce(p_notas, '')), '');
  v_id      uuid;
  v_creador uuid;
  v_faltan  integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if char_length(v_nombre) not between 1 and 120 then
    raise exception 'Invalid name' using errcode = '22023';
  end if;
  if v_notas is not null and char_length(v_notas) > 1000 then
    raise exception 'Notes too long' using errcode = '22023';
  end if;
  if p_canciones is null or jsonb_typeof(p_canciones) <> 'array' then
    raise exception 'Songs must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_canciones) > 300 then
    raise exception 'Too many songs' using errcode = '22023';
  end if;
  if coalesce(array_length(p_musicos, 1), 0) > 12 then
    raise exception 'Too many musicians' using errcode = '22023';
  end if;

  -- Songs as rows: first occurrence of each catalog song wins.
  drop table if exists pg_temp._rc_songs;
  create temp table _rc_songs on commit drop as
  select cancion_id,
         row_number() over (order by orden, pos) - 1 as orden,
         a_preparar,
         notas
  from (
    select distinct on (cancion_id) cancion_id, orden, pos, a_preparar, notas
    from (
      select (e.value ->> 'cancion_id')::uuid as cancion_id,
             coalesce((e.value ->> 'orden')::integer, 0) as orden,
             e.ordinality as pos,
             coalesce((e.value ->> 'a_preparar')::boolean, false) as a_preparar,
             nullif(left(btrim(coalesce(e.value ->> 'notas', '')), 500), '') as notas
      from jsonb_array_elements(p_canciones) with ordinality as e(value, ordinality)
    ) raw
    order by cancion_id, pos
  ) uniq;

  select count(*) into v_faltan
  from _rc_songs s
  where not exists (select 1 from canciones c where c.id = s.cancion_id);
  if v_faltan > 0 then
    raise exception 'Unknown catalog song' using errcode = '23503';
  end if;

  if p_id is null then
    insert into repertorios (creado_por, nombre, notas, basado_en)
    values (
      v_uid, v_nombre, v_notas,
      (select r.id from repertorios r where r.id = p_basado_en)
    )
    returning id, creado_por into v_id, v_creador;
  else
    select r.creado_por into v_creador from repertorios r where r.id = p_id for update;
    if not found then
      raise exception 'Setlist not found' using errcode = 'P0002';
    end if;
    if not puede_editar_repertorio(p_id) then
      raise exception 'Not allowed to edit this setlist' using errcode = '42501';
    end if;
    v_id := p_id;
    update repertorios set nombre = v_nombre, notas = v_notas where id = v_id;
  end if;

  -- Lineup: the given musicians (only real accounts) plus the creator and the caller on create.
  delete from repertorio_musicos where repertorio_id = v_id;
  insert into repertorio_musicos (repertorio_id, musico_id)
  select v_id, u.id
  from auth.users u
  where u.id = any (coalesce(p_musicos, '{}') || v_creador || case when p_id is null then v_uid else null end)
  on conflict do nothing;

  delete from repertorio_canciones where repertorio_id = v_id;
  insert into repertorio_canciones (repertorio_id, cancion_id, orden, a_preparar, notas)
  select v_id, s.cancion_id, s.orden, s.a_preparar, s.notas from _rc_songs s;

  return v_id;
end;
$$;

revoke all on function public.guardar_repertorio(uuid, text, text, uuid[], jsonb, uuid) from public, anon;
grant execute on function public.guardar_repertorio(uuid, text, text, uuid[], jsonb, uuid) to authenticated;

-- ─── Duplicate ──────────────────────────────────────────────────────────────
-- Copies songs (and the lineup) into a new setlist owned by the caller.
create or replace function public.duplicar_repertorio(
  p_id uuid,
  p_nombre text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_orig   repertorios%rowtype;
  v_nombre text;
  v_id     uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_orig from repertorios where id = p_id;
  if not found then
    raise exception 'Setlist not found' using errcode = 'P0002';
  end if;

  v_nombre := coalesce(nullif(btrim(coalesce(p_nombre, '')), ''), left(v_orig.nombre, 112) || ' (copia)');
  if char_length(v_nombre) > 120 then
    raise exception 'Invalid name' using errcode = '22023';
  end if;

  insert into repertorios (creado_por, nombre, notas, basado_en)
  values (v_uid, v_nombre, v_orig.notas, v_orig.id)
  returning id into v_id;

  insert into repertorio_musicos (repertorio_id, musico_id)
  select v_id, m.musico_id from repertorio_musicos m where m.repertorio_id = v_orig.id
  on conflict do nothing;
  insert into repertorio_musicos (repertorio_id, musico_id)
  values (v_id, v_uid)
  on conflict do nothing;

  insert into repertorio_canciones (repertorio_id, cancion_id, orden, a_preparar, notas)
  select v_id, c.cancion_id, c.orden, c.a_preparar, c.notas
  from repertorio_canciones c where c.repertorio_id = v_orig.id;

  return v_id;
end;
$$;

revoke all on function public.duplicar_repertorio(uuid, text) from public, anon;
grant execute on function public.duplicar_repertorio(uuid, text) to authenticated;
