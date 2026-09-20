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

export interface PropVelocita {
  id: number
  nome: string | null
  da: string | null
  a: string | null
  len: number
  /** Linee che condividono il corridoio. */
  linee: number
  /** Velocità media rilevata fra le due fermate, km/h. */
  vel: number
  /** Benefit score dello scenario 2 «total», già su scala 0-100. */
  ben: number
}

export type Velocita = Collezione<PropVelocita>

/**
 * Quale delle tre analisi è in corso. Si escludono: ognuna ha un soggetto
 * diverso — i tratti del piano nella prima, i segmenti bus osservati nelle
 * altre due — e il pannello di sinistra racconta quella attiva.
 */
export type ModoAnalisi = 'scenario' | 'velocita' | 'benefit'

/** Confine comunale: linea da disegnare e riquadro entro cui tenere la vista. */
export interface Confine {
  type: 'FeatureCollection'
  features: Feature<{ nome: string }>[]
  bbox: Bbox
  fonte: string
}

export interface Dataset {
  proposte: Collezione<PropProposta>
  esistenti: Collezione<PropEsistente>
  meta: Meta
  metro: Metro
  confine: Confine
}

/** Stato dei filtri, condiviso da mappa, KPI e tabella. */
export interface Filtri {
  scenari: Set<Scenario>
  mostraEsistenti: boolean
  mostraMetro: boolean
  analisi: ModoAnalisi
  /** Classi accese dell'analisi in corso, per indice. */
  classi: Set<number>
}

export type Bbox = [number, number, number, number]
