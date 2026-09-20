import type { Dataset, Velocita } from './types'

/**
 * I GeoJSON stanno in public/data/ e vengono scaricati a runtime, non importati:
 * sono ~430 KB che non hanno motivo di entrare nel bundle JS e che così restano
 * cacheabili a parte. BASE_URL tiene conto del sottopercorso di GitHub Pages.
 */
export async function caricaDataset(): Promise<Dataset> {
  const base = import.meta.env.BASE_URL
  const url = (nome: string) => `${base}data/${nome}`

  const [proposte, esistenti, meta, metro, confine] = await Promise.all([
    prendi(url('proposte.json')),
    prendi(url('esistenti.json')),
    prendi(url('meta.json')),
    prendi(url('metro.json')),
    prendi(url('confine.json')),
  ])

  return { proposte, esistenti, meta, metro, confine } as Dataset
}

/**
 * I segmenti osservati pesano 1,4 MB: non entrano nel caricamento iniziale, che
 * ne vale 500. Arrivano solo se qualcuno accende uno dei due strati di analisi.
 */
export async function caricaVelocita(): Promise<Velocita> {
  return prendi(`${import.meta.env.BASE_URL}data/velocita.json`)
}

async function prendi(url: string) {
  const risposta = await fetch(url)
  if (!risposta.ok) {
    throw new Error(`Impossibile caricare ${url}: ${risposta.status} ${risposta.statusText}`)
  }
  return risposta.json()
}
