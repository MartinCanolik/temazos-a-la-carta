-- Etapa 2 · Gestión de la cola de pedidos desde el panel.
-- Los usuarios con rol 'admin' (la gente de la banda) pueden borrar pedidos:
-- marcar uno como "ya sonó" o vaciar la cola al terminar el show.
-- Al borrarse un pedido, ese dispositivo recupera lugar para pedir otra canción
-- (ver el límite de pedidos por dispositivo).
--
-- Para dar rol admin a alguien (desde el SQL Editor):
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'mail@ejemplo.com');
--
-- Idempotente: se puede aplicar con `supabase db push` o pegándolo en el SQL Editor.

drop policy if exists "pedidos_delete_admin" on public.pedidos;
create policy "pedidos_delete_admin"
  on public.pedidos for delete
  to authenticated
  using (public.is_admin());

grant delete on public.pedidos to authenticated;
