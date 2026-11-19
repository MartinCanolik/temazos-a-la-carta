-- Etapa 2 · Perfil del músico.
-- Suma los datos del perfil y lo hace visible públicamente (para compartirlo
-- con otros músicos por link) una vez que el músico elige su `slug`.
-- Idempotente: se puede aplicar con `supabase db push` o pegándolo en el SQL Editor.

alter table public.profiles
  add column if not exists slug        text,
  add column if not exists instrumentos text[] not null default '{}',
  add column if not exists ciudad      text,
  add column if not exists bio         text,
  add column if not exists whatsapp    text,
  add column if not exists instagram   text;

-- Validaciones (se recrean para que la migración sea idempotente)
alter table public.profiles drop constraint if exists profiles_slug_formato;
alter table public.profiles add constraint profiles_slug_formato
  check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40);

alter table public.profiles drop constraint if exists profiles_textos_largo;
alter table public.profiles add constraint profiles_textos_largo check (
  (ciudad is null or char_length(ciudad) <= 80)
  and (bio is null or char_length(bio) <= 600)
  and (whatsapp is null or char_length(whatsapp) <= 30)
  and (instagram is null or char_length(instagram) <= 60)
  and cardinality(instrumentos) <= 12
);

create unique index if not exists profiles_slug_unico on public.profiles (slug);

-- Perfil público: cualquiera puede ver los perfiles que ya tienen slug.
drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public"
  on public.profiles for select
  to anon, authenticated
  using (slug is not null);

-- El músico puede editar sus datos de perfil (nunca `role`).
grant update (nombre, slug, instrumentos, ciudad, bio, whatsapp, instagram)
  on public.profiles to authenticated;
