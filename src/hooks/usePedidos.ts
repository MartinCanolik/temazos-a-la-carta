import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Pedido } from '@/lib/database.types'

export const PEDIDOS_QUERY_KEY = ['pedidos'] as const

async function fetchPedidos(): Promise<Pedido[]> {
  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

/** Fetch inicial de la cola (TanStack Query). La actualización en vivo la maneja usePedidosRealtime. */
export function usePedidos() {
  return useQuery({
    queryKey: PEDIDOS_QUERY_KEY,
    queryFn: fetchPedidos,
  })
}

/** Cantidad de pedidos en la cola (deriva del cache, se actualiza en tiempo real). */
export function usePedidosCount(): number {
  const { data } = usePedidos()
  return data?.length ?? 0
}

/** Set de track_ids ya pedidos, para deshabilitar el botón `+` en el repertorio. */
export function usePedidosTrackIds(): Set<string> {
  const { data } = usePedidos()
  return useMemo(() => new Set((data ?? []).map((p) => p.track_id)), [data])
}

/**
 * Suscripción Realtime a la tabla `pedidos`. Debe montarse UNA sola vez
 * (en Layout). Actualiza el cache de TanStack Query ante INSERT/DELETE y
 * limpia el canal al desmontar (compatible con StrictMode en dev).
 */
export function usePedidosRealtime(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('pedidos-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pedidos' },
        (payload) => {
          const incoming = payload.new as Pedido
          queryClient.setQueryData<Pedido[]>(PEDIDOS_QUERY_KEY, (prev) => {
            const list = prev ?? []
            if (list.some((p) => p.id === incoming.id)) return list
            return [...list, incoming].sort((a, b) =>
              a.created_at.localeCompare(b.created_at),
            )
          })
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'pedidos' },
        (payload) => {
          const removedId = (payload.old as { id?: string }).id
          if (!removedId) return
          queryClient.setQueryData<Pedido[]>(PEDIDOS_QUERY_KEY, (prev) =>
            (prev ?? []).filter((p) => p.id !== removedId),
          )
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])
}
