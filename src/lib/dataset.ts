import type { Dataset } from './types'

/**
 * I GeoJSON stanno in public/data/ e vengono scaricati a runtime, non importati:
 * sono ~430 KB che non hanno motivo di entrare nel bundle JS e che così restano
 * cacheabili a parte. BASE_URL tiene conto del sottopercorso di GitHub Pages.
 */
export async function caricaDataset(): Promise<Dataset> {
  const base = import.meta.env.BASE_URL
  const url = (nome: string) => `${base}data/${nome}`

  const [proposte, esistenti, meta] = await Promise.all([
    prendi(url('proposte.json')),
    prendi(url('esistenti.json')),
    prendi(url('meta.json')),
  ])

  return { proposte, esistenti, meta } as Dataset
}

async function prendi(url: string) {
  const risposta = await fetch(url)
  if (!risposta.ok) {
    throw new Error(`Impossibile caricare ${url}: ${risposta.status} ${risposta.statusText}`)
  }
  return risposta.json()
}
