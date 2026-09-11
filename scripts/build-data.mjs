/**
 * Estrae i GeoJSON dall'export qgis2web in legacy/ e li normalizza per l'app.
 *
 * I file in legacy/layers/*.js sono assegnazioni JavaScript (var json_... = {...})
 * pensate per essere caricate con <script>, non JSON: qui vengono valutate in un
 * contesto isolato e riscritte come GeoJSON con proprietà uniformi.
 *
 * Cosa viene aggiunto rispetto al dato originale:
 *  - `id` stabile, per collegare mappa, tabella e ricerca;
 *  - `len`, lunghezza geodetica in metri (l'export non la contiene);
 *  - `tratti`, numero di parti della MultiLineString;
 *  - nomi di campo uniformi tra i due layer, che nell'originale differiscono
 *    (STRADA/TIPO_USO negli esistenti, strada/scenario nelle proposte).
 *
 * La tipologia di intervento (Ty_CP) non viene riportata: resta nel dato di
 * origine in legacy/, ma fuori dalla dashboard.
 *
 * Uso: npm run data
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public/data')

/** Valuta un layer qgis2web e restituisce la FeatureCollection. */
function loadLayer(file, varName) {
  const code = readFileSync(join(root, 'legacy/layers', file), 'utf8')
  const sandbox = {}
  vm.createContext(sandbox)
  new vm.Script(code).runInContext(sandbox)
  const fc = sandbox[varName]
  if (!fc || fc.type !== 'FeatureCollection') {
    throw new Error(`${file}: variabile ${varName} non è una FeatureCollection`)
  }
  return fc
}

// --- geometria -------------------------------------------------------------

const R = 6371008.8 // raggio medio WGS84
const toRad = (d) => (d * Math.PI) / 180

function haversine([lon1, lat1], [lon2, lat2]) {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

const partsOf = (geometry) =>
  geometry.type === 'MultiLineString' ? geometry.coordinates : [geometry.coordinates]

function lengthOf(geometry) {
  let total = 0
  for (const line of partsOf(geometry)) {
    for (let i = 1; i < line.length; i++) {
      total += haversine(line[i - 1], line[i])
    }
  }
  return total
}

/** ~11 cm di precisione: i decimali oltre il sesto sono rumore e peso inutile. */
function roundGeometry(geometry) {
  const r = (v) => Math.round(v * 1e6) / 1e6
  return {
    type: geometry.type,
    coordinates: partsOf(geometry).map((line) => line.map(([x, y]) => [r(x), r(y)])),
  }
}

function bboxOf(collections) {
  const bbox = [Infinity, Infinity, -Infinity, -Infinity]
  for (const fc of collections) {
    for (const feature of fc.features) {
      for (const line of partsOf(feature.geometry)) {
        for (const [x, y] of line) {
          if (x < bbox[0]) bbox[0] = x
          if (y < bbox[1]) bbox[1] = y
          if (x > bbox[2]) bbox[2] = x
          if (y > bbox[3]) bbox[3] = y
        }
      }
    }
  }
  return bbox
}

// --- costruzione -----------------------------------------------------------

const esistentiRaw = loadLayer(
  'Corsiepreferenzialiesistenti_1.js',
  'json_Corsiepreferenzialiesistenti_1'
)
const proposteRaw = loadLayer(
  'Nuovecorsiepreferenzialiperpriorit_2.js',
  'json_Nuovecorsiepreferenzialiperpriorit_2'
)

const proposte = {
  type: 'FeatureCollection',
  features: proposteRaw.features.map((feature, i) => {
    return {
      type: 'Feature',
      id: i,
      properties: {
        id: i,
        nome: String(feature.properties.strada ?? '').trim(),
        scenario: Number(feature.properties.scenario),
        len: Math.round(lengthOf(feature.geometry)),
        tratti: partsOf(feature.geometry).length,
      },
      geometry: roundGeometry(feature.geometry),
    }
  }),
}

const esistenti = {
  type: 'FeatureCollection',
  features: esistentiRaw.features.map((feature, i) => ({
    type: 'Feature',
    id: i,
    properties: {
      id: i,
      nome: String(feature.properties.STRADA ?? '').trim(),
      uso: String(feature.properties.TIPO_USO ?? '').trim(),
      len: Math.round(lengthOf(feature.geometry)),
      tratti: partsOf(feature.geometry).length,
    },
    geometry: roundGeometry(feature.geometry),
  })),
}

// --- aggregati -------------------------------------------------------------

const sum = (features, pick = () => true) =>
  features.filter(pick).reduce((acc, f) => acc + f.properties.len, 0)

const groupKm = (features, key) => {
  const out = new Map()
  for (const f of features) {
    const k = f.properties[key] ?? null
    const row = out.get(k) ?? { n: 0, len: 0 }
    row.n += 1
    row.len += f.properties.len
    out.set(k, row)
  }
  return [...out.entries()].map(([k, v]) => ({ key: k, ...v }))
}

/**
 * Nel dato di partenza la stessa strada compare con grafie diverse
 * ("Via Tiburtina", "via tiburtina", "VIA TIBURTINA"), con doppi spazi e con
 * apostrofi incoerenti. Contarle serve a due cose: giustificare la
 * normalizzazione della ricerca, e dare a chi cura il dato un numero su cui
 * lavorare in QGIS.
 */
function contaGrafieIncoerenti(tutte) {
  const perChiave = new Map()
  for (const nome of tutte) {
    const chiave = nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
    if (!perChiave.has(chiave)) perChiave.set(chiave, new Set())
    perChiave.get(chiave).add(nome)
  }
  return {
    nomiDistinti: perChiave.size,
    conPiuGrafie: [...perChiave.values()].filter((v) => v.size > 1).length,
  }
}

const grafie = contaGrafieIncoerenti(
  proposte.features.concat(esistenti.features).map((f) => f.properties.nome)
)

/**
 * Km di piano dichiarati per priorità, in metri.
 *
 * Sono le cifre di sintesi del piano e sono l'unica fonte dei km in dashboard:
 * la lunghezza geodetica delle geometrie dell'export non viene usata, perché il
 * tracciato della bozza non corrisponde ai km del piano. Se l'export cambia e
 * compare una priorità non elencata qui, la build si ferma: i km vanno
 * dichiarati, non dedotti dal disegno.
 */
const KM_DICHIARATI = { 1: 87_000, 2: 53_000, 3: 19_000 }

const perScenario = groupKm(proposte.features, 'scenario')
  .sort((a, b) => a.key - b.key)
  .map((g) => {
    const len = KM_DICHIARATI[g.key]
    if (len == null) {
      throw new Error(
        `priorità ${g.key}: nessun km dichiarato in KM_DICHIARATI (build-data.mjs)`
      )
    }
    return { ...g, len }
  })

const lenProposte = perScenario.reduce((acc, g) => acc + g.len, 0)

const meta = {
  generatoDa: 'scripts/build-data.mjs',
  fonte: 'export qgis2web in legacy/ (mobilitaincitta@f2ccb21), km di sintesi dal piano',
  bbox: bboxOf([proposte, esistenti]),
  proposte: {
    n: proposte.features.length,
    len: lenProposte,
    perScenario,
  },
  esistenti: {
    n: esistenti.features.length,
    len: sum(esistenti.features),
    perUso: groupKm(esistenti.features, 'uso').sort((a, b) => b.len - a.len),
  },
  // Anomalie rilevate sul dato di partenza, mostrate in dashboard invece di
  // essere nascoste: il lettore deve sapere quanto del piano non è tipizzato.
  qualita: {
    nomiDistinti: grafie.nomiDistinti,
    nomiConPiuGrafie: grafie.conPiuGrafie,
    segmentiSotto5m: proposte.features
      .concat(esistenti.features)
      .filter((f) => f.properties.len < 5).length,
    maxTratti: Math.max(...proposte.features.map((f) => f.properties.tratti)),
    maxLen: Math.max(...proposte.features.map((f) => f.properties.len)),
  },
}

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'proposte.json'), JSON.stringify(proposte))
writeFileSync(join(outDir, 'esistenti.json'), JSON.stringify(esistenti))
writeFileSync(join(outDir, 'meta.json'), JSON.stringify(meta, null, 2))

const kb = (name) =>
  (readFileSync(join(outDir, name)).byteLength / 1024).toFixed(0) + ' KB'

console.log('proposte.json  ', proposte.features.length, 'feature', kb('proposte.json'))
console.log('esistenti.json ', esistenti.features.length, 'feature', kb('esistenti.json'))
console.log('meta.json      ', kb('meta.json'))
console.log(
  'proposte:',
  (meta.proposte.len / 1000).toFixed(1),
  'km | esistenti:',
  (meta.esistenti.len / 1000).toFixed(1),
  'km'
)
