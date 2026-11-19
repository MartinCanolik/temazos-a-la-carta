-- Local development seed (runs on `supabase start` / `supabase db reset`).
--
-- Test accounts (magic-link login, no passwords):
--   ana@temazos.test    musician  (slug: ana-gomez)
--   bruno@temazos.test  musician  (slug: bruno-paz)
--   caro@temazos.test   musician  (slug: caro-ledesma)
--   admin@temazos.test  admin
--
-- How to log in locally:
--   1. Open http://localhost:5173/login and request a magic link for one of the emails above.
--   2. Open the email in the local mail UI at http://localhost:54324 and click the link.

-- Users (the handle_new_user trigger creates the matching profiles rows)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'ana@temazos.test',   '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'bruno@temazos.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'caro@temazos.test',  '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '99999999-9999-9999-9999-999999999999', 'authenticated', 'authenticated', 'admin@temazos.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
       now(), now(), now()
from auth.users u
where u.email like '%@temazos.test';

-- Profiles
update public.profiles set nombre = 'Ana Gómez', slug = 'ana-gomez', instrumentos = '{voz,guitarra}',
  ciudad = 'Montevideo', bio = 'Cantante y guitarrista. Toco en bares y eventos con repertorio de rock nacional y pop.',
  whatsapp = '+59899111222', instagram = 'anagomez.music'
where id = '11111111-1111-1111-1111-111111111111';

update public.profiles set nombre = 'Bruno Paz', slug = 'bruno-paz', instrumentos = '{bajo,coros}',
  ciudad = 'Buenos Aires', bio = 'Bajista de sesión y de banda de covers. Disponible para fechas y ensayos.',
  whatsapp = '+5491155550101', instagram = 'brunopaz.bajo'
where id = '22222222-2222-2222-2222-222222222222';

update public.profiles set nombre = 'Caro Ledesma', slug = 'caro-ledesma', instrumentos = '{teclados,voz}',
  ciudad = 'Rosario', bio = 'Pianista y cantante. Formato dúo, trío o banda completa.',
  whatsapp = '+5493415550202', instagram = 'caroledesma'
where id = '33333333-3333-3333-3333-333333333333';

update public.profiles set nombre = 'Admin Temazos', role = 'admin'
where id = '99999999-9999-9999-9999-999999999999';

-- Song catalog (shared across musicians; direct inserts are fine here, the seed runs as superuser)
insert into public.canciones (titulo, artista) values
  ('De Música Ligera', 'Soda Stereo'),
  ('Persiana Americana', 'Soda Stereo'),
  ('Color Esperanza', 'Diego Torres'),
  ('Lamento Boliviano', 'Enanitos Verdes'),
  ('Hotel California', 'Eagles'),
  ('Stand By Me', 'Ben E. King'),
  ('Rolling in the Deep', 'Adele'),
  ('Cuando Pase el Temblor', 'Soda Stereo'),
  ('Zombie', 'The Cranberries'),
  ('Another One Bites the Dust', 'Queen'),
  ('Billie Jean', 'Michael Jackson'),
  ('Los Ojos de Mi Mamá', 'Los Auténticos Decadentes'),
  ('Ji Ji Ji', 'Patricio Rey y sus Redonditos de Ricota'),
  ('Sweet Child O'' Mine', 'Guns N'' Roses'),
  ('Imagine', 'John Lennon'),
  ('Someone Like You', 'Adele'),
  ('Let It Be', 'The Beatles'),
  ('Bohemian Rhapsody', 'Queen');

-- Repertoire (several songs overlap between musicians on purpose)
insert into public.musico_canciones (musico_id, cancion_id, tonalidad, version, notas, instrumento)
select v.musico_id::uuid, c.id, v.tonalidad, v.version, v.notas, v.instrumento
from (values
  ('11111111-1111-1111-1111-111111111111', 'De Música Ligera', 'Soda Stereo', 'Am', 'Original', 'Intro larga con guitarra limpia', 'voz'),
  ('11111111-1111-1111-1111-111111111111', 'Persiana Americana', 'Soda Stereo', 'E', 'Original', null, 'guitarra'),
  ('11111111-1111-1111-1111-111111111111', 'Color Esperanza', 'Diego Torres', 'C', 'Acústica', 'Versión voz y guitarra', 'voz y guitarra'),
  ('11111111-1111-1111-1111-111111111111', 'Lamento Boliviano', 'Enanitos Verdes', 'Dm', 'Original', null, null),
  ('11111111-1111-1111-1111-111111111111', 'Hotel California', 'Eagles', 'Bm', 'Acústica', 'Solo final doble', null),
  ('11111111-1111-1111-1111-111111111111', 'Stand By Me', 'Ben E. King', 'A', 'Dúo', null, null),
  ('11111111-1111-1111-1111-111111111111', 'Rolling in the Deep', 'Adele', 'Cm', 'Original', 'Medio tono abajo', null),
  ('11111111-1111-1111-1111-111111111111', 'Cuando Pase el Temblor', 'Soda Stereo', 'A', 'Original', null, null),
  ('11111111-1111-1111-1111-111111111111', 'Zombie', 'The Cranberries', 'Em', 'Original', null, null),
  ('22222222-2222-2222-2222-222222222222', 'De Música Ligera', 'Soda Stereo', 'Am', 'Original', 'Línea de bajo con púa', 'bajo'),
  ('22222222-2222-2222-2222-222222222222', 'Persiana Americana', 'Soda Stereo', 'E', 'Original', null, null),
  ('22222222-2222-2222-2222-222222222222', 'Lamento Boliviano', 'Enanitos Verdes', 'Dm', 'Original', null, null),
  ('22222222-2222-2222-2222-222222222222', 'Hotel California', 'Eagles', 'Bm', 'Original', null, null),
  ('22222222-2222-2222-2222-222222222222', 'Another One Bites the Dust', 'Queen', 'Em', 'Original', 'Riff icónico', null),
  ('22222222-2222-2222-2222-222222222222', 'Billie Jean', 'Michael Jackson', 'F#m', 'Original', null, 'bajo'),
  ('22222222-2222-2222-2222-222222222222', 'Los Ojos de Mi Mamá', 'Los Auténticos Decadentes', 'G', null, null, null),
  ('22222222-2222-2222-2222-222222222222', 'Ji Ji Ji', 'Patricio Rey y sus Redonditos de Ricota', 'D', 'Original', null, null),
  ('22222222-2222-2222-2222-222222222222', 'Sweet Child O'' Mine', 'Guns N'' Roses', 'D', 'Original', null, null),
  ('22222222-2222-2222-2222-222222222222', 'Stand By Me', 'Ben E. King', 'A', 'Original', 'Clásico de bajo', 'coros'),
  ('33333333-3333-3333-3333-333333333333', 'De Música Ligera', 'Soda Stereo', 'Am', 'Piano y voz', null, null),
  ('33333333-3333-3333-3333-333333333333', 'Rolling in the Deep', 'Adele', 'Cm', 'Original', null, null),
  ('33333333-3333-3333-3333-333333333333', 'Stand By Me', 'Ben E. King', 'A', 'Dúo', 'Armonías a dos voces', 'voz'),
  ('33333333-3333-3333-3333-333333333333', 'Imagine', 'John Lennon', 'C', 'Piano y voz', null, 'teclados'),
  ('33333333-3333-3333-3333-333333333333', 'Someone Like You', 'Adele', 'A', 'Piano y voz', null, 'piano'),
  ('33333333-3333-3333-3333-333333333333', 'Let It Be', 'The Beatles', 'C', 'Original', null, null),
  ('33333333-3333-3333-3333-333333333333', 'Color Esperanza', 'Diego Torres', 'C', 'Original', null, null),
  ('33333333-3333-3333-3333-333333333333', 'Bohemian Rhapsody', 'Queen', 'Bb', 'Reducida', 'Sin la parte de ópera', null),
  ('33333333-3333-3333-3333-333333333333', 'Hotel California', 'Eagles', 'Bm', 'Piano', null, null)
) as v(musico_id, titulo, artista, tonalidad, version, notas, instrumento)
join public.canciones c on c.titulo = v.titulo and c.artista = v.artista;

-- Gigs
insert into public.toques (id, musico_id, fecha, hora, lugar, ciudad, formato, paga, moneda, con_quien, notas) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', current_date - 30, '21:30', 'Bar La Cigale', 'Montevideo', 'Dúo', 3500, 'UYU', 'Bruno Paz', 'Dos sets de 45 minutos'),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', current_date - 7, '22:00', 'Casamiento Fernández', 'Montevideo', 'Banda', 12000, 'UYU', 'Bruno Paz, Caro Ledesma', null),
  ('a0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', current_date - 14, '23:00', 'Niceto Club', 'Buenos Aires', 'Banda', 45000, 'ARS', 'Los Covers', 'Prueba de sonido a las 20'),
  ('a0000000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', current_date + 10, '20:30', 'Cervecería Antares', 'Buenos Aires', 'Trío', 30000, 'ARS', null, 'Próxima fecha'),
  ('a0000000-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', current_date - 3, '19:00', 'Hotel Plaza', 'Rosario', 'Piano y voz', 80, 'USD', null, 'Evento corporativo'),
  ('a0000000-0000-0000-0000-000000000006', '33333333-3333-3333-3333-333333333333', current_date - 60, null, 'Café del Parque', 'Rosario', 'Dúo', null, 'ARS', 'Ana Gómez', 'Sin cachet, a la gorra');

-- Setlists (reference each musician's own repertoire by title)
insert into public.toque_canciones (toque_id, cancion_id, orden)
select s.toque_id::uuid, c.id, s.orden
from (values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'De Música Ligera', 0),
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Color Esperanza', 1),
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Stand By Me', 2),
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Hotel California', 3),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Lamento Boliviano', 0),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Persiana Americana', 1),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Rolling in the Deep', 2),
  ('a0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Another One Bites the Dust', 0),
  ('a0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Billie Jean', 1),
  ('a0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'De Música Ligera', 2),
  ('a0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Ji Ji Ji', 3),
  ('a0000000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'Sweet Child O'' Mine', 0),
  ('a0000000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'Lamento Boliviano', 1),
  ('a0000000-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', 'Imagine', 0),
  ('a0000000-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', 'Someone Like You', 1),
  ('a0000000-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', 'Let It Be', 2),
  ('a0000000-0000-0000-0000-000000000006', '33333333-3333-3333-3333-333333333333', 'Stand By Me', 0),
  ('a0000000-0000-0000-0000-000000000006', '33333333-3333-3333-3333-333333333333', 'Color Esperanza', 1)
) as s(toque_id, musico_id, titulo, orden)
join public.canciones k on k.titulo = s.titulo
join public.musico_canciones c
  on c.musico_id = s.musico_id::uuid and c.cancion_id = k.id;

-- Fail loudly if a title typo silently dropped setlist rows.
do $$
declare n integer;
begin
  select count(*) into n from public.toque_canciones;
  if n <> 18 then
    raise exception 'Seed error: expected 18 setlist rows, got %', n;
  end if;
end
$$;

-- Standalone setlists built for a lineup (history for "últimos repertorios")
insert into public.repertorios (id, creado_por, nombre, notas, basado_en, created_at, updated_at) values
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Dúo Ana y Bruno · bares', 'Dos sets de 45 minutos.', null, now() - interval '12 days', now() - interval '5 days'),
  ('b0000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'Casamiento Fernández · trío', 'Entrada, cena y baile.', null, now() - interval '9 days', now() - interval '2 days'),
  ('b0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Rock clásico', null, null, now() - interval '70 days', now() - interval '60 days');

insert into public.repertorio_musicos (repertorio_id, musico_id) values
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),
  ('b0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222'),
  ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111'),
  ('b0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222'),
  ('b0000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333'),
  ('b0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111'),
  ('b0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222');

insert into public.repertorio_canciones (repertorio_id, cancion_id, orden, a_preparar, notas)
select s.repertorio_id::uuid, k.id, s.orden, s.a_preparar, s.notas
from (values
  ('b0000000-0000-0000-0000-000000000001', 'De Música Ligera', 0, false, null),
  ('b0000000-0000-0000-0000-000000000001', 'Persiana Americana', 1, false, null),
  ('b0000000-0000-0000-0000-000000000001', 'Lamento Boliviano', 2, false, null),
  ('b0000000-0000-0000-0000-000000000001', 'Hotel California', 3, false, 'Cierre del primer set'),
  ('b0000000-0000-0000-0000-000000000001', 'Zombie', 4, true, 'Bruno todavía no la sacó'),
  ('b0000000-0000-0000-0000-000000000002', 'Stand By Me', 0, false, null),
  ('b0000000-0000-0000-0000-000000000002', 'Rolling in the Deep', 1, false, null),
  ('b0000000-0000-0000-0000-000000000002', 'De Música Ligera', 2, false, null),
  ('b0000000-0000-0000-0000-000000000002', 'Hotel California', 3, true, 'Ensayar el solo final'),
  ('b0000000-0000-0000-0000-000000000002', 'Let It Be', 4, false, null),
  ('b0000000-0000-0000-0000-000000000002', 'Imagine', 5, true, null),
  ('b0000000-0000-0000-0000-000000000003', 'Another One Bites the Dust', 0, false, null),
  ('b0000000-0000-0000-0000-000000000003', 'Billie Jean', 1, false, null),
  ('b0000000-0000-0000-0000-000000000003', 'Sweet Child O'' Mine', 2, true, null),
  ('b0000000-0000-0000-0000-000000000003', 'Ji Ji Ji', 3, false, null)
) as s(repertorio_id, titulo, orden, a_preparar, notas)
join public.canciones k on k.titulo = s.titulo;

-- Fail loudly if a title typo silently dropped setlist rows.
do $$
declare n integer;
begin
  select count(*) into n from public.repertorio_canciones;
  if n <> 15 then
    raise exception 'Seed error: expected 15 repertorio rows, got %', n;
  end if;
end
$$;

-- Song requests (device limit trigger: max 2 per device_id)
insert into public.pedidos (track_id, track_name, artist_name, album_image, requester, device_id, wants_to_sing, created_at) values
  ('seed-track-001', 'De Música Ligera', 'Soda Stereo', null, 'Martín', 'seed-device-a', true,  now() - interval '40 minutes'),
  ('seed-track-002', 'Hotel California', 'Eagles', null, 'Martín', 'seed-device-a', false, now() - interval '35 minutes'),
  ('seed-track-003', 'Billie Jean', 'Michael Jackson', null, 'Lucía', 'seed-device-b', false, now() - interval '20 minutes'),
  ('seed-track-004', 'Mi Buenos Aires Querido', 'Carlos Gardel', null, 'Sofi', 'seed-device-c', true,  now() - interval '10 minutes'),
  ('seed-track-005', 'Bohemian Rhapsody', 'Queen', null, 'Nico', 'seed-device-d', true,  now() - interval '2 minutes');
