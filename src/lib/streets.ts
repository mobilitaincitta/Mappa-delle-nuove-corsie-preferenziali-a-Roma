import type {
  Bbox,
  Collezione,
  Feature,
  Geometria,
  PropEsistente,
  PropProposta,
  Scenario,
} from './types'

/**
 * Indice delle strade presenti in mappa.
 *
 * Una voce per NOME, non per feature: nel dato di partenza "Viale Palmiro
 * Togliatti" sono 5 segmenti distinti e "Via Tiburtina" 3, e cercarli deve
 * portare a una sola voce che inquadra l'intera strada, non a cinque risultati
 * identici che inquadrano uno spezzone a caso.
 */
export interface VoceStrada {
  key: string
  label: string
  norm: string
  core: string
  proposte: number[]
  esistenti: number[]
  scenari: Scenario[]
  usi: string[]
  len: number
  bbox: Bbox
}

const PREFISSI = new Set([
  'via', 'viale', 'piazza', 'piazzale', 'corso', 'largo', 'lungotevere',
  'circonvallazione', 'vicolo', 'borgo', 'salita', 'galleria', 'ponte',
  'passeggiata', 'strada', 'clivo', 'banchina', 'sottovia', 'tangenziale',
])

const ARTICOLI = /^(di|del|della|dello|dei|degli|delle|d|dall|dalla)$/

/** Minuscole, senza accenti, senza punteggiatura: base per ogni confronto. */
export function normalizza(valore: unknown): string {
  return String(valore ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * "via tiburtina" → "tiburtina", così digitando "tiburtina" si trova la strada
 * senza dover indovinare se è via, viale o piazza.
 */
export function togliPrefisso(norm: string): string {
  const parti = norm.split(' ')
  if (parti.length > 1 && PREFISSI.has(parti[0])) {
    let resto = parti.slice(1)
    if (resto.length > 1 && ARTICOLI.test(resto[0])) resto = resto.slice(1)
    return resto.join(' ')
  }
  return norm
}

const parti = (g: Geometria) => g.coordinates

function estendi(bbox: Bbox, g: Geometria): void {
  for (const linea of parti(g)) {
    for (const [x, y] of linea) {
      if (x < bbox[0]) bbox[0] = x
      if (y < bbox[1]) bbox[1] = y
      if (x > bbox[2]) bbox[2] = x
      if (y > bbox[3]) bbox[3] = y
    }
  }
}

export function bboxDiFeature(features: Feature<unknown>[]): Bbox {
  const bbox: Bbox = [Infinity, Infinity, -Infinity, -Infinity]
  for (const f of features) estendi(bbox, f.geometry)
  return bbox
}

export function costruisciIndice(
  proposte: Collezione<PropProposta>,
  esistenti: Collezione<PropEsistente>
): VoceStrada[] {
  const indice = new Map<string, VoceStrada>()

  const voce = (nome: string): VoceStrada | null => {
    const norm = normalizza(nome)
    if (!norm) return null
    let v = indice.get(norm)
    if (!v) {
      v = {
        key: norm,
        label: nome.trim(),
        norm,
        core: togliPrefisso(norm),
        proposte: [],
        esistenti: [],
        scenari: [],
        usi: [],
        len: 0,
        bbox: [Infinity, Infinity, -Infinity, -Infinity],
      }
      indice.set(norm, v)
    }
    return v
  }

  for (const f of proposte.features) {
    const v = voce(f.properties.nome)
    if (!v) continue
    // L'etichetta delle proposte prevale: è il layer in primo piano.
    v.label = f.properties.nome.trim()
    v.proposte.push(f.properties.id)
    v.len += f.properties.len
    if (!v.scenari.includes(f.properties.scenario)) v.scenari.push(f.properties.scenario)
    estendi(v.bbox, f.geometry)
  }

  for (const f of esistenti.features) {
    const v = voce(f.properties.nome)
    if (!v) continue
    v.esistenti.push(f.properties.id)
    if (f.properties.uso && !v.usi.includes(f.properties.uso)) v.usi.push(f.properties.uso)
    estendi(v.bbox, f.geometry)
  }

  for (const v of indice.values()) {
    v.scenari.sort()
    v.usi.sort()
  }

  return [...indice.values()].sort((a, b) => a.label.localeCompare(b.label, 'it'))
}

/**
 * Ricerca sull'indice locale. Il punteggio premia, in ordine: inizio del nome
 * senza prefisso, inizio del nome completo, inizio di una parola interna,
 * sottostringa qualsiasi. Le proposte precedono gli esistenti a pari punteggio,
 * perché sono il soggetto della mappa.
 */
export function cercaIndice(indice: VoceStrada[], query: string, limite = 8): VoceStrada[] {
  const q = normalizza(query)
  if (q.length < 2) return []

  const punteggiate: { v: VoceStrada; p: number }[] = []
  for (const v of indice) {
    let p: number
    if (v.core.startsWith(q)) p = 0
    else if (v.norm.startsWith(q)) p = 1
    else if (v.core.includes(' ' + q)) p = 2
    else if (v.norm.includes(q)) p = 3
    else continue
    if (!v.proposte.length) p += 0.5
    punteggiate.push({ v, p })
  }

  punteggiate.sort((a, b) => a.p - b.p || a.v.label.localeCompare(b.v.label, 'it'))
  return punteggiate.slice(0, limite).map((x) => x.v)
}
