-- Shared shows: invitations, edit permissions, additive saves, private fees, played songs.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(32);

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

insert into public.canciones (id, titulo, artista) values
  ('c0000000-0000-0000-0000-0000000000b1', 'Show Tema Uno', 'Banda Show'),
  ('c0000000-0000-0000-0000-0000000000b2', 'Show Tema Dos', 'Banda Show');

-- Ana creates a show inviting Bruno and Caro, with her own fee.
select pg_temp.login('11111111-1111-1111-1111-111111111111');
insert into _ctx select 'show', public.guardar_show(
  null,
  '{"nombre":"Show de prueba","fecha":"2030-01-10"}'::jsonb,
  array['22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333']::uuid[],
  '{"importe":1500,"moneda":"UYU"}'::jsonb
);

select is(
  (select estado from public.show_musicos where show_id = (select id from _ctx where k = 'show') and musico_id = '11111111-1111-1111-1111-111111111111'),
  'aceptado', 'the creator is auto-accepted'
);
select is(
  (select array_agg(estado order by musico_id)::text from public.show_musicos
    where show_id = (select id from _ctx where k = 'show') and musico_id <> '11111111-1111-1111-1111-111111111111'),
  '{pendiente,pendiente}', 'invitees start as pendiente'
);
select is(
  (select visibilidad || '/' || estado from public.shows where id = (select id from _ctx where k = 'show')),
  'privado/programado', 'new shows default to private and scheduled'
);

-- A pending invitee cannot edit or confirm songs.
select pg_temp.login('22222222-2222-2222-2222-222222222222');
select throws_ok(
  format($$select public.guardar_show(%L, '{"nombre":"Hack","fecha":"2030-01-10"}'::jsonb, '{}'::uuid[])$$, (select id from _ctx where k = 'show')),
  '42501', null, 'a pending invitee cannot edit the show'
);
select throws_ok(
  format($$select public.confirmar_canciones_tocadas(%L, array['c0000000-0000-0000-0000-0000000000b1']::uuid[])$$, (select id from _ctx where k = 'show')),
  '42501', null, 'a pending invitee cannot confirm songs'
);
select is((select count(*)::int from public.shows where id = (select id from _ctx where k = 'show')), 1, 'a pending invitee can read the show they were invited to');

-- Bruno accepts; Caro declines.
select lives_ok(format($$select public.responder_invitacion(%L, true)$$, (select id from _ctx where k = 'show')), 'Bruno accepts');
select pg_temp.login('33333333-3333-3333-3333-333333333333');
select lives_ok(format($$select public.responder_invitacion(%L, false)$$, (select id from _ctx where k = 'show')), 'Caro declines from pendiente');
select throws_ok(
  format($$select public.responder_invitacion(%L, false)$$, (select id from _ctx where k = 'show')),
  'P0002', null, 'declining again (not pendiente) is refused'
);
select throws_ok(
  format($$select public.guardar_show(%L, '{"nombre":"Hack","fecha":"2030-01-10"}'::jsonb, '{}'::uuid[])$$, (select id from _ctx where k = 'show')),
  '42501', null, 'a declined invitee cannot edit the show'
);
select lives_ok(
  format($$select public.responder_invitacion(%L, true)$$, (select id from _ctx where k = 'show')),
  'a declined invitee can re-accept'
);
select throws_ok(
  format($$select public.responder_invitacion(%L, false)$$, (select id from _ctx where k = 'show')),
  'P0002', null, 'an accepted participant cannot decline (they must leave)'
);

-- A stranger cannot answer an invitation they never got.
select pg_temp.login('99999999-9999-9999-9999-999999999999');
select throws_ok(
  format($$select public.responder_invitacion(%L, true)$$, (select id from _ctx where k = 'show')),
  'P0002', null, 'a non-invited user cannot accept'
);
select is((select count(*)::int from public.shows where id = (select id from _ctx where k = 'show')), 0, 'a non-participant sees no shows');

-- guardar_show: additive saves and p_quitar.
-- Bruno (accepted) invites the admin; Ana then saves from a STALE form that does not list the admin.
select pg_temp.login('22222222-2222-2222-2222-222222222222');
select lives_ok(
  format($$select public.guardar_show(%L, '{"nombre":"Show de prueba","fecha":"2030-01-10"}'::jsonb,
            array['22222222-2222-2222-2222-222222222222','99999999-9999-9999-9999-999999999999']::uuid[])$$,
         (select id from _ctx where k = 'show')),
  'an accepted participant can invite others'
);
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select public.guardar_show(
  (select id from _ctx where k = 'show'), '{"nombre":"Show de prueba","fecha":"2030-01-10"}'::jsonb,
  array['11111111-1111-1111-1111-111111111111']::uuid[]
);
select is(
  (select count(*)::int from public.show_musicos where show_id = (select id from _ctx where k = 'show') and musico_id = '99999999-9999-9999-9999-999999999999'),
  1, 'a stale save does not remove a newer invitee'
);
select is(
  (select count(*)::int from public.show_musicos where show_id = (select id from _ctx where k = 'show')), 4,
  'a stale save keeps the whole lineup'
);

-- Bruno saves his own fee; Ana cannot read it.
select pg_temp.login('22222222-2222-2222-2222-222222222222');
select public.guardar_show(
  (select id from _ctx where k = 'show'), '{"nombre":"Show de prueba","fecha":"2030-01-10"}'::jsonb,
  '{}'::uuid[], '{"importe":900,"moneda":"USD"}'::jsonb
);
select is((select importe::text from public.show_cobros where show_id = (select id from _ctx where k = 'show')), '900.00', 'Bruno sees only his own fee');
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select is((select importe::text from public.show_cobros where show_id = (select id from _ctx where k = 'show')), '1500.00', 'Ana sees only her own fee, not Bruno''s');
select throws_ok(
  format($$insert into public.show_cobros (show_id, musico_id, importe) values (%L, '22222222-2222-2222-2222-222222222222', 1)$$, (select id from _ctx where k = 'show')),
  '42501', null, 'a fee cannot be written for someone else'
);

-- Only the creator removes people.
select pg_temp.login('22222222-2222-2222-2222-222222222222');
select throws_ok(
  format($$select public.guardar_show(%L, '{"nombre":"Show de prueba","fecha":"2030-01-10"}'::jsonb, '{}'::uuid[], null,
           array['99999999-9999-9999-9999-999999999999']::uuid[])$$, (select id from _ctx where k = 'show')),
  '42501', null, 'p_quitar by a non-creator is refused'
);
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select public.guardar_show(
  (select id from _ctx where k = 'show'), '{"nombre":"Show de prueba","fecha":"2030-01-10"}'::jsonb,
  '{}'::uuid[], null, array['22222222-2222-2222-2222-222222222222']::uuid[]
);
reset role;
select is(
  (select count(*)::int from public.show_musicos where show_id = (select id from _ctx where k = 'show') and musico_id = '22222222-2222-2222-2222-222222222222'),
  0, 'the creator can remove a musician'
);
select is(
  (select count(*)::int from public.show_cobros where show_id = (select id from _ctx where k = 'show') and musico_id = '22222222-2222-2222-2222-222222222222'),
  0, 'removing a musician also deletes their fee'
);

-- salir_de_show
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select throws_ok(format($$select public.salir_de_show(%L)$$, (select id from _ctx where k = 'show')), '42501', null, 'the creator cannot leave');
select pg_temp.login('33333333-3333-3333-3333-333333333333');
select public.guardar_show(
  (select id from _ctx where k = 'show'), '{"nombre":"Show de prueba","fecha":"2030-01-10"}'::jsonb,
  '{}'::uuid[], '{"importe":50}'::jsonb
);
select lives_ok(format($$select public.salir_de_show(%L)$$, (select id from _ctx where k = 'show')), 'a participant can leave');
reset role;
select is(
  (select count(*)::int from public.show_cobros where show_id = (select id from _ctx where k = 'show') and musico_id = '33333333-3333-3333-3333-333333333333'),
  0, 'leaving removes the leaver''s fee'
);

-- confirmar_canciones_tocadas
select pg_temp.login('11111111-1111-1111-1111-111111111111');
select public.confirmar_canciones_tocadas(
  (select id from _ctx where k = 'show'),
  array['c0000000-0000-0000-0000-0000000000b2','c0000000-0000-0000-0000-0000000000b1','c0000000-0000-0000-0000-0000000000b2']::uuid[]
);
select is(
  (select estado || '/' || (canciones_confirmadas_en is not null)::text from public.shows where id = (select id from _ctx where k = 'show')),
  'realizado/true', 'confirming moves the show to realizado and stamps the confirmation'
);
select is(
  (select array_agg(cancion_id order by orden)::text from public.show_canciones_tocadas where show_id = (select id from _ctx where k = 'show')),
  '{c0000000-0000-0000-0000-0000000000b2,c0000000-0000-0000-0000-0000000000b1}', 'played songs keep the given order, deduplicated'
);

-- Anonymous access
select pg_temp.anon();
select throws_ok($$select * from public.shows$$, '42501', null, 'anon cannot select shows');
select throws_ok($$select * from public.show_cobros$$, '42501', null, 'anon cannot select show_cobros');
select throws_ok($$select * from public.show_musicos$$, '42501', null, 'anon cannot select show_musicos');
select throws_ok($$select * from public.show_canciones_tocadas$$, '42501', null, 'anon cannot select show_canciones_tocadas');

select * from finish();
rollback;
