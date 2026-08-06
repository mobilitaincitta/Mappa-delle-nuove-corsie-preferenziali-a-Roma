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
