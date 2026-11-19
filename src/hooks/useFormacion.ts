import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/authContext'
import { usePerfilesPorSlug } from '@/hooks/usePerfiles'
import { useRepertoriosDe } from '@/hooks/useRepertoriosDe'
import type { MusicoFormacion } from '@/lib/compatibilidad'
import { agregarSlug, derivarFormacion, formacionLlena, parsearSlugs, type Miembro } from '@/lib/formacion'

/**
 * Formación elegida (vos + otros músicos), persistida en `?m=slug1,slug2`.
 * Yo siempre estoy incluido; los demás se resuelven por slug y se deduplican por id.
 */
export function useFormacion() {
  const { profile: miPerfil, user } = useAuth()
  const [params, setParams] = useSearchParams()
  const param = params.get('m')

  const slugs = useMemo(() => parsearSlugs(param, miPerfil?.slug), [param, miPerfil?.slug])
  const { data: perfiles, isLoading: cargandoPerfiles, isError: errorPerfiles } = usePerfilesPorSlug(slugs)

  const yo = useMemo<Miembro | null>(
    () => (user?.id ? { id: user.id, nombre: miPerfil?.nombre ?? 'Yo', slug: miPerfil?.slug ?? null } : null),
    [user?.id, miPerfil?.nombre, miPerfil?.slug],
  )
  const { miembros, otros, noEncontrados } = useMemo(
    () => derivarFormacion(yo, slugs, perfiles),
    [yo, slugs, perfiles],
  )

  const idsClave = miembros.map((m) => m.id)
  const { data: repertorios, isLoading: cargandoRep, isError: errorRep } = useRepertoriosDe(idsClave)

  const musicos = useMemo<MusicoFormacion[]>(
    () => miembros.map((m) => ({ id: m.id, nombre: m.nombre, canciones: repertorios?.[m.id] ?? [] })),
    [miembros, repertorios],
  )

  function setSlugs(nuevos: string[]) {
    const next = new URLSearchParams(params)
    if (nuevos.length > 0) next.set('m', nuevos.join(','))
    else next.delete('m')
    setParams(next, { replace: true })
  }

  /** Same rule as the URL parser: capped on raw slugs and on resolved members. */
  const lleno = formacionLlena(slugs, otros.length)

  const agregar = (slug: string) => {
    const nuevos = agregarSlug(slugs, slug, miPerfil?.slug, otros.length)
    if (nuevos !== slugs) setSlugs(nuevos)
  }
  const quitar = (slug: string | null) => setSlugs(slugs.filter((s) => s !== slug))

  return {
    miId: user?.id,
    slugs,
    setSlugs,
    miembros,
    otros,
    noEncontrados,
    musicos,
    repertorios,
    lleno,
    agregar,
    quitar,
    cargando: slugs.length > 0 && (cargandoPerfiles || cargandoRep),
    cargandoPerfiles,
    error: errorPerfiles || errorRep,
  }
}
