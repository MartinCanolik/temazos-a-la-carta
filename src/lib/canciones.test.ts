import { describe, expect, it } from 'vitest'
import {
  claveCancion,
  compararRepertorios,
  normalizarTexto,
  parsearListaCanciones,
  slugDesdeLink,
} from './canciones'

describe('normalizarTexto', () => {
  it('removes accents, case and punctuation', () => {
    expect(normalizarTexto('De Música Ligera!')).toBe('de musica ligera')
  })

  it('drops parenthesized and bracketed suffixes', () => {
    expect(normalizarTexto('Hotel California (En vivo)')).toBe('hotel california')
    expect(normalizarTexto('Stand By Me [Remastered]')).toBe('stand by me')
  })

  it('drops a trailing " - suffix"', () => {
    expect(normalizarTexto('Lamento Boliviano - Remastered 2011')).toBe('lamento boliviano')
  })
})

describe('claveCancion', () => {
  it('matches the same song written differently', () => {
    expect(claveCancion('De música ligera', 'Soda Stereo')).toBe(
      claveCancion('DE MUSICA LIGERA (En vivo)', 'soda stereo'),
    )
  })

  it('tells different songs apart', () => {
    expect(claveCancion('Persiana Americana', 'Soda Stereo')).not.toBe(
      claveCancion('De Música Ligera', 'Soda Stereo'),
    )
    expect(claveCancion('Zombie', 'The Cranberries')).not.toBe(claveCancion('Zombie', 'Bad Wolves'))
  })
})

describe('parsearListaCanciones', () => {
  it('parses numbered "Title - Artist" lines and defaults the artist', () => {
    expect(parsearListaCanciones('1. Persiana Americana - Soda Stereo\n\nZamba de mi esperanza')).toEqual([
      { titulo: 'Persiana Americana', artista: 'Soda Stereo' },
      { titulo: 'Zamba de mi esperanza', artista: 'Desconocido' },
    ])
  })
})

describe('compararRepertorios', () => {
  const mias = [
    { titulo: 'De Música Ligera', artista: 'Soda Stereo' },
    { titulo: 'Hotel California', artista: 'Eagles', spotify_track_id: 'abc' },
    { titulo: 'Solo mía', artista: 'Yo' },
  ]
  const suyas = [
    { titulo: 'de musica ligera', artista: 'SODA STEREO' },
    { titulo: 'Hotel California - Live', artista: 'The Eagles', spotify_track_id: 'abc' },
    { titulo: 'Solo suya', artista: 'Vos' },
  ]

  it('matches by normalized key and by Spotify id', () => {
    const r = compararRepertorios(mias, suyas)
    expect(r.enComun.map((c) => c.mia.titulo)).toEqual(['De Música Ligera', 'Hotel California'])
    expect(r.soloMias.map((c) => c.titulo)).toEqual(['Solo mía'])
    expect(r.soloSuyas.map((c) => c.titulo)).toEqual(['Solo suya'])
  })

  it('does not match one song of theirs twice', () => {
    const r = compararRepertorios([mias[0], { ...mias[0] }], [suyas[0]])
    expect(r.enComun).toHaveLength(1)
    expect(r.soloMias).toHaveLength(1)
  })
})

describe('compararRepertorios by catalog id', () => {
  it('matches by cancion_id even when the spelling differs', () => {
    const mias = [{ titulo: 'Zombie', artista: 'The Cranberries', cancion_id: 'c1' }]
    const suyas = [{ titulo: 'Zombi', artista: 'Cranberries', cancion_id: 'c1' }]
    expect(compararRepertorios(mias, suyas).enComun).toHaveLength(1)
  })

  it('prefers the exact catalog match over a fuzzy one', () => {
    const mias = [{ titulo: 'Hotel California', artista: 'Eagles', cancion_id: 'c1' }]
    const fuzzy = { titulo: 'Hotel California', artista: 'Eagles', cancion_id: 'c2' }
    const exacta = { titulo: 'Hotel California (Live)', artista: 'Eagles', cancion_id: 'c1' }
    const r = compararRepertorios(mias, [fuzzy, exacta])
    expect(r.enComun[0].suya).toBe(exacta)
    expect(r.soloSuyas).toEqual([fuzzy])
  })

  it('falls back to the normalized key when ids are missing', () => {
    const r = compararRepertorios(
      [{ titulo: 'Imagine', artista: 'John Lennon' }],
      [{ titulo: 'IMAGINE', artista: 'john lennon', cancion_id: 'c9' }],
    )
    expect(r.enComun).toHaveLength(1)
  })
})

describe('slugDesdeLink', () => {
  it('extracts the slug from a profile link or accepts a bare slug', () => {
    expect(slugDesdeLink('https://temazos.app/m/Ana-Gomez')).toBe('ana-gomez')
    expect(slugDesdeLink('bruno-paz')).toBe('bruno-paz')
    expect(slugDesdeLink('no es un slug')).toBeNull()
  })
})
