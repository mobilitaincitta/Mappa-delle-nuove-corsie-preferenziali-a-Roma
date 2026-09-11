/**
 * Scarica linee e stazioni della metropolitana da OpenStreetMap e le scrive in
 * public/data/metro.json.
 *
 * Le geometrie delle linee stanno nelle relazioni `route=subway`, una per verso
 * di marcia: le stesse vie tornano due volte e vengono deduplicate per id.
 *
 * Le stazioni non si prendono dai membri della relazione — i nodi `stop` sono
 * punti di fermata sul binario, uno per banchina e senza nome — ma dai nodi
 * `station=subway`, che hanno il nome ufficiale. Quel filtro pero' cattura anche
 * la Metromare (ex Roma-Lido), taggata allo stesso modo: le stazioni vengono
 * quindi tenute solo se cadono entro 150 m da una delle linee A, B o C, e la
 * stessa prova assegna a ciascuna le linee che la servono, cosi' gli
 * interscambi risultano dal dato invece di essere scritti a mano.
 *
 * Richiede rete. Uso: npm run metro
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public/data')
const ENDPOINT = 'https://overpass-api.de/api/interpreter'
const BBOX = '41.70,12.30,42.00,12.85'

/** Colori dai tag `colour` di OSM, che riportano quelli della segnaletica ATAC. */
const COLORI = { A: '#F68B1F', B: '#3783C6', C: '#008751' }
const NOMI = { A: 'Linea A', B: 'Linea B / B1', C: 'Linea C' }

const attendi = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Overpass e' un servizio pubblico a slot: sotto carico risponde 429 o 504 e la
 * chiamata va semplicemente ripetuta piu' tardi. Senza attesa fra i tentativi
 * si finisce in fondo alla coda, quindi l'attesa raddoppia ogni volta.
 */
async function overpass(query, tentativi = 4) {
  for (let i = 1; i <= tentativi; i++) {
    // Senza User-Agent Overpass risponde 406: rifiuta i client che non si dichiarano.
    const risposta = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'User-Agent': 'corsie-preferenziali-roma/1.0 (build-metro.mjs)',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ data: query }),
    })
    if (risposta.ok) return (await risposta.json()).elements
    if (i === tentativi || ![429, 502, 503, 504].includes(risposta.status)) {
      throw new Error(`Overpass ha risposto ${risposta.status} ${risposta.statusText}`)
    }
    const pausa = 5000 * 2 ** (i - 1)
    console.warn(`  Overpass ${risposta.status}, riprovo fra ${pausa / 1000}s (${i}/${tentativi})`)
    await attendi(pausa)
  }
}

// --- distanza punto/segmento ----------------------------------------------
// Alla scala di una citta' la proiezione equirettangolare basta: l'errore e'
// sotto il metro, e qui serve solo distinguere 150 m da qualche chilometro.
const R = 6371008.8
const rad = (d) => (d * Math.PI) / 180

function xy([lon, lat], lat0) {
  return [R * rad(lon) * Math.cos(rad(lat0)), R * rad(lat)]
}

function distanzaDaSegmento(p, a, b, lat0) {
  const [px, py] = xy(p, lat0)
  const [ax, ay] = xy(a, lat0)
  const [bx, by] = xy(b, lat0)
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function distanzaDaLinea(punto, parti) {
  let minimo = Infinity
  for (const parte of parti) {
    for (let i = 1; i < parte.length; i++) {
      const d = distanzaDaSegmento(punto, parte[i - 1], parte[i], punto[1])
      if (d < minimo) minimo = d
    }
  }
  return minimo
}

// --- costruzione -----------------------------------------------------------
const arrotonda = (v) => Math.round(v * 1e6) / 1e6

const relazioni = await overpass(
  `[out:json][timeout:150];rel["route"="subway"]["ref"~"^(A|B|C)$"](${BBOX});out geom;`
)
const stazioniOsm = await overpass(
  `[out:json][timeout:100];node["station"="subway"](${BBOX});out tags center;`
)

/** Vie per linea, deduplicate: ogni relazione descrive un solo verso. */
const perLinea = new Map()
for (const rel of relazioni) {
  const ref = rel.tags.ref
  if (!perLinea.has(ref)) perLinea.set(ref, new Map())
  const vie = perLinea.get(ref)
  for (const membro of rel.members ?? []) {
    if (membro.type !== 'way' || !membro.geometry) continue
    if (!vie.has(membro.ref)) {
      vie.set(
        membro.ref,
        membro.geometry.map((g) => [arrotonda(g.lon), arrotonda(g.lat)])
      )
    }
  }
}

const linee = {
  type: 'FeatureCollection',
  features: [...perLinea.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ref, vie]) => ({
      type: 'Feature',
      id: ref,
      properties: { ref, nome: NOMI[ref] ?? `Linea ${ref}`, colore: COLORI[ref] ?? '#888' },
      geometry: { type: 'MultiLineString', coordinates: [...vie.values()] },
    })),
}

const partiPerLinea = new Map(
  linee.features.map((f) => [f.properties.ref, f.geometry.coordinates])
)

const SOGLIA_M = 150
const stazioni = {
  type: 'FeatureCollection',
  features: [],
}
for (const nodo of stazioniOsm) {
  const nome = nodo.tags?.name
  if (!nome) continue
  const punto = [nodo.lon, nodo.lat]
  const servita = []
  for (const [ref, parti] of partiPerLinea) {
    if (distanzaDaLinea(punto, parti) <= SOGLIA_M) servita.push(ref)
  }
  if (!servita.length) continue // Metromare e altre ferrovie taggate subway
  servita.sort()
  stazioni.features.push({
    type: 'Feature',
    id: stazioni.features.length,
    properties: {
      nome,
      linee: servita.join('·'),
      interscambio: servita.length > 1,
      colore: COLORI[servita[0]] ?? '#888',
    },
    geometry: { type: 'Point', coordinates: [arrotonda(nodo.lon), arrotonda(nodo.lat)] },
  })
}
/**
 * Fonde i nodi che descrivono la stessa stazione.
 *
 * Dove due linee si incontrano OSM tiene spesso un nodo per ciascuna, a pochi
 * metri di distanza e con nomi diversi: Colosseo compare tre volte, una come
 * «Colosseo» e due come «Colosseo - Fori Imperiali». Entro 150 m si tratta
 * sempre della stessa stazione — in rete le fermate non sono mai cosi' vicine —
 * quindi i nodi si uniscono, le linee si sommano e resta il nome piu' breve,
 * che e' quello usato in mappa.
 */
function fondiVicine(features) {
  const uscita = []
  for (const f of features) {
    const [lon, lat] = f.geometry.coordinates
    const gemella = uscita.find(
      (g) => distanzaDaSegmento([lon, lat], g.geometry.coordinates, g.geometry.coordinates, lat) <= 150
    )
    if (!gemella) {
      uscita.push({ ...f, properties: { ...f.properties, linee: f.properties.linee.split('·') } })
      continue
    }
    gemella.properties.linee = [...new Set([...gemella.properties.linee, ...f.properties.linee.split('·')])]
    if (f.properties.nome.length < gemella.properties.nome.length) {
      gemella.properties.nome = f.properties.nome
    }
  }
  return uscita.map((f, i) => {
    const linee = f.properties.linee.sort()
    return {
      ...f,
      id: i,
      properties: {
        nome: f.properties.nome,
        linee: linee.join('·'),
        interscambio: linee.length > 1,
        colore: COLORI[linee[0]] ?? '#888',
      },
    }
  })
}

stazioni.features = fondiVicine(stazioni.features)
stazioni.features.sort((a, b) => a.properties.nome.localeCompare(b.properties.nome))

mkdirSync(outDir, { recursive: true })
const metro = { linee, stazioni, fonte: 'OpenStreetMap (ODbL), via Overpass' }
writeFileSync(join(outDir, 'metro.json'), JSON.stringify(metro))

console.log('linee:', linee.features.map((f) => `${f.properties.ref} (${f.geometry.coordinates.length} vie)`).join(', '))
console.log('stazioni:', stazioni.features.length, '| interscambi:', stazioni.features.filter((f) => f.properties.interscambio).length)
console.log('scartate perche lontane da A/B/C:', stazioniOsm.length - stazioni.features.length)
