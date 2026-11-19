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

-- Shared shows. Venues repeat on purpose (La Trastienda in Montevideo, Café Vinilo in CABA)
-- so stats, rankings and the public listing have data to group by.
-- Ana = 1111…, Bruno = 2222…, Caro = 3333…
insert into public.shows (id, creado_por, nombre, fecha, hora, lugar, ciudad, zona, estado, visibilidad,
                          entrada_info, entrada_url, repertorio_id, invitados, notas, canciones_confirmadas_en) values
  -- Past, played songs confirmed
  ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Noche de covers', current_date - 30, '21:30',
   'La Trastienda', 'Montevideo', 'Ciudad Vieja', 'realizado', 'publico', 'Entrada $500 en boletería.', null,
   'b0000000-0000-0000-0000-000000000001', null, 'Dos sets de 45 minutos', now() - interval '29 days'),
  ('c0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Casamiento Fernández', current_date - 7, '22:00',
   'Quinta Los Aromos', 'Montevideo', 'Carrasco', 'realizado', 'privado', null, null,
   'b0000000-0000-0000-0000-000000000002', 'Lu (percusión) y Cano (saxo)', 'Entrada, cena y baile', now() - interval '6 days'),
  ('c0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Los Covers en vivo', current_date - 14, '23:00',
   'Café Vinilo', 'CABA', 'Palermo', 'realizado', 'publico', 'Entrada $6.000.', null,
   'b0000000-0000-0000-0000-000000000003', null, 'Prueba de sonido a las 20', now() - interval '13 days'),
  ('c0000000-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', 'A la gorra en el parque', current_date - 60, null,
   'Café del Parque', 'Rosario', 'Centro', 'realizado', 'privado', null, null,
   null, null, 'Sin cachet, a la gorra', now() - interval '59 days'),
  -- Past, songs NOT confirmed yet (shows the "Confirmar temas" call to action)
  ('c0000000-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333', 'Evento corporativo', current_date - 3, '19:00',
   'Hotel Plaza', 'Rosario', 'Centro', 'programado', 'privado', null, null,
   'b0000000-0000-0000-0000-000000000002', null, null, null),
  -- Upcoming
  ('c0000000-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'Trío en Café Vinilo', current_date + 10, '20:30',
   'Café Vinilo', 'CABA', 'Palermo', 'programado', 'publico', 'Entrada $8.000. Reservas por Instagram.', 'https://example.com/cafe-vinilo',
   'b0000000-0000-0000-0000-000000000001', null, 'Próxima fecha', null),
  ('c0000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'Noche de rock', current_date + 5, '22:00',
   'La Trastienda', 'Montevideo', 'Ciudad Vieja', 'programado', 'publico', 'Entrada $600. Cupos limitados.', 'https://example.com/trastienda-rock',
   'b0000000-0000-0000-0000-000000000001', null, null, null),
  ('c0000000-0000-0000-0000-000000000008', '33333333-3333-3333-3333-333333333333', 'Festival de primavera', current_date + 21, '17:00',
   'Plaza Pringles', 'Rosario', 'Centro', 'programado', 'publico', 'Entrada libre y gratuita.', null,
   null, null, null, null),
  ('c0000000-0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', 'Cumpleaños de Mara', current_date + 3, '21:00',
   'Salón Don Bosco', 'CABA', 'Almagro', 'cancelado', 'publico', 'Entrada $3.000.', null,
   null, null, 'Lo suspendieron por lluvia', null),
  ('c0000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'Brunch acústico', current_date + 40, '12:00',
   'Café Vinilo', 'CABA', 'Palermo', 'programado', 'privado', null, null,
   null, null, null, null),
  -- More public listing data: today, free entry, a lineup with someone without a public profile,
  -- and a pending guest that must stay hidden.
  ('c0000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'Jam de los jueves', current_date, '21:00',
   'Bar Fun Fun', 'Montevideo', 'Cordón', 'programado', 'publico', 'Entrada gratuita.', null,
   null, null, null, null),
  ('c0000000-0000-0000-0000-000000000012', '22222222-2222-2222-2222-222222222222', 'Tarde de jazz', current_date + 7, '18:00',
   'Casa Bonita', 'CABA', 'Villa Crespo', 'programado', 'publico', 'Consumición mínima $4.500.', null,
   null, 'con Tito (batería)', null, null),
  ('c0000000-0000-0000-0000-000000000013', '33333333-3333-3333-3333-333333333333', 'Peña folclórica', current_date + 14, '21:30',
   'El Cairo', 'Rosario', 'Pichincha', 'programado', 'publico', 'Entrada $3.500. Reservas por WhatsApp.', 'https://example.com/pena-el-cairo',
   null, null, null, null),
  -- Past public show, same venue as 03 with a different spelling (one venue, two shows).
  -- Caro declined, so she does not count for it.
  ('c0000000-0000-0000-0000-000000000014', '22222222-2222-2222-2222-222222222222', 'Rock de los 80', current_date - 45, '22:30',
   'CAFÉ VINILO', 'CABA', 'Palermo', 'realizado', 'publico', 'Entrada $5.000.', null,
   null, null, null, now() - interval '44 days'),
  -- Past PRIVATE show at a public venue: counts for musicians and songs, never for venues.
  ('c0000000-0000-0000-0000-000000000015', '22222222-2222-2222-2222-222222222222', 'Cumpleaños de Lola', current_date - 20, '21:00',
   'Café Vinilo', 'CABA', 'Palermo', 'realizado', 'privado', null, null,
   null, null, null, now() - interval '19 days'),
  -- Past public show whose songs were never confirmed: counts for musician and venue, not for songs.
  ('c0000000-0000-0000-0000-000000000016', '11111111-1111-1111-1111-111111111111', 'Acústico de invierno', current_date - 100, '20:00',
   'La Trastienda', 'Montevideo', 'Ciudad Vieja', 'realizado', 'publico', 'Entrada $400.', null,
   null, null, null, null),
  -- Yesterday: keeps "Este mes" populated.
  ('c0000000-0000-0000-0000-000000000017', '11111111-1111-1111-1111-111111111111', 'Noche de covers II', current_date - 1, '21:30',
   'La Trastienda', 'Montevideo', 'Ciudad Vieja', 'realizado', 'publico', 'Entrada $500 en boletería.', null,
   null, null, null, now());

insert into public.show_musicos (show_id, musico_id, estado, invitado_por, respondido_en) values
  ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aceptado',  '11111111-1111-1111-1111-111111111111', now() - interval '31 days'),
  ('c0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'aceptado',  '11111111-1111-1111-1111-111111111111', now() - interval '31 days'),
  ('c0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'aceptado',  '11111111-1111-1111-1111-111111111111', now() - interval '20 days'),
  ('c0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'aceptado',  '11111111-1111-1111-1111-111111111111', now() - interval '20 days'),
  ('c0000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'aceptado',  '11111111-1111-1111-1111-111111111111', now() - interval '19 days'),
  ('c0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'aceptado',  '22222222-2222-2222-2222-222222222222', now() - interval '25 days'),
  ('c0000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'aceptado',  '22222222-2222-2222-2222-222222222222', now() - interval '24 days'),
  ('c0000000-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333', 'aceptado',  '33333333-3333-3333-3333-333333333333', now() - interval '10 days'),
  ('c0000000-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', 'aceptado',  '33333333-3333-3333-3333-333333333333', now() - interval '65 days'),
  ('c0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'aceptado',  '33333333-3333-3333-3333-333333333333', now() - interval '64 days'),
  ('c0000000-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'aceptado',  '22222222-2222-2222-2222-222222222222', now() - interval '6 days'),
  ('c0000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'aceptado',  '22222222-2222-2222-2222-222222222222', now() - interval '5 days'),
  ('c0000000-0000-0000-0000-000000000006', '33333333-3333-3333-3333-333333333333', 'pendiente', '22222222-2222-2222-2222-222222222222', null),
  ('c0000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'aceptado',  '11111111-1111-1111-1111-111111111111', now() - interval '4 days'),
  ('c0000000-0000-0000-0000-000000000007', '33333333-3333-3333-3333-333333333333', 'aceptado',  '11111111-1111-1111-1111-111111111111', now() - interval '3 days'),
  ('c0000000-0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222', 'rechazado', '11111111-1111-1111-1111-111111111111', now() - interval '3 days'),
  ('c0000000-0000-0000-0000-000000000008', '33333333-3333-3333-3333-333333333333', 'aceptado',  '33333333-3333-3333-3333-333333333333', now() - interval '2 days'),
  ('c0000000-0000-0000-0000-000000000008', '22222222-2222-2222-2222-222222222222', 'aceptado',  '33333333-3333-3333-3333-333333333333', now() - interval '1 day'),
  -- Pending invitation for Ana, created by Caro
  ('c0000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'pendiente', '33333333-3333-3333-3333-333333333333', null),
  ('c0000000-0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', 'aceptado',  '22222222-2222-2222-2222-222222222222', now() - interval '8 days'),
  ('c0000000-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'aceptado',  '22222222-2222-2222-2222-222222222222', now() - interval '7 days'),
  ('c0000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'aceptado',  '11111111-1111-1111-1111-111111111111', now() - interval '1 day'),
  ('c0000000-0000-0000-0000-000000000010', '22222222-2222-2222-2222-222222222222', 'pendiente', '11111111-1111-1111-1111-111111111111', null),
  ('c0000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'aceptado',  '11111111-1111-1111-1111-111111111111', now() - interval '2 days'),
  ('c0000000-0000-0000-0000-000000000011', '33333333-3333-3333-3333-333333333333', 'aceptado',  '11111111-1111-1111-1111-111111111111', now() - interval '1 day'),
  ('c0000000-0000-0000-0000-000000000012', '22222222-2222-2222-2222-222222222222', 'aceptado',  '22222222-2222-2222-2222-222222222222', now() - interval '3 days'),
  ('c0000000-0000-0000-0000-000000000012', '33333333-3333-3333-3333-333333333333', 'aceptado',  '22222222-2222-2222-2222-222222222222', now() - interval '2 days'),
  -- The admin has no public profile (no slug): accepted, but omitted from the public lineup
  ('c0000000-0000-0000-0000-000000000012', '99999999-9999-9999-9999-999999999999', 'aceptado',  '22222222-2222-2222-2222-222222222222', now() - interval '2 days'),
  ('c0000000-0000-0000-0000-000000000013', '33333333-3333-3333-3333-333333333333', 'aceptado',  '33333333-3333-3333-3333-333333333333', now() - interval '5 days'),
  ('c0000000-0000-0000-0000-000000000013', '11111111-1111-1111-1111-111111111111', 'pendiente', '33333333-3333-3333-3333-333333333333', null),
  ('c0000000-0000-0000-0000-000000000014', '22222222-2222-2222-2222-222222222222', 'aceptado',  '22222222-2222-2222-2222-222222222222', now() - interval '50 days'),
  ('c0000000-0000-0000-0000-000000000014', '11111111-1111-1111-1111-111111111111', 'aceptado',  '22222222-2222-2222-2222-222222222222', now() - interval '49 days'),
  ('c0000000-0000-0000-0000-000000000014', '33333333-3333-3333-3333-333333333333', 'rechazado', '22222222-2222-2222-2222-222222222222', now() - interval '49 days'),
  ('c0000000-0000-0000-0000-000000000015', '22222222-2222-2222-2222-222222222222', 'aceptado',  '22222222-2222-2222-2222-222222222222', now() - interval '25 days'),
  ('c0000000-0000-0000-0000-000000000015', '33333333-3333-3333-3333-333333333333', 'pendiente', '22222222-2222-2222-2222-222222222222', null),
  ('c0000000-0000-0000-0000-000000000016', '11111111-1111-1111-1111-111111111111', 'aceptado',  '11111111-1111-1111-1111-111111111111', now() - interval '105 days'),
  ('c0000000-0000-0000-0000-000000000017', '11111111-1111-1111-1111-111111111111', 'aceptado',  '11111111-1111-1111-1111-111111111111', now() - interval '5 days'),
  ('c0000000-0000-0000-0000-000000000017', '33333333-3333-3333-3333-333333333333', 'aceptado',  '11111111-1111-1111-1111-111111111111', now() - interval '4 days');

-- Private fees (mixed currencies, paid and pending). Past fees are paid on the show date.
insert into public.show_cobros (show_id, musico_id, importe, moneda, estado_cobro, cobrado_en, notas) values
  ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 3500,  'UYU', 'cobrado',   current_date - 30, null),
  ('c0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 3000,  'UYU', 'cobrado',   current_date - 30, null),
  ('c0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 12000, 'UYU', 'pendiente', null, 'Me lo pagan a fin de mes'),
  ('c0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 12000, 'UYU', 'cobrado',   current_date - 7, null),
  ('c0000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 150,   'USD', 'cobrado',   current_date - 7, null),
  ('c0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 45000, 'ARS', 'cobrado',   current_date - 14, null),
  ('c0000000-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333', 80,    'USD', 'pendiente', null, null),
  ('c0000000-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 30000, 'ARS', 'pendiente', null, null),
  ('c0000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 4000,  'UYU', 'pendiente', null, null);

-- Songs actually played (confirmed shows only)
insert into public.show_canciones_tocadas (show_id, cancion_id, orden)
select s.show_id::uuid, k.id, s.orden
from (values
  ('c0000000-0000-0000-0000-000000000001', 'De Música Ligera', 0),
  ('c0000000-0000-0000-0000-000000000001', 'Color Esperanza', 1),
  ('c0000000-0000-0000-0000-000000000001', 'Stand By Me', 2),
  ('c0000000-0000-0000-0000-000000000001', 'Hotel California', 3),
  ('c0000000-0000-0000-0000-000000000002', 'Lamento Boliviano', 0),
  ('c0000000-0000-0000-0000-000000000002', 'Persiana Americana', 1),
  ('c0000000-0000-0000-0000-000000000002', 'Rolling in the Deep', 2),
  ('c0000000-0000-0000-0000-000000000002', 'Stand By Me', 3),
  ('c0000000-0000-0000-0000-000000000003', 'Another One Bites the Dust', 0),
  ('c0000000-0000-0000-0000-000000000003', 'Billie Jean', 1),
  ('c0000000-0000-0000-0000-000000000003', 'De Música Ligera', 2),
  ('c0000000-0000-0000-0000-000000000003', 'Ji Ji Ji', 3),
  ('c0000000-0000-0000-0000-000000000005', 'Stand By Me', 0),
  ('c0000000-0000-0000-0000-000000000005', 'Color Esperanza', 1),
  ('c0000000-0000-0000-0000-000000000014', 'Hotel California', 0),
  ('c0000000-0000-0000-0000-000000000014', 'Lamento Boliviano', 1),
  ('c0000000-0000-0000-0000-000000000014', 'De Música Ligera', 2),
  ('c0000000-0000-0000-0000-000000000014', 'Stand By Me', 3),
  ('c0000000-0000-0000-0000-000000000015', 'Billie Jean', 0),
  ('c0000000-0000-0000-0000-000000000015', 'Another One Bites the Dust', 1),
  ('c0000000-0000-0000-0000-000000000017', 'Stand By Me', 0),
  ('c0000000-0000-0000-0000-000000000017', 'De Música Ligera', 1),
  ('c0000000-0000-0000-0000-000000000017', 'Zombie', 2),
  ('c0000000-0000-0000-0000-000000000017', 'Imagine', 3)
) as s(show_id, titulo, orden)
join public.canciones k on k.titulo = s.titulo;

-- Fail loudly if a title typo or a bad id silently dropped rows.
do $$
declare n integer;
begin
  select count(*) into n from public.shows;
  if n <> 17 then raise exception 'Seed error: expected 17 shows, got %', n; end if;
  select count(*) into n from public.show_musicos;
  if n <> 38 then raise exception 'Seed error: expected 38 show_musicos rows, got %', n; end if;
  select count(*) into n from public.show_cobros;
  if n <> 9 then raise exception 'Seed error: expected 9 show_cobros rows, got %', n; end if;
  select count(*) into n from public.show_canciones_tocadas;
  if n <> 24 then raise exception 'Seed error: expected 24 played-song rows, got %', n; end if;
end
$$;

-- Song requests (device limit trigger: max 2 per device_id)
insert into public.pedidos (track_id, track_name, artist_name, album_image, requester, device_id, wants_to_sing, created_at) values
  ('seed-track-001', 'De Música Ligera', 'Soda Stereo', null, 'Martín', 'seed-device-a', true,  now() - interval '40 minutes'),
  ('seed-track-002', 'Hotel California', 'Eagles', null, 'Martín', 'seed-device-a', false, now() - interval '35 minutes'),
  ('seed-track-003', 'Billie Jean', 'Michael Jackson', null, 'Lucía', 'seed-device-b', false, now() - interval '20 minutes'),
  ('seed-track-004', 'Mi Buenos Aires Querido', 'Carlos Gardel', null, 'Sofi', 'seed-device-c', true,  now() - interval '10 minutes'),
  ('seed-track-005', 'Bohemian Rhapsody', 'Queen', null, 'Nico', 'seed-device-d', true,  now() - interval '2 minutes');
