-- Etapa 2 · Registro de toques.
-- Cada músico registra sus toques (fecha, lugar, formato, paga, con quién)
-- y el setlist, armado con canciones de su repertorio. Es información privada:
-- sólo la ve y la edita el propio músico.
-- Idempotente: se puede aplicar con `supabase db push` o pegándolo en el SQL Editor.

create table if not exists public.toques (
  id          uuid primary key default gen_random_uuid(),
  musico_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  fecha       date not null,
  hora        time,
  lugar       text not null check (char_length(btrim(lugar)) between 1 and 120),
  ciudad      text check (ciudad is null or char_length(ciudad) <= 80),
  formato     text check (formato is null or char_length(formato) <= 60),
  paga        numeric(12, 2) check (paga is null or paga >= 0),
  moneda      text not null default 'UYU' check (moneda in ('UYU', 'USD', 'ARS')),
  con_quien   text check (con_quien is null or char_length(con_quien) <= 200),
  notas       text check (notas is null or char_length(notas) <= 1000),
  created_at  timestamptz not null default now()
);

create index if not exists toques_musico_fecha_idx on public.toques (musico_id, fecha desc);

-- Setlist: canciones del repertorio del músico, en orden.
create table if not exists public.toque_canciones (
  toque_id    uuid not null references public.toques (id) on delete cascade,
  cancion_id  uuid not null references public.musico_canciones (id) on delete cascade,
  orden       integer not null check (orden >= 0),
  primary key (toque_id, cancion_id)
);

alter table public.toques enable row level security;
alter table public.toque_canciones enable row level security;

drop policy if exists "toques_own" on public.toques;
create policy "toques_own"
  on public.toques for all
  to authenticated
  using (musico_id = auth.uid())
  with check (musico_id = auth.uid());

drop policy if exists "toque_canciones_own" on public.toque_canciones;
create policy "toque_canciones_own"
  on public.toque_canciones for all
  to authenticated
  using (
    exists (select 1 from public.toques t where t.id = toque_id and t.musico_id = auth.uid())
  )
  with check (
    exists (select 1 from public.toques t where t.id = toque_id and t.musico_id = auth.uid())
    and exists (
      select 1 from public.musico_canciones c
      where c.id = cancion_id and c.musico_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.toques to authenticated;
grant select, insert, update, delete on public.toque_canciones to authenticated;
