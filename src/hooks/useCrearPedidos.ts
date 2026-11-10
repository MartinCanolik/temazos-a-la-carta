import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getDeviceId } from '@/lib/deviceId'
import type { Track } from '@/types/spotify'
import type { Pedido, PedidoInsert } from '@/lib/database.types'
import { MAX_PEDIDOS_POR_DISPOSITIVO, PEDIDOS_QUERY_KEY } from './usePedidos'

interface CrearPedidosInput {
  tracks: Track[]
  requester: string
  wantsToSing: boolean
}

/** Error de duplicado (índice único pedidos_track_unico, código Postgres 23505). */
export class PedidoDuplicadoError extends Error {
  constructor(message = 'Alguna de esas canciones ya está en la cola.') {
    super(message)
    this.name = 'PedidoDuplicadoError'
  }
}

/** El dispositivo ya tiene el máximo de canciones en la cola (trigger pedidos_limite_por_dispositivo). */
export class PedidoLimiteError extends Error {
  constructor(
    message = `Podés tener hasta ${MAX_PEDIDOS_POR_DISPOSITIVO} temazos en la cola a la vez.`,
  ) {
    super(message)
    this.name = 'PedidoLimiteError'
  }
}

export function useCrearPedidos() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ tracks, requester, wantsToSing }: CrearPedidosInput) => {
      const deviceId = getDeviceId()

      // Chequeo rápido en el cliente; el trigger en la base es la validación real.
      const enCola = (queryClient.getQueryData<Pedido[]>(PEDIDOS_QUERY_KEY) ?? []).filter(
        (p) => p.device_id === deviceId,
      ).length
      if (enCola + tracks.length > MAX_PEDIDOS_POR_DISPOSITIVO) throw new PedidoLimiteError()

      const rows: PedidoInsert[] = tracks.map((t) => ({
        track_id: t.id,
        track_name: t.name,
        artist_name: t.artist,
        album_image: t.albumImage,
        requester: requester.trim(),
        device_id: deviceId,
        wants_to_sing: wantsToSing,
      }))

      const { error } = await supabase.from('pedidos').insert(rows)
      if (error) {
        // 23505 = unique_violation → algún track ya estaba pedido (condición de carrera).
        if (error.code === '23505') throw new PedidoDuplicadoError()
        if (error.message?.includes('limite_pedidos_por_dispositivo')) throw new PedidoLimiteError()
        throw error
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PEDIDOS_QUERY_KEY })
    },
  })
}
