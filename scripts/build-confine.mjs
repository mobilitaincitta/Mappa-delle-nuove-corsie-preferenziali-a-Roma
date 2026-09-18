/**
 * Scarica il confine del comune di Roma da OpenStreetMap e lo scrive in
 * public/data/confine.json.
 *
 * Serve a due cose: disegnare il bordo in mappa e ricavare il riquadro entro cui
 * la vista resta confinata, cosi' non si puo' allontanare lo zoom fino a perdere
 * Roma di vista.
 *
 * Il confine viene tenuto come MultiLineString e non come poligono: in mappa e'
 * una linea, non una superficie, e ricomporre gli anelli dalle vie disordinate
 * della relazione aggiungerebbe un passaggio fragile senza servire a niente.
 *
 * Richiede rete. Uso: npm run confine
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public/data')
const ENDPOINT = 'https://overpass-api.de/api/interpreter'

/** Relazione del comune di Roma: admin_level 8, wikidata Q220. */
const RELAZIONE = 41485

/** ~55 m: sotto questa soglia i vertici non cambiano nulla a video e pesano. */
const TOLLERANZA = 0.0005

const attendi = (ms) => new Promise((r) => setTimeout(r, ms))

async function overpass(query, tentativi = 4) {
  for (let i = 1; i <= tentativi; i++) {
    const risposta = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'User-Agent': 'corsie-preferenziali-roma/1.0 (build-confine.mjs)',
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

/** Douglas-Peucker: tiene i vertici che cambiano la forma, scarta gli altri. */
function semplifica(punti, tolleranza) {
  if (punti.length < 3) return punti
  let massima = 0
  let indice = 0
  const [ax, ay] = punti[0]
  const [bx, by] = punti[punti.length - 1]
  for (let i = 1; i < punti.length - 1; i++) {
    const [px, py] = punti[i]
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy)
    const d = len
      ? Math.abs(dy * px - dx * py + bx * ay - by * ax) / len
      : Math.hypot(px - ax, py - ay)
    if (d > massima) {
      massima = d
      indice = i
    }
  }
  if (massima <= tolleranza) return [punti[0], punti[punti.length - 1]]
  return [
    ...semplifica(punti.slice(0, indice + 1), tolleranza).slice(0, -1),
    ...semplifica(punti.slice(indice), tolleranza),
  ]
}

const arrotonda = (v) => Math.round(v * 1e5) / 1e5

const [relazione] = await overpass(
  `[out:json][timeout:120];rel(${RELAZIONE});out geom;`
)
if (!relazione) throw new Error(`relazione ${RELAZIONE} non trovata`)

let vertici = 0
const parti = []
for (const membro of relazione.members ?? []) {
  if (membro.type !== 'way' || !membro.geometry) continue
  if (membro.role && membro.role !== 'outer') continue
  vertici += membro.geometry.length
  const punti = membro.geometry.map((g) => [arrotonda(g.lon), arrotonda(g.lat)])
  parti.push(semplifica(punti, TOLLERANZA))
}
if (!parti.length) throw new Error('nessuna via esterna nella relazione')

const bbox = [Infinity, Infinity, -Infinity, -Infinity]
for (const parte of parti) {
  for (const [x, y] of parte) {
    if (x < bbox[0]) bbox[0] = x
    if (y < bbox[1]) bbox[1] = y
    if (x > bbox[2]) bbox[2] = x
    if (y > bbox[3]) bbox[3] = y
  }
}

const confine = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 0,
      properties: { nome: relazione.tags?.name ?? 'Roma' },
      geometry: { type: 'MultiLineString', coordinates: parti },
    },
  ],
  bbox,
  fonte: `OpenStreetMap (ODbL), relazione ${RELAZIONE}`,
}

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'confine.json'), JSON.stringify(confine))

const tenuti = parti.reduce((a, p) => a + p.length, 0)
console.log('vie esterne:', parti.length)
console.log('vertici:', vertici, '->', tenuti, `(${Math.round((1 - tenuti / vertici) * 100)}% in meno)`)
console.log('bbox:', bbox.map((v) => v.toFixed(4)).join(', '))
