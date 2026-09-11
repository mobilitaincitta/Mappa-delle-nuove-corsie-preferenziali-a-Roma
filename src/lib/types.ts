export type Scenario = 1 | 2 | 3

export interface PropProposta {
  id: number
  nome: string
  scenario: Scenario
  len: number
  tratti: number
}

export interface PropEsistente {
  id: number
  nome: string
  uso: string
  len: number
  tratti: number
}

export type Geometria = {
  type: 'MultiLineString' | 'LineString'
  coordinates: number[][][]
}

export interface Feature<P> {
  type: 'Feature'
  id: number
  properties: P
  geometry: Geometria
}

export interface Collezione<P> {
  type: 'FeatureCollection'
  features: Feature<P>[]
}

export interface GruppoKm {
  key: number | string | null
  n: number
  /** Per le proposte sono i km dichiarati dal piano, non misurati sul tracciato. */
  len: number
}

export interface Meta {
  generatoDa: string
  fonte: string
  bbox: [number, number, number, number]
  proposte: { n: number; len: number; perScenario: GruppoKm[] }
  esistenti: { n: number; len: number; perUso: GruppoKm[] }
  qualita: {
    nomiDistinti: number
    nomiConPiuGrafie: number
    segmentiSotto5m: number
    maxTratti: number
    maxLen: number
  }
}

export interface PropLineaMetro {
  /** A, B o C. Il ramo B1 e' taggato B in OSM e resta accorpato alla B. */
  ref: string
  nome: string
  /** Colore della segnaletica ATAC, uguale nei due temi. */
  colore: string
}

export interface PropStazioneMetro {
  nome: string
  /** Linee che la servono, separate da «·»: «A·B» a Termini. */
  linee: string
  interscambio: boolean
  colore: string
}

export interface Metro {
  linee: Collezione<PropLineaMetro>
  stazioni: Collezione<PropStazioneMetro>
  fonte: string
}

export interface Dataset {
  proposte: Collezione<PropProposta>
  esistenti: Collezione<PropEsistente>
  meta: Meta
  metro: Metro
}

/** Stato dei filtri, condiviso da mappa, KPI e tabella. */
export interface Filtri {
  scenari: Set<Scenario>
  mostraEsistenti: boolean
  mostraMetro: boolean
}

export type Bbox = [number, number, number, number]
