import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getDeviceId } from '@/lib/deviceId'
import type { Track } from '@/types/spotify'
import type { PedidoInsert } from '@/lib/database.types'
import { PEDIDOS_QUERY_KEY } from './usePedidos'

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

export function useCrearPedidos() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ tracks, requester, wantsToSing }: CrearPedidosInput) => {
      const deviceId = getDeviceId()
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
        throw error
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PEDIDOS_QUERY_KEY })
    },
  })
}
