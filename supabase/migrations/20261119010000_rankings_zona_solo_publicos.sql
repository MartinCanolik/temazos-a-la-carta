-- Privacy fix for the community rankings.
-- ranking_musicos / ranking_canciones count PRIVATE realizado shows as anonymous aggregates,
-- but a caller-supplied zone/city filter could isolate a zone that only has private shows and
-- so reveal who played (or what was played) privately there. Rule: when p_ciudad or p_zona is
-- provided, count PUBLIC shows only. Unfiltered (global) rankings keep counting private shows.
-- Idempotent: can be applied with `supabase db push` or pasted in the SQL Editor.

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
  v_filtrado boolean := nullif(btrim(p_ciudad), '') is not null or nullif(btrim(p_zona), '') is not null;
begin
  select r.desde, r.hasta into v_desde, v_hasta from public.rango_periodo_ranking(p_periodo) r;

  return query
  select p.nombre, p.slug, count(distinct s.id)::integer as total
  from public.shows s
  join public.show_musicos m on m.show_id = s.id and m.estado = 'aceptado'
  join public.profiles p on p.id = m.musico_id and p.slug is not null
  where s.estado = 'realizado'
    and (not v_filtrado or s.visibilidad = 'publico')
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
  v_filtrado boolean := nullif(btrim(p_ciudad), '') is not null or nullif(btrim(p_zona), '') is not null;
begin
  select r.desde, r.hasta into v_desde, v_hasta from public.rango_periodo_ranking(p_periodo) r;

  return query
  select c.titulo, c.artista, count(distinct s.id)::integer as total
  from public.shows s
  join public.show_canciones_tocadas t on t.show_id = s.id
  join public.canciones c on c.id = t.cancion_id
  where s.estado = 'realizado'
    and s.canciones_confirmadas_en is not null
    and (not v_filtrado or s.visibilidad = 'publico')
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

-- Keep the grants (create or replace preserves them, restated for clarity).
revoke all on function public.ranking_musicos(text, text, text) from public, anon, authenticated;
revoke all on function public.ranking_canciones(text, text, text) from public, anon, authenticated;
grant execute on function public.ranking_musicos(text, text, text) to anon, authenticated;
grant execute on function public.ranking_canciones(text, text, text) to anon, authenticated;
