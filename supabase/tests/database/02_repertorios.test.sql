-- Setlists: atomic save, duplicate, delete and read access.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(15);

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;
create function pg_temp.anon() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
end $$;
grant execute on function pg_temp.login(uuid), pg_temp.anon() to public;

create temp table _ctx (k text primary key, id uuid);
grant all on _ctx to public;

-- Fixture: two catalog songs.
insert into public.canciones (id, titulo, artista) values
  ('c0000000-0000-0000-0000-0000000000a1', 'Tema Uno Test', 'Banda Test'),
  ('c0000000-0000-0000-0000-0000000000a2', 'Tema Dos Test', 'Banda Test');

-- ─── guardar_repertorio ─────────────────────────────────────────────────────
select pg_temp.login('11111111-1111-1111-1111-111111111111');
insert into _ctx
select 'rep', public.guardar_repertorio(
  null, 'Set de prueba', null, array['22222222-2222-2222-2222-222222222222']::uuid[],
  '[{"cancion_id":"c0000000-0000-0000-0000-0000000000a2","orden":5},
    {"cancion_id":"c0000000-0000-0000-0000-0000000000a1","orden":1,"a_preparar":true}]'::jsonb
);

select is(
  (select array_agg(cancion_id order by orden)::text from public.repertorio_canciones where repertorio_id = (select id from _ctx where k = 'rep')),
  '{c0000000-0000-0000-0000-0000000000a1,c0000000-0000-0000-0000-0000000000a2}',
  'create stores the songs ordered by the given orden'
);
select is(
  (select array_agg(orden order by orden)::text from public.repertorio_canciones where repertorio_id = (select id from _ctx where k = 'rep')),
  '{0,1}', 'orden is stored contiguously from 0'
);
select is(
  (select count(*)::int from public.repertorio_musicos where repertorio_id = (select id from _ctx where k = 'rep')
     and musico_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')),
  2, 'the lineup holds the creator and the given musician'
);

-- A lineup member can edit.
select pg_temp.login('22222222-2222-2222-2222-222222222222');
select lives_ok(
  format($$select public.guardar_repertorio(%L, 'Set renombrado', null, array['22222222-2222-2222-2222-222222222222']::uuid[], '[{"cancion_id":"c0000000-0000-0000-0000-0000000000a1","orden":0}]'::jsonb)$$,
         (select id from _ctx where k = 'rep')),
  'a lineup member can update the setlist'
);
select is((select nombre from public.repertorios where id = (select id from _ctx where k = 'rep')), 'Set renombrado', 'the update applied');
select is(
  (select count(*)::int from public.repertorio_musicos where repertorio_id = (select id from _ctx where k = 'rep') and musico_id = '11111111-1111-1111-1111-111111111111'),
  1, 'the creator always stays in the lineup'
);

-- A non-member cannot.
select pg_temp.login('33333333-3333-3333-3333-333333333333');
select throws_ok(
  format($$select public.guardar_repertorio(%L, 'Hack', null, '{}'::uuid[], '[]'::jsonb)$$, (select id from _ctx where k = 'rep')),
  '42501', null, 'a non-member cannot edit the setlist'
);
select throws_ok(
  $$select public.guardar_repertorio(null, 'Mal', null, '{}'::uuid[], '[{"cancion_id":"c0000000-0000-0000-0000-0000000000ff"}]'::jsonb)$$,
  '23503', null, 'unknown catalog songs are rejected'
);

-- ─── duplicar_repertorio ────────────────────────────────────────────────────
insert into _ctx select 'copia', public.duplicar_repertorio((select id from _ctx where k = 'rep'));
select is((select basado_en from public.repertorios where id = (select id from _ctx where k = 'copia')), (select id from _ctx where k = 'rep'), 'duplicate sets basado_en');
select is((select creado_por from public.repertorios where id = (select id from _ctx where k = 'copia')), '33333333-3333-3333-3333-333333333333'::uuid, 'the copy belongs to the caller');
select is((select count(*)::int from public.repertorio_canciones where repertorio_id = (select id from _ctx where k = 'copia')), 1, 'the copy keeps the songs');

-- ─── delete: creator only ───────────────────────────────────────────────────
select pg_temp.login('22222222-2222-2222-2222-222222222222');
delete from public.repertorios where id = (select id from _ctx where k = 'rep');
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select is((select count(*)::int from public.repertorios where id = (select id from _ctx where k = 'rep')), 1, 'a lineup member cannot delete the setlist');
delete from public.repertorios where id = (select id from _ctx where k = 'rep');
select is((select count(*)::int from public.repertorios where id = (select id from _ctx where k = 'rep')), 0, 'the creator can delete it');

-- ─── anonymous ──────────────────────────────────────────────────────────────
select pg_temp.anon();
select throws_ok($$select * from public.repertorios$$, '42501', null, 'anonymous users cannot select setlists');
select throws_ok($$select public.duplicar_repertorio('b0000000-0000-0000-0000-000000000001')$$, '42501', null, 'anonymous users cannot duplicate');

select * from finish();
rollback;
