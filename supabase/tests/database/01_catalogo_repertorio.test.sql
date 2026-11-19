-- Catalog (normalization, resolve-or-create RPC, write lockdown) and repertoire RLS.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(21);

-- Helpers: act as a seeded user / as anonymous, always starting from the owner role.
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

-- ─── normalizar_texto ───────────────────────────────────────────────────────
select is(public.normalizar_texto('Ódiame Más (En Vivo)'), 'odiame mas', 'strips accents, case and parenthetical groups');
select is(public.normalizar_texto('Hey Jude - Remastered 2015'), 'hey jude', 'drops a trailing " - suffix"');
select is(public.normalizar_texto('  Sweet Child O'' Mine [Live]  '), 'sweet child o mine', 'collapses punctuation and brackets');
select is(public.normalizar_texto('Ñandú!!'), 'nandu', 'handles ñ and punctuation');

-- ─── obtener_o_crear_cancion ────────────────────────────────────────────────
select pg_temp.login('11111111-1111-1111-1111-111111111111');

create temp table _ids (k text primary key, id uuid);
grant all on _ids to public;
insert into _ids select 'base', public.obtener_o_crear_cancion('Canción de Prueba', 'Artista de Prueba');
insert into _ids select 'acentos', public.obtener_o_crear_cancion('CANCION DE PRUEBA', 'artista de prueba');
insert into _ids select 'parentesis', public.obtener_o_crear_cancion('Canción de Prueba (En vivo)', 'Artista de Prueba');
insert into _ids select 'sufijo', public.obtener_o_crear_cancion('Cancion de Prueba - Remastered 2011', 'Artista  de  Prueba');
insert into _ids select 'otra', public.obtener_o_crear_cancion('Otra Cancion de Prueba', 'Artista de Prueba');

select isnt((select id from _ids where k = 'base'), null, 'creates a new song and returns its id');
select is((select id from _ids where k = 'acentos'), (select id from _ids where k = 'base'), 'accent / case variants resolve to the same id');
select is((select id from _ids where k = 'parentesis'), (select id from _ids where k = 'base'), 'parenthetical variants resolve to the same id');
select is((select id from _ids where k = 'sufijo'), (select id from _ids where k = 'base'), 'dash-suffix variants resolve to the same id');
select isnt((select id from _ids where k = 'otra'), (select id from _ids where k = 'base'), 'a different title is a different song');
select is((select count(*)::int from public.canciones where artista = 'Artista de Prueba'), 2, 'only two catalog rows were created');

select throws_ok($$select public.obtener_o_crear_cancion('   ', 'X')$$, '22023', 'Invalid title', 'rejects a blank title');

select pg_temp.anon();
select throws_ok(
  $$select public.obtener_o_crear_cancion('Anon Song', 'Anon')$$, '42501', null,
  'anonymous users cannot execute the RPC'
);
select is((select count(*)::int from public.canciones where titulo = 'Canción de Prueba'), 1, 'anonymous users can read the catalog');

select pg_temp.login('11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$insert into public.canciones (titulo, artista) values ('Directa', 'Cliente')$$, '42501', null,
  'clients cannot insert into canciones directly'
);
select throws_ok(
  $$update public.canciones set titulo = 'Hack' where artista = 'Artista de Prueba'$$, '42501', null,
  'clients cannot update canciones directly'
);

-- ─── musico_canciones RLS ───────────────────────────────────────────────────
insert into public.musico_canciones (musico_id, cancion_id)
select '11111111-1111-1111-1111-111111111111', id from _ids where k = 'base';
select is(
  (select count(*)::int from public.musico_canciones where cancion_id = (select id from _ids where k = 'base')),
  1, 'a musician can add a song to their own repertoire'
);

select throws_ok(
  $$insert into public.musico_canciones (musico_id, cancion_id)
    select '22222222-2222-2222-2222-222222222222', id from _ids where k = 'otra'$$,
  '42501', null, 'a musician cannot write another musician''s repertoire'
);

select pg_temp.login('22222222-2222-2222-2222-222222222222');
update public.musico_canciones set tonalidad = 'C' where cancion_id = (select id from _ids where k = 'base');
delete from public.musico_canciones where cancion_id = (select id from _ids where k = 'base');
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select is(
  (select count(*)::int from public.musico_canciones
   where cancion_id = (select id from _ids where k = 'base') and tonalidad is null),
  1, 'another musician''s update and delete touched nothing'
);

-- Public read depends on the owner having a slug.
select pg_temp.anon();
select is(
  (select count(*)::int from public.musico_canciones where cancion_id = (select id from _ids where k = 'base')),
  1, 'anonymous read works when the owner has a slug'
);
reset role;
update public.profiles set slug = null where id = '11111111-1111-1111-1111-111111111111';
select pg_temp.anon();
select is(
  (select count(*)::int from public.musico_canciones where cancion_id = (select id from _ids where k = 'base')),
  0, 'anonymous read is hidden when the owner has no slug'
);
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select is(
  (select count(*)::int from public.musico_canciones where cancion_id = (select id from _ids where k = 'base')),
  1, 'the owner still reads their own repertoire without a slug'
);

select * from finish();
rollback;
