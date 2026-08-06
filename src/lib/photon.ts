/**
 * Ricerca su tutte le strade di Roma, non solo su quelle del piano.
 *
 * Usa Photon (photon.komoot.io), che è pensato per l'autocomplete a ogni tasto
 * premuto. Nominatim, che l'export qgis2web interrogava, vieta esplicitamente
 * questo uso nella sua usage policy: è per questo che non viene riutilizzato.
 *
 * Vincoli applicati, tutti necessari perché i risultati siano utili:
 *  - `bbox` sul territorio romano: senza questo il geocoder cerca nel mondo e
 *    ordina per "importance", che per un nome comune restituisce un'altra città;
 *  - `layer=street`: senza questo tornano fermate, caselli e stazioni;
 *  - filtro sul comune lato client, perché la bbox include Guidonia, Tivoli e
 *    altri comuni della cintura;
 *  - dedup su nome+quartiere, perché OSM spezza una via in più tronchi
 *    (Via del Corso arriva tre volte, una per tipo di highway);
 *  - la query viene inviata SENZA il prefisso Via/Viale/Piazza, perché con quel
 *    token Photon degrada in modo netto: "via giulia" restituisce Via
 *    Laurentina, "giulia" trova Via Giulia. Verificato sull'endpoint;
 *  - filtro di pertinenza sul nome restituito, perché la tolleranza agli errori
 *    di Photon produce comunque risultati che non contengono la parola cercata.
 */

import { normalizza, togliPrefisso } from './streets'

export interface RisultatoPhoton {
  key: string
  nome: string
  contesto: string
  lon: number
  lat: number
  /** Ordine GeoJSON [ovest, sud, est, nord], già convertito da quello di Photon. */
  bbox?: [number, number, number, number]
}

/** Bbox del comune di Roma con un margine: filtra comunque il comune dopo. */
const BBOX_ROMA = '12.23,41.66,12.86,42.06'
const ENDPOINT = 'https://photon.komoot.io/api/'

const COMUNI_AMMESSI = new Set(['roma', 'rome'])

export async function cercaStradeRoma(
  query: string,
  signal?: AbortSignal
): Promise<RisultatoPhoton[]> {
  const q = query.trim()
  if (q.length < 3) return []

  // Il nucleo del nome è sia la query da inviare sia il criterio di pertinenza.
  const nucleo = togliPrefisso(normalizza(q))
  const daInviare = nucleo.length >= 3 ? nucleo : normalizza(q)
  if (daInviare.length < 3) return []

  const url =
    `${ENDPOINT}?q=${encodeURIComponent(daInviare)}` +
    `&bbox=${BBOX_ROMA}&limit=15&layer=street`

  const risposta = await fetch(url, { signal })
  if (!risposta.ok) throw new Error(`Photon ha risposto ${risposta.status}`)

  const dati = (await risposta.json()) as {
    features?: {
      geometry: { coordinates: [number, number] }
      properties: Record<string, unknown>
    }[]
  }

  const visti = new Set<string>()
  const risultati: RisultatoPhoton[] = []

  for (const f of dati.features ?? []) {
    const p = f.properties
    const nome = testo(p.name) || testo(p.street)
    if (!nome) continue

    // Scarta i risultati che non contengono ciò che è stato cercato.
    const nomeNorm = normalizza(nome)
    if (!nomeNorm.includes(daInviare) && !togliPrefisso(nomeNorm).includes(daInviare)) {
      continue
    }

    const citta = testo(p.city) || testo(p.locality) || testo(p.county)
    // Photon non espone il codice ISTAT: il comune si riconosce dal nome, con
    // il CAP 00xxx come conferma per i casi in cui `city` manca.
    const cap = testo(p.postcode)
    const dentroRoma =
      COMUNI_AMMESSI.has(citta.toLowerCase()) || (!citta && cap.startsWith('00'))
    if (!dentroRoma) continue

    const quartiere = testo(p.district) || testo(p.suburb)
    const chiave = `${nome.toLowerCase()}|${quartiere.toLowerCase()}`
    if (visti.has(chiave)) continue
    visti.add(chiave)

    risultati.push({
      key: chiave,
      nome,
      contesto: [quartiere, cap].filter(Boolean).join(' · ') || 'Roma',
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      bbox: convertiExtent(p.extent),
    })
  }

  // Photon non ordina per pertinenza in modo utile: per "giulia" mette Via
  // Giulia dopo Via Massa San Giuliani. L'ordine viene ricalcolato con lo stesso
  // criterio dell'indice locale, così i due gruppi si comportano allo stesso modo.
  return risultati
    .map((r) => {
      const norm = normalizza(r.nome)
      const core = togliPrefisso(norm)
      let p: number
      if (core === daInviare) p = 0
      else if (core.startsWith(daInviare)) p = 1
      else if (norm.startsWith(daInviare)) p = 2
      else if (core.includes(' ' + daInviare)) p = 3
      else p = 4
      return { r, p }
    })
    .sort((a, b) => a.p - b.p || a.r.nome.localeCompare(b.r.nome, 'it'))
    .slice(0, 6)
    .map((x) => x.r)
}

const testo = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/**
 * Photon restituisce `extent` come [ovest, nord, est, sud]; il resto del mondo
 * (e fitBounds di MapLibre) usa [ovest, sud, est, nord]. Scambiare i due valori
 * di latitudine è indispensabile, altrimenti l'inquadratura è degenere.
 */
function convertiExtent(v: unknown): [number, number, number, number] | undefined {
  if (!Array.isArray(v) || v.length !== 4) return undefined
  const [ovest, nord, est, sud] = v as number[]
  if ([ovest, nord, est, sud].some((n) => typeof n !== 'number' || !isFinite(n))) {
    return undefined
  }
  return [ovest, Math.min(nord, sud), est, Math.max(nord, sud)]
}
