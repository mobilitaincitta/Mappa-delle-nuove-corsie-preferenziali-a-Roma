export type Scenario = 1 | 2 | 3

/** Chiave di tipologia: 1..6, oppure null per le 144 feature senza Ty_CP. */
export type TipoId = number | null

export interface PropProposta {
  id: number
  nome: string
  scenario: Scenario
  tipoId: TipoId
  tipo: string | null
  glossa: string | null
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
  len: number
}

export interface Meta {
  generatoDa: string
  fonte: string
  bbox: [number, number, number, number]
  proposte: { n: number; len: number; perScenario: GruppoKm[]; perTipo: GruppoKm[] }
  esistenti: { n: number; len: number; perUso: GruppoKm[] }
  glosse: Record<string, string>
  qualita: {
    nomiDistinti: number
    nomiConPiuGrafie: number
    proposteSenzaTipo: number
    kmSenzaTipo: number
    segmentiSotto5m: number
    maxTratti: number
    maxLen: number
  }
}

export interface Dataset {
  proposte: Collezione<PropProposta>
  esistenti: Collezione<PropEsistente>
  meta: Meta
}

/** Stato dei filtri, condiviso da mappa, KPI, grafico e tabella. */
export interface Filtri {
  scenari: Set<Scenario>
  tipi: Set<TipoId>
  mostraEsistenti: boolean
}

export type Bbox = [number, number, number, number]
