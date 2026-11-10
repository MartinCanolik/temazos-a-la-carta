-- Límite de pedidos por dispositivo: cada device_id puede tener como máximo
-- 2 canciones en la cola al mismo tiempo. Cuando la banda borra un pedido
-- (porque ya sonó), ese dispositivo vuelve a tener lugar para pedir otro.
--
-- El frontend ya bloquea el botón `+` al llegar al límite; este trigger es la
-- validación del lado del servidor (no se puede saltear llamando a la API).
-- Idempotente: se puede aplicar con `supabase db push` o pegándolo en el SQL Editor.

create or replace function public.pedidos_limite_por_dispositivo()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  max_pedidos constant integer := 2;
  cantidad integer;
begin
  -- Serializa inserts concurrentes del mismo dispositivo (evita condición de carrera).
  perform pg_advisory_xact_lock(hashtext('pedidos_device:' || new.device_id));

  -- En un INSERT de varias filas, el trigger ve las filas ya insertadas
  -- por la misma sentencia, así que el conteo incluye el pedido en curso.
  select count(*) into cantidad
  from public.pedidos
  where device_id = new.device_id;

  if cantidad >= max_pedidos then
    raise exception 'limite_pedidos_por_dispositivo'
      using errcode = 'P0001',
            hint = 'Máximo 2 canciones en la cola por dispositivo.';
  end if;

  return new;
end;
$$;

drop trigger if exists pedidos_limite_por_dispositivo on public.pedidos;
create trigger pedidos_limite_por_dispositivo
  before insert on public.pedidos
  for each row
  execute function public.pedidos_limite_por_dispositivo();
