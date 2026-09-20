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

/**
 * Gli indici di tutte le classi di una scala.
 *
 * Le due scale non hanno lo stesso numero di gradini — la velocità ne ha
 * cinque, il benefit quattro — quindi «tutte accese» non è una costante:
 * dipende da quale scala si sta guardando, e un insieme rimasto dall'altra
 * farebbe risultare un filtro attivo che non c'è.
 */
export const tutteLeClassi = (scala: Scala) => scala.etichette.map((_, i) => i)

/**
 * Filtro MapLibre per le sole classi accese.
 *
 * Le classi sono intervalli contigui, quindi il ramo di ciascuna è una coppia
 * di disuguaglianze — tranne la prima e l'ultima, che hanno un solo estremo:
 * scrivere un confronto con l'infinito funzionerebbe in JavaScript ma non in
 * un'espressione di stile.
 */
export function filtroClassi(scala: Scala, attive: Set<number>): unknown[] | null {
  if (attive.size === scala.etichette.length) return null
  // Un filtro sempre falso. Non `['==', 1, 0]`: MapLibre lo legge come filtro
  // nella sintassi vecchia, dove il secondo elemento è il nome di una proprietà,
  // lo rifiuta con un errore in console e tiene quello di prima — così la mappa
  // continuava a mostrare l'ultima classe spenta mentre il pannello diceva zero.
  // Con `['get', …]` al secondo posto è inequivocabilmente un'espressione.
  if (attive.size === 0) return ['==', ['get', 'id'], -1]
  const campo = ['get', scala.campo]
  // Un indice oltre l'ultima classe — un insieme rimasto da una scala con più
  // gradini — produrrebbe un ramo con una soglia undefined, che MapLibre rifiuta
  // tenendosi il filtro precedente. Meglio ignorarlo che rompere tutto il filtro.
  const valide = [...attive].filter((i) => i >= 0 && i < scala.etichette.length)
  if (valide.length === 0) return ['==', ['get', 'id'], -1]
  const rami = valide.map((i) => {
    const sopra = i > 0 ? ['>=', campo, scala.soglie[i - 1]] : null
    const sotto = i < scala.soglie.length ? ['<', campo, scala.soglie[i]] : null
    if (sopra && sotto) return ['all', sopra, sotto]
    return (sopra ?? sotto) as unknown[]
  })
  return ['any', ...rami]
}
