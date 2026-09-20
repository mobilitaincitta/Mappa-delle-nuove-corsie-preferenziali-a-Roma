import type { ModoAnalisi } from './types'

/**
 * Le due scale di analisi, in un posto solo.
 *
 * Soglie, etichette e colori servono in tre punti — l'espressione di colore
 * della mappa, la legenda e la scheda del segmento — e devono coincidere: se la
 * legenda dicesse «10 – 20» mentre la mappa colora a 15, nessuno se ne
 * accorgerebbe guardando, e sarebbe sbagliato.
 */
export interface Scala {
  titolo: string
  unita: string
  /** Campo nel GeoJSON dei segmenti osservati. */
  campo: 'vel' | 'ben'
  /** Estremi interni: la prima classe sta sotto il primo valore. */
  soglie: number[]
  etichette: string[]
  /** Variabili CSS, una per classe. */
  tinte: string[]
}

export const SCALE: Record<Exclude<ModoAnalisi, 'scenario'>, Scala> = {
  velocita: {
    titolo: 'Velocità media rilevata',
    unita: 'km/h',
    campo: 'vel',
    soglie: [10, 20, 30],
    etichette: ['0 – 10', '10 – 20', '20 – 30', 'oltre 30'],
    tinte: [1, 2, 3, 4].map((i) => `var(--an-vel-${i})`),
  },
  benefit: {
    titolo: 'Benefit score',
    unita: 'su 100',
    campo: 'ben',
    soglie: [25, 50, 75],
    etichette: ['0 – 25', '25 – 50', '50 – 75', '75 – 100'],
    tinte: [1, 2, 3, 4].map((i) => `var(--an-ben-${i})`),
  },
}

/** Indice della classe in cui cade un valore: 0 sotto la prima soglia. */
export function classe(scala: Scala, valore: number): number {
  return scala.soglie.filter((s) => valore >= s).length
}
