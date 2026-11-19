-- mis_repertorios and repertorios_de_formacion (server-side setlist queries).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(7);

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

-- Fixture: 7 setlists made by Bruno with Caro in the lineup, oldest first, plus one by Ana alone.
delete from public.repertorios;
insert into public.repertorios (id, creado_por, nombre, updated_at)
select ('e0000000-0000-0000-0000-00000000000' || g)::uuid, '22222222-2222-2222-2222-222222222222', 'Set ' || g,
       now() - (10 - g) * interval '1 day'
from generate_series(1, 7) g;
insert into public.repertorio_musicos (repertorio_id, musico_id)
select ('e0000000-0000-0000-0000-00000000000' || g)::uuid, m
from generate_series(1, 7) g,
     unnest(array['22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333']::uuid[]) m;
insert into public.repertorios (id, creado_por, nombre) values ('e0000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'Solo Ana');
insert into public.repertorio_musicos values ('e0000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111');

select pg_temp.login('33333333-3333-3333-3333-333333333333');
select is((select count(*)::int from public.mis_repertorios()), 7, 'mis_repertorios returns the setlists where I am in the lineup (and not others)');

select pg_temp.login('11111111-1111-1111-1111-111111111111');
select is((select array_agg(nombre)::text from public.mis_repertorios()), '{"Solo Ana"}', 'mis_repertorios includes the ones I created');

select is(
  (select count(*)::int from public.repertorios_de_formacion(array['33333333-3333-3333-3333-333333333333']::uuid[])),
  5, 'the lineup history is limited to 5 by default'
);
select is(
  -- WITH ORDINALITY pins the row order the function emits, instead of relying on the outer query.
  (select r.nombre
     from public.repertorios_de_formacion(array['33333333-3333-3333-3333-333333333333']::uuid[])
       with ordinality as r
    order by r.ordinality
    limit 1),
  'Set 7', 'the most recent setlist comes first'
);
select is(
  (select count(*)::int from public.repertorios_de_formacion(
     array['33333333-3333-3333-3333-333333333333']::uuid[], 'e0000000-0000-0000-0000-000000000007'::uuid)
   where id = 'e0000000-0000-0000-0000-000000000007'),
  0, 'the excluded setlist is left out'
);
select is(
  (select count(*)::int from public.repertorios_de_formacion(
     array['11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333']::uuid[], null, 50)),
  8, 'any of the given musicians matches, up to the requested limit'
);

select pg_temp.anon();
select throws_ok($$select * from public.mis_repertorios()$$, '42501', null, 'anonymous users cannot call mis_repertorios');

select * from finish();
rollback;
