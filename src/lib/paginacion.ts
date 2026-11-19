export const PAGINA = 1000

/** Reads every page of a query: PostgREST caps a response at 1000 rows and would otherwise undercount silently. */
export async function leerTodo<T>(
  pagina: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const filas: T[] = []
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await pagina(desde, desde + PAGINA - 1)
    if (error) throw error
    filas.push(...(data ?? []))
    if ((data?.length ?? 0) < PAGINA) return filas
  }
}
