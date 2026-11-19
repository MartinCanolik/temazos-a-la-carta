import { describe, expect, it } from 'vitest'
import { analizarFormacion, type MusicoFormacion } from './compatibilidad'
import {
  agregarItem,
  alternarPreparar,
  aPayload,
  estadoDeItem,
  moverItem,
  quitarItem,
  repertoriosRecientes,
  resumenRepertorio,
  type ItemRepertorio,
} from './repertorio'

const item = (id: string, extra: Partial<ItemRepertorio> = {}): ItemRepertorio => ({
  cancion_id: id,
  titulo: id.toUpperCase(),
  artista: 'X',
  a_preparar: false,
  notas: null,
  ...extra,
})
const ids = (items: ItemRepertorio[]) => items.map((i) => i.cancion_id)

describe('edición de la lista', () => {
  const base = [item('a'), item('b'), item('c')]

  it('moves items up and down', () => {
    expect(ids(moverItem(base, 1, -1))).toEqual(['b', 'a', 'c'])
    expect(ids(moverItem(base, 1, 1))).toEqual(['a', 'c', 'b'])
  })
  it('ignores moves past the edges and does not mutate', () => {
    expect(moverItem(base, 0, -1)).toBe(base)
    expect(moverItem(base, 2, 1)).toBe(base)
    expect(ids(base)).toEqual(['a', 'b', 'c'])
  })
  it('adds without duplicating and removes', () => {
    expect(ids(agregarItem(base, item('d')))).toEqual(['a', 'b', 'c', 'd'])
    expect(agregarItem(base, item('a'))).toBe(base)
    expect(ids(quitarItem(base, 'b'))).toEqual(['a', 'c'])
  })
  it('toggles the rehearsal mark', () => {
    const r = alternarPreparar(base, 'b')
    expect(r.map((i) => i.a_preparar)).toEqual([false, true, false])
    expect(alternarPreparar(r, 'b')[1].a_preparar).toBe(false)
  })
  it('keeps orden contiguous in the payload after any edit', () => {
    const editada = quitarItem(moverItem(base, 2, -1), 'a')
    expect(aPayload(editada).map((p) => [p.cancion_id, p.orden])).toEqual([
      ['c', 0],
      ['b', 1],
    ])
  })
})

describe('estado frente a la formación', () => {
  const musicos: MusicoFormacion[] = [
    { id: 'u1', nombre: 'Ana', canciones: [{ cancion_id: 'a', titulo: 'A', artista: 'X' }, { cancion_id: 'b', titulo: 'B', artista: 'X' }] },
    { id: 'u2', nombre: 'Bruno', canciones: [{ cancion_id: 'a', titulo: 'A', artista: 'X' }] },
  ]
  const analisis = analizarFormacion(musicos)

  it("is 'lista' when everyone knows it and it is not marked", () => {
    const e = estadoDeItem(item('a'), analisis, musicos)
    expect(e).toMatchObject({ estado: 'lista', razones: [], faltan: [], cantidad: 2, total: 2 })
  })
  it("is 'falta' with the names of who is missing it", () => {
    const e = estadoDeItem(item('b'), analisis, musicos)
    expect(e).toMatchObject({ estado: 'falta', razones: ['falta'], faltan: ['Bruno'], cantidad: 1 })
  })
  it("is 'a_preparar' when marked, even if everyone knows it", () => {
    const e = estadoDeItem(item('a', { a_preparar: true }), analisis, musicos)
    expect(e).toMatchObject({ estado: 'a_preparar', razones: ['manual'] })
  })
  it('shows both reasons when marked and not known by everyone', () => {
    const e = estadoDeItem(item('b', { a_preparar: true }), analisis, musicos)
    expect(e.estado).toBe('a_preparar')
    expect(e.razones).toEqual(['manual', 'falta'])
  })
  it('treats a song nobody knows as missing for everyone', () => {
    const e = estadoDeItem(item('z'), analisis, musicos)
    expect(e).toMatchObject({ estado: 'falta', faltan: ['Ana', 'Bruno'], cantidad: 0 })
  })
  it('summarizes coverage and counts', () => {
    const r = resumenRepertorio([item('a'), item('b'), item('c', { a_preparar: true })], analisis, musicos)
    expect(r.cobertura.listas).toBe(1)
    expect(r.cobertura.porcentaje).toBe(33)
    expect(r.listas).toBe(1)
    expect(r.porPreparar).toBe(2)
  })
})

describe('repertoriosRecientes', () => {
  const r = (id: string, updated_at: string, musicoIds: string[]) => ({ id, updated_at, musicoIds })
  const todos = [
    r('1', '2026-11-01T00:00:00Z', ['u1']),
    r('2', '2026-11-10T00:00:00Z', ['u2', 'u3']),
    r('3', '2026-11-05T00:00:00Z', ['u9']),
    r('4', '2026-11-08T00:00:00Z', ['u1', 'u2']),
  ]
  it('keeps setlists sharing any current musician, newest first, without the edited one', () => {
    expect(repertoriosRecientes(todos, ['u1', 'u2'], '2').map((x) => x.id)).toEqual(['4', '1'])
  })
  it('caps the result', () => {
    expect(repertoriosRecientes(todos, ['u1', 'u2', 'u3'], null, 2).map((x) => x.id)).toEqual(['2', '4'])
  })
  it('returns nothing without a lineup', () => {
    expect(repertoriosRecientes(todos, [])).toEqual([])
  })
})
