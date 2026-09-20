const nf = (min: number, max: number) =>
  new Intl.NumberFormat('it-IT', { minimumFractionDigits: min, maximumFractionDigits: max })

const km1 = nf(1, 1)
const km0 = nf(0, 0)
const int = nf(0, 0)

/** Metri → stringa in km con una cifra: 103258 → "103,3 km". */
export function formattaKm(metri: number, cifre: 0 | 1 = 1): string {
  return `${(cifre === 1 ? km1 : km0).format(metri / 1000)} km`
}

/** Sotto il chilometro i metri sono più informativi dei decimali di km. */
export function formattaLunghezza(metri: number): string {
  if (metri < 1000) return `${int.format(Math.round(metri))} m`
  return formattaKm(metri)
}

/**
 * Sotto i 5 km/h la cifra decimale non racconta niente di vero: a quelle
 * velocità il GPS di un bus fermo in coda oscilla, e «0,1» o «2,3» sono
 * rumore di misura, non velocità. Si scrive la soglia, senza il decimale che
 * finge una precisione che non c'è.
 */
export const SOGLIA_VELOCITA_MINIMA = 5

export function formattaVelocita(kmh: number): string {
  if (kmh < SOGLIA_VELOCITA_MINIMA) return `< ${SOGLIA_VELOCITA_MINIMA}`
  return kmh.toFixed(1).replace('.', ',')
}

export function formattaNumero(n: number): string {
  return int.format(n)
}

export function formattaPercento(parte: number, totale: number): string {
  if (!totale) return '—'
  return `${nf(0, 0).format(Math.round((parte / totale) * 100))}%`
}

export const etichettaScenario = (s: number) => `Scenario ${s}`

/** Il numero di scenario è una priorità di attuazione: va detto a parole. */
export const descrizioneScenario: Record<number, string> = {
  1: 'Prima priorità',
  2: 'Seconda priorità',
  3: 'Terza priorità',
}
