-- Public agenda ("Música en vivo") and community rankings.
--
-- Anonymous visitors cannot read `shows`, `show_musicos`, `show_cobros` or
-- `show_canciones_tocadas` (RLS + no grants). Everything public goes through the SECURITY DEFINER
-- functions below, which return ONLY the columns listed here. Fees (`show_cobros`), notes and
-- creator ids are never selected.
--
-- Rules:
--  * Only ACCEPTED participants count or appear, and only those with a public profile (slug).
--  * Agenda: visibilidad = 'publico', estado = 'programado', fecha >= today. Private and
--    cancelled shows never appear. `invitados` (free-text guests) is part of the public lineup
--    text, so it is exposed on public shows only.
--  * Rankings use estado = 'realizado' only. A shared show counts once per musician and once as
--    an event; a song played in a show counts once no matter how many musicians were there.
--  * Musicians and songs rankings include PRIVATE realizado shows (they are activity and only
--    aggregates leave the database: no names, places or dates of private shows). The venues
--    ranking counts PUBLIC shows only, so a private wedding venue is never exposed.
--  * Songs only count when the played songs were confirmed (canciones_confirmadas_en is set).
--  * "Today" is the Rio de la Plata date (UTC-3, Argentina and Uruguay), not the UTC date, so
--    a show tonight does not vanish from the listing after 21:00 local time.
-- Idempotent: can be applied with `supabase db push` or pasted in the SQL Editor.

-- ─── Helpers (internal) ─────────────────────────────────────────────────────
create or replace function public.hoy_rioplatense()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date;
$$;

-- Date bounds of a ranking period ('mes' | 'anio' | 'historico'); NULL means unbounded.
create or replace function public.rango_periodo_ranking(p_periodo text)
returns table (desde date, hasta date)
language plpgsql
stable
as $$
declare
  v_hoy date := public.hoy_rioplatense();
begin
  case p_periodo
    when 'mes' then
      return query select date_trunc('month', v_hoy)::date,
                          (date_trunc('month', v_hoy) + interval '1 month - 1 day')::date;
    when 'anio' then
      return query select date_trunc('year', v_hoy)::date,
                          (date_trunc('year', v_hoy) + interval '1 year - 1 day')::date;
    when 'historico' then
      return query select null::date, null::date;
    else
      raise exception 'Invalid period: %', p_periodo using errcode = '22023';
  end case;
end;
$$;

revoke all on function public.hoy_rioplatense() from public, anon, authenticated;
revoke all on function public.rango_periodo_ranking(text) from public, anon, authenticated;

-- ─── Public agenda ──────────────────────────────────────────────────────────
-- p_desde / p_hasta: optional date window (p_desde can never go before today).
-- p_ciudad / p_zona: optional, accent- and case-insensitive.
-- p_musico_slug: only shows where that (public) musician is an accepted participant.
-- p_show_id: a single show (the detail page; a private or past show simply returns no row).
create or replace function public.agenda_publica(
  p_desde date default null,
  p_hasta date default null,
  p_ciudad text default null,
  p_zona text default null,
  p_musico_slug text default null,
  p_show_id uuid default null
)
returns table (
  id            uuid,
  nombre        text,
  fecha         date,
  hora          time,
  lugar         text,
  ciudad        text,
  zona          text,
  entrada_info  text,
  entrada_url   text,
  invitados     text,
  musicos       jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.nombre, s.fecha, s.hora, s.lugar, s.ciudad, s.zona,
         s.entrada_info, s.entrada_url, s.invitados,
         coalesce((
           select jsonb_agg(
                    jsonb_build_object('nombre', p.nombre, 'slug', p.slug, 'instrumentos', to_jsonb(p.instrumentos))
                    order by p.nombre, p.slug
                  )
           from public.show_musicos m
           join public.profiles p on p.id = m.musico_id
           where m.show_id = s.id and m.estado = 'aceptado' and p.slug is not null
         ), '[]'::jsonb) as musicos
  from public.shows s
  where s.visibilidad = 'publico'
    and s.estado = 'programado'
    and s.fecha >= greatest(coalesce(p_desde, public.hoy_rioplatense()), public.hoy_rioplatense())
    and (p_hasta is null or s.fecha <= p_hasta)
    and (nullif(btrim(p_ciudad), '') is null
         or public.normalizar_texto(s.ciudad) = public.normalizar_texto(btrim(p_ciudad)))
    and (nullif(btrim(p_zona), '') is null
         or public.normalizar_texto(s.zona) = public.normalizar_texto(btrim(p_zona)))
    and (p_show_id is null or s.id = p_show_id)
    and (p_musico_slug is null or exists (
          select 1
          from public.show_musicos m2
          join public.profiles p2 on p2.id = m2.musico_id
          where m2.show_id = s.id and m2.estado = 'aceptado' and p2.slug = p_musico_slug
        ))
  order by s.fecha, s.hora nulls last, s.nombre, s.id
  limit 200;
$$;

-- Cities / zones that have at least one upcoming public show (for the filters).
create or replace function public.agenda_publica_lugares()
returns table (ciudad text, zona text, shows integer)
language sql
stable
security definer
set search_path = public
as $$
  select s.ciudad, s.zona, count(*)::integer
  from public.shows s
  where s.visibilidad = 'publico'
    and s.estado = 'programado'
    and s.fecha >= public.hoy_rioplatense()
    and (s.ciudad is not null or s.zona is not null)
  group by s.ciudad, s.zona
  order by s.ciudad nulls last, s.zona nulls last;
$$;

-- ─── Rankings ───────────────────────────────────────────────────────────────
-- Common arguments: p_periodo 'mes' | 'anio' | 'historico', optional p_ciudad / p_zona
-- (accent- and case-insensitive). Top 20, ties broken alphabetically so the order is stable.

-- Realizado shows per musician (accepted participants with a public profile; private shows count).
create or replace function public.ranking_musicos(
  p_periodo text default 'historico',
  p_ciudad text default null,
  p_zona text default null
)
returns table (nombre text, slug text, shows integer)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_desde date;
  v_hasta date;
begin
  select r.desde, r.hasta into v_desde, v_hasta from public.rango_periodo_ranking(p_periodo) r;

  return query
  select p.nombre, p.slug, count(distinct s.id)::integer as total
  from public.shows s
  join public.show_musicos m on m.show_id = s.id and m.estado = 'aceptado'
  join public.profiles p on p.id = m.musico_id and p.slug is not null
  where s.estado = 'realizado'
    and (v_desde is null or s.fecha >= v_desde)
    and (v_hasta is null or s.fecha <= v_hasta)
    and (nullif(btrim(p_ciudad), '') is null
         or public.normalizar_texto(s.ciudad) = public.normalizar_texto(btrim(p_ciudad)))
    and (nullif(btrim(p_zona), '') is null
         or public.normalizar_texto(s.zona) = public.normalizar_texto(btrim(p_zona)))
  group by p.id, p.nombre, p.slug
  order by total desc, p.nombre, p.slug
  limit 20;
end;
$$;

-- Distinct realizado shows (with confirmed songs) where each catalog song was played.
create or replace function public.ranking_canciones(
  p_periodo text default 'historico',
  p_ciudad text default null,
  p_zona text default null
)
returns table (titulo text, artista text, veces integer)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_desde date;
  v_hasta date;
begin
  select r.desde, r.hasta into v_desde, v_hasta from public.rango_periodo_ranking(p_periodo) r;

  return query
  select c.titulo, c.artista, count(distinct s.id)::integer as total
  from public.shows s
  join public.show_canciones_tocadas t on t.show_id = s.id
  join public.canciones c on c.id = t.cancion_id
  where s.estado = 'realizado'
    and s.canciones_confirmadas_en is not null
    and (v_desde is null or s.fecha >= v_desde)
    and (v_hasta is null or s.fecha <= v_hasta)
    and (nullif(btrim(p_ciudad), '') is null
         or public.normalizar_texto(s.ciudad) = public.normalizar_texto(btrim(p_ciudad)))
    and (nullif(btrim(p_zona), '') is null
         or public.normalizar_texto(s.zona) = public.normalizar_texto(btrim(p_zona)))
  group by c.id, c.titulo, c.artista
  order by total desc, c.titulo, c.artista
  limit 20;
end;
$$;

-- Venues: PUBLIC realizado shows only, each show counted once per venue. The venue identity
-- is normalized (lugar + ciudad) like `claveLugar` on the client, so "Café Vinilo" and
-- "CAFE VINILO" are one place; the label is the spelling of its most recent show.
create or replace function public.ranking_lugares(
  p_periodo text default 'historico',
  p_ciudad text default null,
  p_zona text default null
)
returns table (lugar text, ciudad text, shows integer)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_desde date;
  v_hasta date;
begin
  select r.desde, r.hasta into v_desde, v_hasta from public.rango_periodo_ranking(p_periodo) r;

  return query
  select (array_agg(s.lugar order by s.fecha desc, s.id))[1],
         (array_agg(s.ciudad order by s.fecha desc, s.id))[1],
         count(distinct s.id)::integer as total
  from public.shows s
  where s.estado = 'realizado'
    and s.visibilidad = 'publico'
    and public.normalizar_texto(coalesce(s.lugar, '')) <> ''
    and (v_desde is null or s.fecha >= v_desde)
    and (v_hasta is null or s.fecha <= v_hasta)
    and (nullif(btrim(p_ciudad), '') is null
         or public.normalizar_texto(s.ciudad) = public.normalizar_texto(btrim(p_ciudad)))
    and (nullif(btrim(p_zona), '') is null
         or public.normalizar_texto(s.zona) = public.normalizar_texto(btrim(p_zona)))
  group by public.normalizar_texto(s.lugar), public.normalizar_texto(coalesce(s.ciudad, ''))
  order by total desc, 1, 2
  limit 20;
end;
$$;

-- Cities / zones with at least one realizado show (for the ranking filters).
create or replace function public.ranking_zonas()
returns table (ciudad text, zona text, shows integer)
language sql
stable
security definer
set search_path = public
as $$
  -- Only zones with PUBLIC realizado shows are offered as filters: listing a zone that
  -- only has private shows would reveal where (and, by filtering, who) played privately.
  select s.ciudad, s.zona, count(*)::integer
  from public.shows s
  where s.estado = 'realizado'
    and s.visibilidad = 'publico'
    and (s.ciudad is not null or s.zona is not null)
  group by s.ciudad, s.zona
  order by s.ciudad nulls last, s.zona nulls last;
$$;

-- ─── Access ─────────────────────────────────────────────────────────────────
revoke all on function public.agenda_publica(date, date, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.agenda_publica_lugares() from public, anon, authenticated;
revoke all on function public.ranking_musicos(text, text, text) from public, anon, authenticated;
revoke all on function public.ranking_canciones(text, text, text) from public, anon, authenticated;
revoke all on function public.ranking_lugares(text, text, text) from public, anon, authenticated;
revoke all on function public.ranking_zonas() from public, anon, authenticated;

grant execute on function public.agenda_publica(date, date, text, text, text, uuid) to anon, authenticated;
grant execute on function public.agenda_publica_lugares() to anon, authenticated;
grant execute on function public.ranking_musicos(text, text, text) to anon, authenticated;
grant execute on function public.ranking_canciones(text, text, text) to anon, authenticated;
grant execute on function public.ranking_lugares(text, text, text) to anon, authenticated;
grant execute on function public.ranking_zonas() to anon, authenticated;
