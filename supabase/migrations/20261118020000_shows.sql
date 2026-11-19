-- Shared shows.
-- A show is loaded ONCE and shared by its participants (linked profiles). It replaces
-- the old per-musician `toques`, which are migrated at the end of this file.
--
-- Rules:
--  * Participation requires confirmation: adding a musician creates a 'pendiente'
--    invitation. The creator is auto-accepted. Only accepted participants count (agenda,
--    stats, rankings, public listing: later stages build on `es_participante_show`).
--  * Accepted participants edit the shared data and invite others. Only the creator
--    deletes the show or removes other participants; a participant can leave.
--  * Fees live in their own table with owner-only RLS and are never joined into shared
--    or public reads.
--  * Guests without an account are free text (`invitados`) and count for nothing.
-- Idempotent: can be applied with `supabase db push` or pasted in the SQL Editor.

-- ─── Tables ─────────────────────────────────────────────────────────────────
create table if not exists public.shows (
  id                          uuid primary key default gen_random_uuid(),
  creado_por                  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre                      text not null check (char_length(btrim(nombre)) between 1 and 120),
  fecha                       date not null,
  hora                        time,
  lugar                       text check (lugar is null or char_length(lugar) <= 120),
  ciudad                      text check (ciudad is null or char_length(ciudad) <= 80),
  -- Neighbourhood / area, used by the zone filters of the public listing and rankings.
  zona                        text check (zona is null or char_length(zona) <= 80),
  estado                      text not null default 'programado' check (estado in ('programado', 'realizado', 'cancelado')),
  visibilidad                 text not null default 'privado' check (visibilidad in ('publico', 'privado')),
  -- Price / how to book, shown on the public listing.
  entrada_info                text check (entrada_info is null or char_length(entrada_info) <= 300),
  entrada_url                 text check (entrada_url is null or (char_length(entrada_url) <= 300 and entrada_url ~* '^https?://')),
  repertorio_id               uuid references public.repertorios (id) on delete set null,
  -- Free-text guests without an account.
  invitados                   text check (invitados is null or char_length(invitados) <= 200),
  notas                       text check (notas is null or char_length(notas) <= 1000),
  -- Set when the songs actually played were confirmed (rankings count only those).
  canciones_confirmadas_en    timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists shows_fecha_idx on public.shows (fecha desc);
create index if not exists shows_creado_por_idx on public.shows (creado_por);
create index if not exists shows_repertorio_idx on public.shows (repertorio_id);
create index if not exists shows_publicos_idx on public.shows (fecha) where visibilidad = 'publico';

drop trigger if exists shows_set_updated_at on public.shows;
create trigger shows_set_updated_at
  before update on public.shows
  for each row execute function public.set_updated_at();

create table if not exists public.show_musicos (
  show_id        uuid not null references public.shows (id) on delete cascade,
  musico_id      uuid not null references auth.users (id) on delete cascade,
  estado         text not null default 'pendiente' check (estado in ('pendiente', 'aceptado', 'rechazado')),
  invitado_por   uuid references auth.users (id) on delete set null,
  respondido_en  timestamptz,
  primary key (show_id, musico_id)
);

create index if not exists show_musicos_musico_idx on public.show_musicos (musico_id, estado);

-- Private fee of ONE musician for ONE show. Never exposed to the others.
create table if not exists public.show_cobros (
  show_id        uuid not null references public.shows (id) on delete cascade,
  musico_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  importe        numeric(12, 2) not null check (importe >= 0),
  moneda         text not null default 'UYU' check (moneda in ('ARS', 'UYU', 'USD')),
  estado_cobro   text not null default 'pendiente' check (estado_cobro in ('pendiente', 'cobrado')),
  cobrado_en     date,
  notas          text check (notas is null or char_length(notas) <= 500),
  primary key (show_id, musico_id),
  constraint show_cobros_cobrado_en_check check (estado_cobro = 'cobrado' or cobrado_en is null)
);

create index if not exists show_cobros_musico_idx on public.show_cobros (musico_id);

-- Songs actually played (catalog ids), confirmed after the show.
create table if not exists public.show_canciones_tocadas (
  show_id     uuid not null references public.shows (id) on delete cascade,
  cancion_id  uuid not null references public.canciones (id) on delete restrict,
  orden       integer not null check (orden >= 0),
  primary key (show_id, cancion_id)
);

create index if not exists show_canciones_tocadas_cancion_idx on public.show_canciones_tocadas (cancion_id);

-- ─── Helper ─────────────────────────────────────────────────────────────────
-- Is the current user a participant of the show, in one of the given states?
-- SECURITY DEFINER so policies on other tables can use it without recursing into RLS.
create or replace function public.es_participante_show(
  p_show_id uuid,
  p_estados text[] default array['aceptado']
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from show_musicos m
    where m.show_id = p_show_id
      and m.musico_id = auth.uid()
      and m.estado = any (p_estados)
  );
$$;

revoke all on function public.es_participante_show(uuid, text[]) from public, anon;
grant execute on function public.es_participante_show(uuid, text[]) to authenticated;

-- ─── Access ─────────────────────────────────────────────────────────────────
-- Anonymous visitors get nothing (the public listing comes later, through a view
-- without fees). Writes to shows / lineup / played songs go through the RPCs below;
-- the only direct write is DELETE on shows, creator only. Fees are the one table
-- with direct DML, strictly owner-only.
alter table public.shows enable row level security;
alter table public.show_musicos enable row level security;
alter table public.show_cobros enable row level security;
alter table public.show_canciones_tocadas enable row level security;

-- Any participant (any state, so invitees can see what they were invited to).
drop policy if exists "shows_select_participante" on public.shows;
create policy "shows_select_participante"
  on public.shows for select to authenticated
  using (public.es_participante_show(id, array['pendiente', 'aceptado', 'rechazado']));

drop policy if exists "shows_delete_creador" on public.shows;
create policy "shows_delete_creador"
  on public.shows for delete to authenticated
  using (creado_por = auth.uid());

drop policy if exists "show_musicos_select_participante" on public.show_musicos;
create policy "show_musicos_select_participante"
  on public.show_musicos for select to authenticated
  using (public.es_participante_show(show_id, array['pendiente', 'aceptado', 'rechazado']));

drop policy if exists "show_canciones_tocadas_select_participante" on public.show_canciones_tocadas;
create policy "show_canciones_tocadas_select_participante"
  on public.show_canciones_tocadas for select to authenticated
  using (public.es_participante_show(show_id, array['pendiente', 'aceptado', 'rechazado']));

-- Fees: only mine, and only for shows where I am an accepted participant.
drop policy if exists "show_cobros_select_own" on public.show_cobros;
create policy "show_cobros_select_own"
  on public.show_cobros for select to authenticated
  using (musico_id = auth.uid());

drop policy if exists "show_cobros_insert_own" on public.show_cobros;
create policy "show_cobros_insert_own"
  on public.show_cobros for insert to authenticated
  with check (musico_id = auth.uid() and public.es_participante_show(show_id));

drop policy if exists "show_cobros_update_own" on public.show_cobros;
create policy "show_cobros_update_own"
  on public.show_cobros for update to authenticated
  using (musico_id = auth.uid())
  with check (musico_id = auth.uid() and public.es_participante_show(show_id));

drop policy if exists "show_cobros_delete_own" on public.show_cobros;
create policy "show_cobros_delete_own"
  on public.show_cobros for delete to authenticated
  using (musico_id = auth.uid());

revoke all on public.shows, public.show_musicos, public.show_cobros, public.show_canciones_tocadas
  from public, anon, authenticated;
grant select on public.shows, public.show_musicos, public.show_canciones_tocadas to authenticated;
grant delete on public.shows to authenticated;
grant select, insert, update, delete on public.show_cobros to authenticated;

-- ─── Atomic save ────────────────────────────────────────────────────────────
-- p_datos: jsonb object {nombre, fecha, hora, lugar, ciudad, zona, estado, visibilidad,
--   entrada_info, entrada_url, repertorio_id, invitados, notas}. On update the document
--   is replaced as a whole, except `estado` / `visibilidad`, which keep their value when
--   absent.
-- p_musicos: the full lineup (the creator is always kept). New musicians become
--   'pendiente'; existing ones keep their state. Dropping someone is creator-only.
-- p_cobro: {importe, moneda, estado_cobro, cobrado_en, notas}: the CALLER's own fee.
--   A null/empty `importe` removes it. Omit (null) to leave it untouched.
create or replace function public.guardar_show(
  p_id uuid,
  p_datos jsonb,
  p_musicos uuid[],
  p_cobro jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_id       uuid;
  v_creador  uuid;
  v_nombre   text;
  v_fecha    date;
  v_hora     time;
  v_rep      uuid;
  v_lugar    text;
  v_ciudad   text;
  v_zona     text;
  v_estado   text;
  v_visib    text;
  v_ent_info text;
  v_ent_url  text;
  v_invit    text;
  v_notas    text;
  v_lineup   uuid[];
  v_cob_est  text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then
    raise exception 'Show data must be a JSON object' using errcode = '22023';
  end if;

  v_nombre := btrim(coalesce(p_datos ->> 'nombre', ''));
  if char_length(v_nombre) not between 1 and 120 then
    raise exception 'Invalid name' using errcode = '22023';
  end if;
  v_fecha := nullif(btrim(coalesce(p_datos ->> 'fecha', '')), '')::date;
  if v_fecha is null then
    raise exception 'Date is required' using errcode = '22023';
  end if;
  v_hora     := nullif(btrim(coalesce(p_datos ->> 'hora', '')), '')::time;
  v_rep      := nullif(btrim(coalesce(p_datos ->> 'repertorio_id', '')), '')::uuid;
  v_lugar    := nullif(btrim(coalesce(p_datos ->> 'lugar', '')), '');
  v_ciudad   := nullif(btrim(coalesce(p_datos ->> 'ciudad', '')), '');
  v_zona     := nullif(btrim(coalesce(p_datos ->> 'zona', '')), '');
  v_estado   := nullif(btrim(coalesce(p_datos ->> 'estado', '')), '');
  v_visib    := nullif(btrim(coalesce(p_datos ->> 'visibilidad', '')), '');
  v_ent_info := nullif(btrim(coalesce(p_datos ->> 'entrada_info', '')), '');
  v_ent_url  := nullif(btrim(coalesce(p_datos ->> 'entrada_url', '')), '');
  v_invit    := nullif(btrim(coalesce(p_datos ->> 'invitados', '')), '');
  v_notas    := nullif(btrim(coalesce(p_datos ->> 'notas', '')), '');

  if v_rep is not null and not exists (select 1 from repertorios r where r.id = v_rep) then
    raise exception 'Setlist not found' using errcode = '23503';
  end if;
  if coalesce(array_length(p_musicos, 1), 0) > 12 then
    raise exception 'Too many musicians' using errcode = '22023';
  end if;

  if p_id is null then
    insert into shows (
      creado_por, nombre, fecha, hora, lugar, ciudad, zona, estado, visibilidad,
      entrada_info, entrada_url, repertorio_id, invitados, notas
    ) values (
      v_uid, v_nombre, v_fecha, v_hora, v_lugar, v_ciudad, v_zona,
      coalesce(v_estado, 'programado'), coalesce(v_visib, 'privado'),
      v_ent_info, v_ent_url, v_rep, v_invit, v_notas
    )
    returning id, creado_por into v_id, v_creador;

    insert into show_musicos (show_id, musico_id, estado, invitado_por, respondido_en)
    values (v_id, v_uid, 'aceptado', v_uid, now());
  else
    select s.creado_por into v_creador from shows s where s.id = p_id for update;
    if not found then
      raise exception 'Show not found' using errcode = 'P0002';
    end if;
    if not es_participante_show(p_id) then
      raise exception 'Not allowed to edit this show' using errcode = '42501';
    end if;
    v_id := p_id;

    update shows set
      nombre = v_nombre, fecha = v_fecha, hora = v_hora, lugar = v_lugar, ciudad = v_ciudad,
      zona = v_zona, estado = coalesce(v_estado, estado), visibilidad = coalesce(v_visib, visibilidad),
      entrada_info = v_ent_info, entrada_url = v_ent_url, repertorio_id = v_rep,
      invitados = v_invit, notas = v_notas
    where id = v_id;
  end if;

  -- Requested lineup: real accounts only, de-duplicated, creator always included.
  select coalesce(array_agg(distinct u.id), '{}') into v_lineup
  from auth.users u
  where u.id = any (coalesce(p_musicos, '{}') || v_creador);

  if exists (select 1 from show_musicos m where m.show_id = v_id and m.musico_id <> all (v_lineup)) then
    if v_uid <> v_creador then
      raise exception 'Only the creator can remove musicians' using errcode = '42501';
    end if;
    delete from show_cobros c where c.show_id = v_id and c.musico_id <> all (v_lineup);
    delete from show_musicos m where m.show_id = v_id and m.musico_id <> all (v_lineup);
  end if;

  insert into show_musicos (show_id, musico_id, estado, invitado_por)
  select v_id, x, 'pendiente', v_uid from unnest(v_lineup) as x
  on conflict (show_id, musico_id) do nothing;

  -- The caller's own private fee.
  if p_cobro is not null and jsonb_typeof(p_cobro) = 'object' then
    if nullif(btrim(coalesce(p_cobro ->> 'importe', '')), '') is null then
      delete from show_cobros c where c.show_id = v_id and c.musico_id = v_uid;
    else
      v_cob_est := coalesce(nullif(btrim(coalesce(p_cobro ->> 'estado_cobro', '')), ''), 'pendiente');
      insert into show_cobros (show_id, musico_id, importe, moneda, estado_cobro, cobrado_en, notas)
      values (
        v_id, v_uid,
        (p_cobro ->> 'importe')::numeric,
        coalesce(nullif(btrim(coalesce(p_cobro ->> 'moneda', '')), ''), 'UYU'),
        v_cob_est,
        case when v_cob_est = 'cobrado'
             then coalesce(nullif(btrim(coalesce(p_cobro ->> 'cobrado_en', '')), '')::date, current_date)
             else null end,
        nullif(btrim(coalesce(p_cobro ->> 'notas', '')), '')
      )
      on conflict (show_id, musico_id) do update set
        importe = excluded.importe,
        moneda = excluded.moneda,
        estado_cobro = excluded.estado_cobro,
        cobrado_en = excluded.cobrado_en,
        notas = excluded.notas;
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.guardar_show(uuid, jsonb, uuid[], jsonb) from public, anon;
grant execute on function public.guardar_show(uuid, jsonb, uuid[], jsonb) to authenticated;

-- ─── Invitations ────────────────────────────────────────────────────────────
-- Accept (from pending or a previous decline) or decline (only a pending invitation).
create or replace function public.responder_invitacion(p_show_id uuid, p_aceptar boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_n   integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_aceptar is null then
    raise exception 'Answer required' using errcode = '22023';
  end if;

  update show_musicos
     set estado = case when p_aceptar then 'aceptado' else 'rechazado' end,
         respondido_en = now()
   where show_id = p_show_id
     and musico_id = v_uid
     and estado = any (case when p_aceptar then array['pendiente', 'rechazado'] else array['pendiente'] end);
  get diagnostics v_n = row_count;

  if v_n = 0 then
    raise exception 'No invitation to answer' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.responder_invitacion(uuid, boolean) from public, anon;
grant execute on function public.responder_invitacion(uuid, boolean) to authenticated;

-- A participant (not the creator) leaves: their participation and fee are removed.
create or replace function public.salir_de_show(p_show_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_n   integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from shows s where s.id = p_show_id and s.creado_por = v_uid) then
    raise exception 'The creator cannot leave the show; delete it instead' using errcode = '42501';
  end if;

  delete from show_cobros where show_id = p_show_id and musico_id = v_uid;
  delete from show_musicos where show_id = p_show_id and musico_id = v_uid;
  get diagnostics v_n = row_count;

  if v_n = 0 then
    raise exception 'You are not part of this show' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.salir_de_show(uuid) from public, anon;
grant execute on function public.salir_de_show(uuid) to authenticated;

-- ─── Played songs ───────────────────────────────────────────────────────────
-- Replaces the played songs with the given catalog ids (in order), stamps the
-- confirmation and moves a 'programado' show to 'realizado'.
create or replace function public.confirmar_canciones_tocadas(p_show_id uuid, p_cancion_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_ids   uuid[];
  v_falta integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if coalesce(array_length(p_cancion_ids, 1), 0) > 300 then
    raise exception 'Too many songs' using errcode = '22023';
  end if;

  perform 1 from shows s where s.id = p_show_id for update;
  if not found then
    raise exception 'Show not found' using errcode = 'P0002';
  end if;
  if not es_participante_show(p_show_id) then
    raise exception 'Only accepted participants can confirm the songs' using errcode = '42501';
  end if;

  -- First occurrence of each song wins; array position gives the order.
  select coalesce(array_agg(x.id order by x.pos), '{}') into v_ids
  from (
    select distinct on (e.id) e.id, e.pos
    from unnest(coalesce(p_cancion_ids, '{}')) with ordinality as e(id, pos)
    order by e.id, e.pos
  ) x;

  select count(*) into v_falta
  from unnest(v_ids) as k(id)
  where not exists (select 1 from canciones c where c.id = k.id);
  if v_falta > 0 then
    raise exception 'Unknown catalog song' using errcode = '23503';
  end if;

  delete from show_canciones_tocadas where show_id = p_show_id;
  insert into show_canciones_tocadas (show_id, cancion_id, orden)
  select p_show_id, k.id, k.pos - 1 from unnest(v_ids) with ordinality as k(id, pos);

  update shows
     set canciones_confirmadas_en = now(),
         estado = case when estado = 'programado' then 'realizado' else estado end
   where id = p_show_id;
end;
$$;

revoke all on function public.confirmar_canciones_tocadas(uuid, uuid[]) from public, anon;
grant execute on function public.confirmar_canciones_tocadas(uuid, uuid[]) to authenticated;

-- ─── Migrate the old per-musician `toques` ──────────────────────────────────
-- No data loss: every toque becomes a show with the SAME id, its owner is the creator
-- (auto-accepted). Guarded, so it is a no-op on a fresh database or a re-run.
-- Assumptions (documented on purpose):
--  * Past toques (fecha < today) become 'realizado', the rest 'programado'. All are private.
--  * `paga` becomes the owner's private fee. A past toque is assumed already paid
--    ('cobrado', cobrado_en = the show date); a future one is 'pendiente'.
--  * A toque with a setlist gets a new standalone setlist (name = show name + date, lineup =
--    the owner), pointing at the CATALOG songs behind the old `musico_canciones` rows, in the
--    same order. For past toques the same songs also become the confirmed played songs.
do $$
begin
  if to_regclass('public.toques') is null then
    return;
  end if;

  insert into shows (id, creado_por, nombre, fecha, hora, lugar, ciudad, estado, visibilidad,
                     invitados, notas, created_at)
  select t.id, t.musico_id,
         left(coalesce(nullif(btrim(t.formato), ''), nullif(btrim(t.lugar), ''), 'Toque'), 120),
         t.fecha, t.hora, t.lugar, t.ciudad,
         case when t.fecha < current_date then 'realizado' else 'programado' end,
         'privado', t.con_quien, t.notas, t.created_at
  from toques t
  where exists (select 1 from auth.users u where u.id = t.musico_id)
  on conflict (id) do nothing;

  insert into show_musicos (show_id, musico_id, estado, invitado_por, respondido_en)
  select t.id, t.musico_id, 'aceptado', t.musico_id, t.created_at
  from toques t
  where exists (select 1 from shows s where s.id = t.id)
  on conflict do nothing;

  insert into show_cobros (show_id, musico_id, importe, moneda, estado_cobro, cobrado_en)
  select t.id, t.musico_id, t.paga, t.moneda,
         case when t.fecha < current_date then 'cobrado' else 'pendiente' end,
         case when t.fecha < current_date then t.fecha else null end
  from toques t
  where t.paga is not null
    and exists (select 1 from shows s where s.id = t.id)
  on conflict do nothing;

  -- Setlists → standalone setlists on catalog songs.
  drop table if exists pg_temp._toque_rep;
  create temp table _toque_rep on commit drop as
  select t.id as toque_id, gen_random_uuid() as repertorio_id
  from toques t
  where exists (select 1 from shows s where s.id = t.id)
    and exists (select 1 from toque_canciones tc where tc.toque_id = t.id);

  insert into repertorios (id, creado_por, nombre, created_at)
  select r.repertorio_id, s.creado_por,
         left(s.nombre, 100) || ' · ' || to_char(s.fecha, 'DD/MM/YYYY'),
         s.created_at
  from _toque_rep r
  join shows s on s.id = r.toque_id;

  insert into repertorio_musicos (repertorio_id, musico_id)
  select r.repertorio_id, s.creado_por
  from _toque_rep r
  join shows s on s.id = r.toque_id;

  insert into repertorio_canciones (repertorio_id, cancion_id, orden)
  select r.repertorio_id, u.cancion_id, row_number() over (partition by r.repertorio_id order by u.orden, u.cancion_id) - 1
  from _toque_rep r
  join (
    select distinct on (tc.toque_id, mc.cancion_id) tc.toque_id, mc.cancion_id, tc.orden
    from toque_canciones tc
    join musico_canciones mc on mc.id = tc.cancion_id
    order by tc.toque_id, mc.cancion_id, tc.orden
  ) u on u.toque_id = r.toque_id;

  update shows s set repertorio_id = r.repertorio_id
  from _toque_rep r
  where r.toque_id = s.id;

  insert into show_canciones_tocadas (show_id, cancion_id, orden)
  select r.toque_id, c.cancion_id, c.orden
  from _toque_rep r
  join shows s on s.id = r.toque_id and s.fecha < current_date
  join repertorio_canciones c on c.repertorio_id = r.repertorio_id;

  update shows s set canciones_confirmadas_en = now()
  where s.fecha < current_date
    and exists (select 1 from show_canciones_tocadas k where k.show_id = s.id);
end
$$;

drop table if exists public.toque_canciones;
drop table if exists public.toques;
