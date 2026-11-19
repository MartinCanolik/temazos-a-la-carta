-- Server-side setlist queries (replace client-side id lists inlined into URLs).
-- SECURITY INVOKER: setlists are readable by any authenticated user through RLS, so the
-- functions simply filter; PostgREST can embed related tables and page / order the result.
-- Idempotent: can be applied with `supabase db push` or pasted in the SQL Editor.

-- Setlists I created or where I am in the lineup.
create or replace function public.mis_repertorios()
returns setof public.repertorios
language sql
stable
security invoker
set search_path = public
as $$
  select r.*
  from public.repertorios r
  where r.creado_por = auth.uid()
     or exists (
       select 1 from public.repertorio_musicos m
       where m.repertorio_id = r.id and m.musico_id = auth.uid()
     );
$$;

-- Most recent setlists whose lineup includes ANY of the given musicians.
create or replace function public.repertorios_de_formacion(
  p_musicos uuid[],
  p_excluir uuid default null,
  p_limite integer default 5
)
returns setof public.repertorios
language sql
stable
security invoker
set search_path = public
as $$
  select r.*
  from public.repertorios r
  where exists (
          select 1 from public.repertorio_musicos m
          where m.repertorio_id = r.id and m.musico_id = any (coalesce(p_musicos, '{}'))
        )
    and (p_excluir is null or r.id <> p_excluir)
  order by r.updated_at desc, r.id
  limit greatest(least(coalesce(p_limite, 5), 50), 1);
$$;

revoke all on function public.mis_repertorios() from public, anon;
revoke all on function public.repertorios_de_formacion(uuid[], uuid, integer) from public, anon;
grant execute on function public.mis_repertorios() to authenticated;
grant execute on function public.repertorios_de_formacion(uuid[], uuid, integer) to authenticated;
