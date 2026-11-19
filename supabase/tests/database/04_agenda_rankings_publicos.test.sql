-- Public agenda and community rankings (anonymous callers).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(25);

create function pg_temp.anon() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
end $$;
grant execute on function pg_temp.anon() to public;

-- Clean slate (rolled back at the end): no seeded shows interfere with the counts.
delete from public.shows;

-- Ana (ana-gomez) and Bruno (bruno-paz) have a public profile; the admin has no slug; Caro is unused.
insert into public.canciones (id, titulo, artista) values
  ('c0000000-0000-0000-0000-0000000000d1', 'Show Rk X', 'Banda Rk'),
  ('c0000000-0000-0000-0000-0000000000d2', 'Show Rk Y', 'Banda Rk'),
  ('c0000000-0000-0000-0000-0000000000d3', 'Show Rk Z', 'Banda Rk');

-- Agenda fixtures
insert into public.shows (id, creado_por, nombre, fecha, lugar, ciudad, zona, estado, visibilidad, invitados) values
  ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Agenda publico', public.hoy_rioplatense() + 5, 'Cafe Test', 'Montevideo', 'Centro', 'programado', 'publico', 'Fulano'),
  ('d0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Agenda privado', public.hoy_rioplatense() + 5, 'Casa', 'Montevideo', 'Zona Oculta', 'programado', 'privado', null),
  ('d0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Agenda cancelado', public.hoy_rioplatense() + 5, 'Bar', 'Montevideo', 'Centro', 'cancelado', 'publico', null),
  ('d0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Agenda pasado', public.hoy_rioplatense() - 3, 'Bar', 'Montevideo', 'Centro', 'programado', 'publico', null);
insert into public.show_musicos (show_id, musico_id, estado, invitado_por)
select s.id, u.musico_id, u.estado, '11111111-1111-1111-1111-111111111111'
from public.shows s
cross join (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'aceptado'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'pendiente'),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'rechazado'),
  ('99999999-9999-9999-9999-999999999999'::uuid, 'aceptado')
) as u(musico_id, estado);
insert into public.show_cobros (show_id, musico_id, importe)
values ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 7777);

select pg_temp.anon();

select is(
  (select array_agg(id)::text from public.agenda_publica()),
  '{d0000000-0000-0000-0000-000000000001}',
  'agenda lists only the public, scheduled, upcoming show'
);
select is(
  (select jsonb_array_length(musicos) from public.agenda_publica(p_show_id => 'd0000000-0000-0000-0000-000000000001')),
  1, 'agenda lineup omits pending, declined and slug-less musicians'
);
select is(
  (select musicos -> 0 ->> 'slug' from public.agenda_publica(p_show_id => 'd0000000-0000-0000-0000-000000000001')),
  'ana-gomez', 'agenda lineup keeps the accepted musician with a public profile'
);
select is(
  (select (row_to_json(a)::text ~* '(importe|7777|cobro)')::text from public.agenda_publica() a),
  'false', 'agenda never returns fee data'
);
select is((select invitados from public.agenda_publica()), 'Fulano', 'free-text guests are part of the public lineup');
select is((select count(*)::int from public.agenda_publica(p_show_id => 'd0000000-0000-0000-0000-000000000002')), 0, 'a private show has no detail row');
select is((select count(*)::int from public.agenda_publica(p_show_id => 'd0000000-0000-0000-0000-000000000003')), 0, 'a cancelled show has no detail row');
select is((select count(*)::int from public.agenda_publica(p_show_id => 'd0000000-0000-0000-0000-000000000004')), 0, 'a past show has no detail row');
select is((select count(*)::int from public.agenda_publica(p_musico_slug => 'bruno-paz')), 0, 'filtering by a musician with a pending invitation returns nothing');
select is((select count(*)::int from public.agenda_publica(p_musico_slug => 'ana-gomez')), 1, 'filtering by an accepted musician returns the show');
select is((select count(*)::int from public.agenda_publica(p_ciudad => 'MONTEVIDEO')), 1, 'the city filter ignores case');
select is((select count(*)::int from public.agenda_publica(p_ciudad => 'Salto')), 0, 'the city filter excludes other cities');
select is(
  (select array_agg(zona)::text from public.agenda_publica_lugares()),
  '{Centro}', 'the agenda filters list only zones of public upcoming shows'
);

-- Ranking fixtures (as owner)
reset role;
delete from public.shows;
insert into public.shows (id, creado_por, nombre, fecha, lugar, ciudad, zona, estado, visibilidad, canciones_confirmadas_en) values
  ('d1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Rk 1', public.hoy_rioplatense() - 10, 'Café Vinilo', 'CABA', 'Palermo', 'realizado', 'publico', now()),
  ('d1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Rk 2', public.hoy_rioplatense() - 9, 'CAFE VINILO', 'CABA', 'Palermo', 'realizado', 'publico', now()),
  ('d1000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Rk 3 privado', public.hoy_rioplatense() - 8, 'Casa Privada', 'Rosario', 'Zona Privada', 'realizado', 'privado', now()),
  ('d1000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Rk 4 sin confirmar', public.hoy_rioplatense() - 7, null, 'CABA', 'Palermo', 'realizado', 'publico', null);
insert into public.show_musicos (show_id, musico_id, estado, invitado_por) values
  ('d1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aceptado', null),
  ('d1000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'aceptado', null),
  ('d1000000-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999', 'aceptado', null),
  ('d1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'aceptado', null),
  ('d1000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'pendiente', null),
  ('d1000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'aceptado', null),
  ('d1000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'aceptado', null),
  ('d1000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'aceptado', null);
insert into public.show_canciones_tocadas (show_id, cancion_id, orden) values
  ('d1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000d1', 0),
  ('d1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000d2', 1),
  ('d1000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-0000000000d1', 0),
  ('d1000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-0000000000d1', 0),
  ('d1000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-0000000000d3', 0);

select pg_temp.anon();

select results_eq(
  $$select nombre, shows from public.ranking_musicos('historico')$$,
  $$values ('Ana Gómez'::text, 4), ('Bruno Paz'::text, 2)$$,
  'musicians: accepted realizado shows only, slug-less and pending excluded, private shows counted globally'
);
select results_eq(
  $$select titulo, veces from public.ranking_canciones('historico')$$,
  $$values ('Show Rk X'::text, 3), ('Show Rk Y'::text, 1)$$,
  'songs: counted once per show however many musicians, unconfirmed shows excluded'
);
select results_eq(
  $$select lugar, shows from public.ranking_lugares('historico')$$,
  $$values ('CAFE VINILO'::text, 2)$$,
  'venues: one venue across spellings, once per show, private shows excluded'
);
select results_eq(
  $$select zona, shows from public.ranking_zonas()$$,
  $$values ('Palermo'::text, 3)$$,
  'zones: only zones with public realizado shows are offered'
);

-- Privacy: a zone/city filter counts public shows only.
select is((select count(*)::int from public.ranking_musicos('historico', null, 'Zona Privada')), 0, 'a private-only zone filter reveals no musicians');
select is((select count(*)::int from public.ranking_musicos('historico', 'Rosario', null)), 0, 'a private-only city filter reveals no musicians');
select is((select count(*)::int from public.ranking_canciones('historico', null, 'Zona Privada')), 0, 'a private-only zone filter reveals no songs');
select is((select count(*)::int from public.ranking_lugares('historico', null, 'Zona Privada')), 0, 'a private-only zone filter reveals no venues');
select results_eq(
  $$select nombre, shows from public.ranking_musicos('historico', null, 'palermo')$$,
  $$values ('Ana Gómez'::text, 3), ('Bruno Paz'::text, 1)$$,
  'a public zone filter counts public shows only'
);
select results_eq(
  $$select titulo, veces from public.ranking_canciones('historico', 'caba', null)$$,
  $$values ('Show Rk X'::text, 2), ('Show Rk Y'::text, 1)$$,
  'the songs ranking with a city filter counts public shows only'
);
select throws_ok($$select * from public.ranking_musicos('semana')$$, '22023', null, 'an invalid period is rejected');
select throws_ok($$select * from public.hoy_rioplatense()$$, '42501', null, 'internal helpers are not callable by anon');

select * from finish();
rollback;
