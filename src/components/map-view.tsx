import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from 'react'
import maplibregl, { type LngLatBoundsLike, type Map as MapLibreMap } from 'maplibre-gl'
import { TriangleAlert } from 'lucide-react'
import 'maplibre-gl/dist/maplibre-gl.css'

import type {
  Bbox,
  Dataset,
  Filtri,
  ModoAnalisi,
  PropProposta,
  PropVelocita,
  Velocita,
} from '@/lib/types'
import { formattaLunghezza } from '@/lib/format'
import { SCALE, type Scala } from '@/lib/analisi'

export interface MapHandle {
  inquadra: (bbox: Bbox, zoomMax?: number) => void
  volaSu: (lon: number, lat: number, zoom?: number) => void
  evidenzia: (idProposte: number[], idEsistenti: number[]) => void
  pulisciEvidenza: () => void
}

interface Props {
  dataset: Dataset
  /** Arriva più tardi del resto: è caricato solo se serve. */
  velocita: Velocita | null
  filtri: Filtri
  selezionato: number | null
  onSelezione: (id: number | null) => void
  selezionatoBus: number | null
  onSelezioneBus: (id: number | null) => void
  ref?: Ref<MapHandle>
}

/** Le tile sono le stesse dell'export originale. */
const BASEMAP = {
  base: 'Canvas/World_Light_Gray_Base',
  etichette: 'Canvas/World_Light_Gray_Reference',
}

/**
 * Ultimo livello per cui Esri ha davvero le tile su Roma.
 *
 * Da 17 in su il servizio risponde 200 ma restituisce sempre la stessa immagine
 * segnaposto da 2521 byte, quella che dice che il dato non e' disponibile.
 * Dichiarandolo sulla sorgente, MapLibre smette di chiedere quei livelli e
 * riusa il 16 ingrandendolo: lo sfondo si ammorbidisce, ma non compare mai la
 * scritta. Il tetto di zoom sta un livello piu' su, dove l'ingrandimento e' di
 * appena 2x e le linee restano nitide perche' sono vettoriali.
 */
const ZOOM_MAX_TILE = 16
const ZOOM_MAX = 17

/**
 * Colore a gradini: `step` assegna la prima tinta sotto la soglia più bassa e
 * poi una per ogni soglia superata. Classi nette, non una sfumatura continua:
 * la domanda è «in quale fascia cade questo segmento», non «quanto esattamente».
 */
function coloreAGradini(scala: Scala, tinte: string[]) {
  const espressione: unknown[] = ['step', ['get', scala.campo], tinte[0]]
  scala.soglie.forEach((soglia, i) => espressione.push(soglia, tinte[i + 1]))
  return espressione
}

const tile = (servizio: string) =>
  `https://services.arcgisonline.com/ArcGIS/rest/services/${servizio}/MapServer/tile/{z}/{y}/{x}`

// Il dato della metropolitana viene da OpenStreetMap, che e' sotto ODbL:
// l'attribuzione non e' una cortesia, e' una condizione della licenza.
const ATTRIBUZIONE =
  'Tile &copy; Esri &middot; metro &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> &middot; rete proposta: <a href="https://github.com/mobilitaincitta" target="_blank" rel="noreferrer">Mobilità in Città</a>'

/** Legge i colori dai token CSS, così tema e mappa non divergono mai. */
function leggiColori() {
  const stile = getComputedStyle(document.documentElement)
  const v = (nome: string) => stile.getPropertyValue(nome).trim()
  return {
    sc1: v('--viz-sc1'),
    sc2: v('--viz-sc2'),
    sc3: v('--viz-sc3'),
    esistenti: v('--viz-existing'),
    evidenza: v('--viz-highlight'),
    superficie: v('--viz-surface'),
    ink2: v('--viz-ink-2'),
    vel: [1, 2, 3, 4].map((i) => v(`--an-vel-${i}`)),
    ben: [1, 2, 3, 4].map((i) => v(`--an-ben-${i}`)),
  }
}

const VUOTO = { type: 'FeatureCollection' as const, features: [] }

/**
 * MapLibre richiede WebGL 2. Se manca — accelerazione hardware disattivata,
 * driver in blocklist, macchina virtuale senza GPU — il costruttore solleva
 * un'eccezione e l'area della mappa resterebbe bianca senza spiegazione.
 */
function webgl2Disponibile(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!canvas.getContext('webgl2')
  } catch {
    return false
  }
}

export function MapView({
  dataset,
  velocita,
  filtri,
  selezionato,
  onSelezione,
  selezionatoBus,
  onSelezioneBus,
  ref,
}: Props) {
  const contenitore = useRef<HTMLDivElement>(null)
  const mappa = useRef<MapLibreMap | null>(null)
  const pronta = useRef(false)
  const popup = useRef<maplibregl.Popup | null>(null)
  const etichetteMetro = useRef<maplibregl.Marker[]>([])
  const onSelezioneRef = useRef(onSelezione)
  onSelezioneRef.current = onSelezione
  const onSelezioneBusRef = useRef(onSelezioneBus)
  onSelezioneBusRef.current = onSelezioneBus

  /**
   * Esegue un'operazione sulla mappa appena questa è utilizzabile.
   *
   * Sorgenti e layer esistono solo dopo l'evento `load`: scartare le chiamate
   * arrivate prima significherebbe perdere in silenzio una ricerca fatta mentre
   * lo stile è ancora in caricamento — cosa tutt'altro che teorica su rete lenta
   * o con la scheda in secondo piano, dove i frame non vengono nemmeno prodotti.
   */
  const quandoPronta = useCallback((azione: (map: MapLibreMap) => void) => {
    const map = mappa.current
    if (!map) return
    if (pronta.current) azione(map)
    else map.once('load', () => azione(map))
  }, [])

  // Il gestore di 'zoom' viene registrato una volta sola e catturerebbe il
  // valore iniziale del filtro: qui ne legge sempre l'ultimo.
  const mostraMetroRef = useRef(filtri.mostraMetro)
  mostraMetroRef.current = filtri.mostraMetro
  // I gestori di click e hover si registrano una volta sola: devono leggere
  // l'analisi corrente, non quella che c'era al montaggio.
  const analisiRef = useRef(filtri.analisi)
  analisiRef.current = filtri.analisi

  const [guasto, setGuasto] = useState<string | null>(null)
  /** Vero finché l'inquadratura è ancora quella automatica di partenza. */
  const autoInquadra = useRef(true)

  // --- creazione (una sola volta) ---------------------------------------
  useEffect(() => {
    if (!contenitore.current || mappa.current) return

    if (!webgl2Disponibile()) {
      setGuasto(
        'Questo browser non espone WebGL 2, necessario per disegnare la mappa. ' +
          'Di solito succede con l\'accelerazione hardware disattivata: in Chrome ed Edge ' +
          'sta in Impostazioni → Sistema.'
      )
      return
    }

    const colori = leggiColori()
    const bounds: LngLatBoundsLike = [
      [dataset.meta.bbox[0], dataset.meta.bbox[1]],
      [dataset.meta.bbox[2], dataset.meta.bbox[3]],
    ]

    const map = new maplibregl.Map({
      container: contenitore.current,
      attributionControl: false,
      // Serve a poter leggere i pixel del canvas per le verifiche; ha un costo
      // di memoria, quindi resta fuori dalla produzione.
      ...(import.meta.env.DEV
        ? { canvasContextAttributes: { preserveDrawingBuffer: true } }
        : {}),
      bounds,
      fitBoundsOptions: { padding: 48 },
      maxZoom: ZOOM_MAX,
      style: {
        version: 8,
        sources: {
          basemap: {
            type: 'raster',
            tiles: [tile(BASEMAP.base)],
            tileSize: 256,
            maxzoom: ZOOM_MAX_TILE,
            attribution: ATTRIBUZIONE,
          },
          basemapEtichette: {
            type: 'raster',
            tiles: [tile(BASEMAP.etichette)],
            tileSize: 256,
            maxzoom: ZOOM_MAX_TILE,
          },
          confine: { type: 'geojson', data: dataset.confine as never },
          metroLinee: { type: 'geojson', data: dataset.metro.linee as never },
          metroStazioni: { type: 'geojson', data: dataset.metro.stazioni as never },
          esistenti: { type: 'geojson', data: dataset.esistenti as never },
          proposte: { type: 'geojson', data: dataset.proposte as never },
          evidenza: { type: 'geojson', data: VUOTO },
        },
        layers: [
          { id: 'base', type: 'raster', source: 'basemap' },
          { id: 'base-etichette', type: 'raster', source: 'basemapEtichette' },

          // Confine comunale: e' il limite di cio' di cui la mappa parla, quindi
          // sta appena sopra lo sfondo e resta un tratteggio sottile.
          {
            id: 'confine',
            type: 'line',
            source: 'confine',
            paint: {
              'line-color': colori.ink2,
              'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.8, 14, 1.6],
              'line-dasharray': [4, 3],
              'line-opacity': 0.5,
            },
          },

          // Metropolitana: contesto, quindi sta sotto tutto il resto della rete.
          // I colori vengono dal dato (tag `colour` di OSM, cioe' la segnaletica
          // ATAC) e non dai token del tema: l'arancione della A resta arancione
          // anche di notte, altrimenti la linea non si riconosce piu'.
          {
            id: 'metro-alone',
            type: 'line',
            source: 'metroLinee',
            paint: {
              'line-color': colori.superficie,
              'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4, 16, 10],
              'line-opacity': 0.45,
            },
            layout: {
              'line-cap': 'round',
              'line-join': 'round',
              visibility: filtri.mostraMetro ? 'visible' : 'none',
            },
          },
          {
            id: 'metro-linea',
            type: 'line',
            source: 'metroLinee',
            paint: {
              'line-color': ['get', 'colore'],
              'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2.2, 16, 6],
              'line-opacity': 0.55,
            },
            layout: {
              'line-cap': 'round',
              'line-join': 'round',
              visibility: filtri.mostraMetro ? 'visible' : 'none',
            },
          },
          {
            id: 'metro-stazione',
            type: 'circle',
            source: 'metroStazioni',
            paint: {
              'circle-color': colori.superficie,
              'circle-stroke-color': ['get', 'colore'],
              'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                10, ['case', ['get', 'interscambio'], 3, 1.8],
                16, ['case', ['get', 'interscambio'], 6.5, 4.5],
              ],
              'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 16, 2.2],
            },
            layout: { visibility: filtri.mostraMetro ? 'visible' : 'none' },
          },

          // Evidenza sotto le linee: alone che non copre il colore dello scenario.
          {
            id: 'evidenza',
            type: 'line',
            source: 'evidenza',
            paint: {
              'line-color': colori.evidenza,
              'line-width': ['interpolate', ['linear'], ['zoom'], 10, 8, 16, 22],
              'line-opacity': 0.55,
              'line-blur': 1,
            },
            layout: { 'line-cap': 'round', 'line-join': 'round' },
          },

          // Esistenti: contesto, quindi grigio. TRAM e PROMISCUO si distinguono
          // per tratteggio, non per colore, per non rubare significato alla
          // scala di priorità.
          {
            id: 'esistenti-promiscuo',
            type: 'line',
            source: 'esistenti',
            filter: ['==', ['get', 'uso'], 'PROMISCUO'],
            paint: {
              'line-color': colori.esistenti,
              'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 16, 2.5],
              'line-opacity': 0.9,
            },
          },
          {
            id: 'esistenti-tram',
            type: 'line',
            source: 'esistenti',
            filter: ['==', ['get', 'uso'], 'TRAM'],
            paint: {
              'line-color': colori.esistenti,
              'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.2, 16, 3],
              'line-dasharray': [2, 1.5],
              'line-opacity': 0.9,
            },
          },

          // Anello di superficie sotto le proposte: le stacca dalla basemap e
          // dalle corsie esistenti dove si sovrappongono.
          {
            id: 'proposte-alone',
            type: 'line',
            source: 'proposte',
            paint: {
              'line-color': colori.superficie,
              'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 16, 9],
              'line-opacity': 0.85,
            },
            layout: { 'line-cap': 'round', 'line-join': 'round' },
          },
          {
            id: 'proposte',
            type: 'line',
            source: 'proposte',
            paint: {
              'line-color': [
                'match',
                ['get', 'scenario'],
                1, colori.sc1,
                2, colori.sc2,
                3, colori.sc3,
                colori.sc2,
              ],
              'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.8, 16, 5.5],
            },
            layout: { 'line-cap': 'round', 'line-join': 'round' },
          },
          // Area di click più generosa della linea: 5 px di linea sono un
          // bersaglio troppo piccolo, soprattutto da telefono.
          {
            id: 'proposte-click',
            type: 'line',
            source: 'proposte',
            paint: { 'line-color': '#000', 'line-opacity': 0, 'line-width': 20 },
          },
        ],
      },
    })

    // Senza questo una sorgente che non carica o uno stile non valido
    // producono una mappa vuota senza alcuna traccia in console.
    map.on('error', (e) => {
      console.error('[mappa]', e.error?.message ?? e)
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-left')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

    popup.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
      maxWidth: '280px',
    })

    map.on('mouseenter', 'proposte-click', () => {
      map.getCanvas().style.cursor = 'pointer'
    })

    map.on('mousemove', 'proposte-click', (e) => {
      const f = e.features?.[0]
      if (!f) return
      const p = f.properties as unknown as PropProposta
      popup.current
        ?.setLngLat(e.lngLat)
        .setHTML(
          `<div class="px-3 py-2 text-xs">
             <div class="font-medium text-[13px] leading-tight">${escapeHtml(p.nome)}</div>
             <div class="mt-1 text-muted-foreground">
               Scenario ${p.scenario} · ${formattaLunghezza(Number(p.len))}
             </div>

           </div>`
        )
        .addTo(map)
    })

    map.on('mouseleave', 'proposte-click', () => {
      map.getCanvas().style.cursor = ''
      popup.current?.remove()
    })

    map.on('mouseenter', 'analisi-click', () => {
      map.getCanvas().style.cursor = 'pointer'
    })

    map.on('mousemove', 'analisi-click', (e) => {
      const f = e.features?.[0]
      if (!f) return
      const p = f.properties as unknown as PropVelocita
      const modo = analisiRef.current
      const scala = modo === 'scenario' ? null : SCALE[modo]
      popup.current
        ?.setLngLat(e.lngLat)
        .setHTML(
          `<div class="px-3 py-2 text-xs">
             <div class="font-medium text-[13px] leading-tight">${escapeHtml(
               p.nome ?? 'Strada non indicata'
             )}</div>
             <div class="mt-1 text-muted-foreground">${
               scala?.campo === 'ben'
                 ? `benefit ${p.ben} su 100`
                 : `${Number(p.vel).toFixed(1).replace('.', ',')} km/h`
             } · ${formattaLunghezza(Number(p.len))}</div>
             <div class="mt-0.5 text-muted-foreground">${escapeHtml(
               p.da ?? ''
             )} → ${escapeHtml(p.a ?? '')}</div>
           </div>`
        )
        .addTo(map)
    })

    map.on('mouseleave', 'analisi-click', () => {
      map.getCanvas().style.cursor = ''
      popup.current?.remove()
    })

    map.on('click', 'analisi-click', (e) => {
      const f = e.features?.[0]
      if (f) onSelezioneBusRef.current(Number((f.properties as { id: number }).id))
    })

    map.on('click', 'proposte-click', (e) => {
      const f = e.features?.[0]
      if (f) onSelezioneRef.current(Number((f.properties as { id: number }).id))
    })

    // Un click sul vuoto deseleziona.
    map.on('click', (e) => {
      const strati = ['proposte-click']
      if (map.getLayer('analisi-click')) strati.push('analisi-click')
      const sopra = map.queryRenderedFeatures(e.point, { layers: strati })
      if (!sopra.length) {
        onSelezioneRef.current(null)
        onSelezioneBusRef.current(null)
      }
    })

    map.on('load', () => {
      pronta.current = true
      etichetteMetro.current = creaEtichette(map, dataset)
      aggiornaEtichette(map, etichetteMetro.current, filtri.mostraMetro)
      aggiornaFiltri(map, filtri)
      confina(map, dataset)
      // Il fit passato al costruttore usa la dimensione che il contenitore ha in
      // quel momento, prima che il layout si sia stabilizzato: il risultato è
      // una vista troppo larga, con la rete ridotta a un groviglio al centro e
      // mezzo Lazio intorno. A `load` la misura è quella definitiva.
      map.resize()
      map.fitBounds(bounds, { padding: 32, duration: 0 })
    })

    // Se lo stile non arriva a `load`, l'area resterebbe vuota per sempre senza
    // dire niente: la causa tipica è la rete che blocca il servizio delle tile.
    const guardiano = setTimeout(() => {
      if (!pronta.current) {
        setGuasto(
          'La mappa non ha completato il caricamento. Le cause più comuni sono ' +
            'le tile di sfondo bloccate dalla rete (services.arcgisonline.com) ' +
            'oppure la scheda rimasta in secondo piano durante l\'apertura. ' +
            'I dettagli sono in console, con prefisso [mappa].'
        )
      }
    }, 15000)

    /**
     * MapLibre reagisce al ridimensionamento della finestra, non a quello del
     * proprio contenitore. Qui il contenitore cambia altezza senza che la
     * finestra si muova — il pannello laterale si popola a dati caricati e la
     * riga della griglia si assesta — e senza questo osservatore il canvas
     * resta all'altezza iniziale: la mappa diventa una striscia in alto con un
     * vuoto sotto.
     */
    const osservatore = new ResizeObserver(() => {
      map.resize()
      // Lo zoom minimo dipende dall'altezza del riquadro: se cambia, il comune
      // non riempirebbe piu' la vista con lo stesso valore.
      if (pronta.current) confina(map, dataset)
      // A canvas più alto lo stesso zoom mostra più territorio: finché
      // l'inquadratura è quella automatica va ricalcolata, altrimenti la rete
      // resta un groviglio al centro con mezzo Lazio intorno.
      if (autoInquadra.current && pronta.current) {
        map.fitBounds(bounds, { padding: 32, duration: 0 })
      }
    })
    osservatore.observe(contenitore.current)

    // Appena l'utente muove la mappa, l'inquadratura è sua e non va più toccata.
    const cedi = () => {
      autoInquadra.current = false
    }
    map.on('zoom', () =>
      aggiornaEtichette(map, etichetteMetro.current, mostraMetroRef.current)
    )

    map.on('dragstart', cedi)
    map.on('wheel', cedi)
    map.on('dblclick', cedi)

    mappa.current = map

    // Aggancio per l'ispezione manuale in sviluppo; non entra nel bundle di
    // produzione perché import.meta.env.DEV è false e il ramo viene eliminato.
    if (import.meta.env.DEV) {
      ;(window as unknown as { __mappa?: MapLibreMap }).__mappa = map
    }

    return () => {
      osservatore.disconnect()
      clearTimeout(guardiano)
      popup.current?.remove()
      for (const m of etichetteMetro.current) m.remove()
      etichetteMetro.current = []
      map.remove()
      mappa.current = null
      pronta.current = false
    }
    // Il dataset non cambia per la vita del componente: la mappa si crea una volta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset])

  // --- segmento bus selezionato ------------------------------------------
  useEffect(() => {
    if (!velocita || selezionatoBus == null) return
    const f = velocita.features.find((x) => x.properties.id === selezionatoBus)
    if (!f) return
    quandoPronta((map) => {
      const sorgente = map.getSource('evidenza') as maplibregl.GeoJSONSource | undefined
      sorgente?.setData({ type: 'FeatureCollection', features: [f] } as never)
    })
  }, [selezionatoBus, velocita, quandoPronta])

  // --- strati di analisi -------------------------------------------------
  useEffect(() => {
    if (!velocita) return
    quandoPronta((map) => {
      creaAnalisi(map, velocita)
      aggiornaAnalisi(map, filtri.analisi)
    })
  }, [velocita, filtri.analisi, quandoPronta])

  // --- filtri ------------------------------------------------------------
  useEffect(() => {
    quandoPronta((map) => {
      aggiornaFiltri(map, filtri)
      aggiornaEtichette(map, etichetteMetro.current, filtri.mostraMetro)
    })
  }, [filtri, quandoPronta])

  // --- segmento selezionato ---------------------------------------------
  useEffect(() => {
    if (selezionato == null) return
    const f = dataset.proposte.features.find((x) => x.properties.id === selezionato)
    if (!f) return
    quandoPronta((map) => {
      const sorgente = map.getSource('evidenza') as maplibregl.GeoJSONSource | undefined
      sorgente?.setData({ type: 'FeatureCollection', features: [f] } as never)
    })
  }, [selezionato, dataset, quandoPronta])

  useImperativeHandle(
    ref,
    (): MapHandle => {
      const handle: MapHandle = {
      inquadra: (bbox, zoomMax = 16) => {
        if (!bbox.every((n) => Number.isFinite(n))) return
        autoInquadra.current = false
        quandoPronta((map) => {
          // Una strada di 30 m darebbe un bbox quasi degenere: il padding e
          // maxZoom evitano di finire a zoom 22 su un punto.
          map.fitBounds(
            [
              [bbox[0], bbox[1]],
              [bbox[2], bbox[3]],
            ],
            { padding: 80, maxZoom: zoomMax, duration: 700 }
          )
        })
      },
      volaSu: (lon, lat, zoom = 16) => {
        autoInquadra.current = false
        quandoPronta((map) => map.flyTo({ center: [lon, lat], zoom, duration: 700 }))
      },
      evidenzia: (idProposte, idEsistenti) => {
        const insiemeP = new Set(idProposte)
        const insiemeE = new Set(idEsistenti)
        const features = [
          ...dataset.proposte.features.filter((f) => insiemeP.has(f.properties.id)),
          ...dataset.esistenti.features.filter((f) => insiemeE.has(f.properties.id)),
        ]
        quandoPronta((map) => {
          const sorgente = map.getSource('evidenza') as maplibregl.GeoJSONSource | undefined
          sorgente?.setData({ type: 'FeatureCollection', features } as never)
        })
      },
      pulisciEvidenza: () => {
        quandoPronta((map) => {
          const sorgente = map.getSource('evidenza') as maplibregl.GeoJSONSource | undefined
          sorgente?.setData(VUOTO as never)
        })
      },
      }
      return handle
    },
    [dataset, quandoPronta]
  )

  return (
    <>
      {/*
        Dimensionato con l'altezza, non con la posizione assoluta: il foglio di
        stile di MapLibre dichiara `.maplibregl-map { position: relative }` ed
        entra dopo le utility di Tailwind, quindi a pari specificità vince lui e
        un `absolute inset-0` verrebbe annullato — con l'altezza che collassa a
        zero e la mappa invisibile. Con h-full/w-full il riquadro è corretto
        qualunque posizione MapLibre imponga.
      */}
      <div ref={contenitore} className="h-full w-full" />
      {guasto && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-background/95 p-6">
          <div className="max-w-sm text-center">
            <TriangleAlert className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Mappa non disponibile</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{guasto}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              I dati restano consultabili dai pannelli e dalla scheda «Segmenti».
            </p>
          </div>
        </div>
      )}
    </>
  )
}

// --- strati di analisi ----------------------------------------------------

/**
 * Crea i due strati la prima volta che il dato arriva.
 *
 * Lo strato è uno solo: cambiare fra velocità e benefit vuol dire riscrivere il
 * colore, non accendere un secondo layer. Così i due non possono essere accesi
 * insieme per costruzione, che è quello che serve — colorano gli stessi
 * segmenti e sovrapporli non direbbe niente.
 *
 * Va sotto `evidenza`, cioè sotto tutta la rete proposta: è la diagnosi su cui
 * si legge il piano, non il piano.
 */
function creaAnalisi(map: MapLibreMap, velocita: Velocita) {
  if (map.getSource('analisi')) return
  const colori = leggiColori()
  map.addSource('analisi', { type: 'geojson', data: velocita as never })
  map.addLayer(
    {
      id: 'analisi',
      type: 'line',
      source: 'analisi',
      paint: {
        'line-color': coloreAGradini(SCALE.velocita, colori.vel) as never,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.2, 16, 4.5],
        'line-opacity': 0.85,
      },
      layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
    },
    map.getLayer('evidenza') ? 'evidenza' : undefined
  )
  // Stesso motivo dell'area di click sulle corsie: una linea di 4 px è un
  // bersaglio troppo piccolo, soprattutto da telefono.
  map.addLayer(
    {
      id: 'analisi-click',
      type: 'line',
      source: 'analisi',
      paint: { 'line-color': '#000', 'line-opacity': 0, 'line-width': 18 },
      layout: { visibility: 'none' },
    },
    map.getLayer('evidenza') ? 'evidenza' : undefined
  )
}

function aggiornaAnalisi(map: MapLibreMap, modo: ModoAnalisi) {
  if (!map.getLayer('analisi')) return
  const acceso = modo !== 'scenario'
  for (const id of ['analisi', 'analisi-click']) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', acceso ? 'visible' : 'none')
    }
  }
  if (!acceso) return
  const colori = leggiColori()
  const tinte = modo === 'velocita' ? colori.vel : colori.ben
  map.setPaintProperty('analisi', 'line-color', coloreAGradini(SCALE[modo], tinte) as never)
}

// --- etichette delle stazioni ---------------------------------------------

/** Sotto questo zoom i nomi si accavallerebbero: restano solo i pallini. */
const ZOOM_ETICHETTE = 12.5

function creaEtichette(map: MapLibreMap, dataset: Dataset) {
  return dataset.metro.stazioni.features.map((f) => {
    const el = document.createElement('div')
    el.className = 'metro-etichetta'
    el.textContent = f.properties.nome
    const [lon, lat] = f.geometry.coordinates as unknown as [number, number]
    return new maplibregl.Marker({ element: el, anchor: 'left' })
      .setLngLat([lon, lat])
      .addTo(map)
  })
}

function aggiornaEtichette(
  map: MapLibreMap,
  marker: maplibregl.Marker[],
  mostraMetro: boolean
) {
  const visibili = mostraMetro && map.getZoom() >= ZOOM_ETICHETTE
  for (const m of marker) {
    m.getElement().style.display = visibili ? '' : 'none'
  }
}

// --- aggiornamenti imperativi ---------------------------------------------

/**
 * Confina la vista al comune di Roma.
 *
 * Il tetto inferiore non e' un numero fisso: e' lo zoom al quale il comune
 * riempie il riquadro, calcolato sulle dimensioni vere del contenitore. Un
 * valore fisso andrebbe bene su un monitor e sbagliato dentro un iframe basso.
 * Il riquadro di pan e' il confine con un margine, senza il quale a zoom minimo
 * la vista — piu' larga del comune per via delle proporzioni — non riuscirebbe
 * a stare dentro i limiti e scatterebbe.
 */
function confina(map: MapLibreMap, dataset: Dataset) {
  const [ovest, sud, est, nord] = dataset.confine.bbox
  const comune: [[number, number], [number, number]] = [
    [ovest, sud],
    [est, nord],
  ]

  map.setMinZoom(0)
  const camera = map.cameraForBounds(comune, { padding: 8 })
  if (camera?.zoom != null) map.setMinZoom(Math.min(camera.zoom, ZOOM_MAX))

  const margine = 0.08
  map.setMaxBounds([
    [ovest - margine, sud - margine],
    [est + margine, nord + margine],
  ])
}

function aggiornaFiltri(map: MapLibreMap, filtri: Filtri) {
  // Con un'analisi accesa le corsie del piano si spengono: sono disegnate sopra
  // e più spesse, e coprirebbero proprio i segmenti che l'analisi colora. Sta
  // qui e non in aggiornaAnalisi perché deve valere anche prima che i segmenti
  // osservati abbiano finito di scaricarsi.
  const scenarioAttivo = filtri.analisi === 'scenario'
  for (const id of ['proposte', 'proposte-alone', 'proposte-click']) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', scenarioAttivo ? 'visible' : 'none')
    }
  }

  const scenari = [...filtri.scenari]
  const filtro: unknown[] = ['in', ['get', 'scenario'], ['literal', scenari]]

  for (const id of ['proposte', 'proposte-alone', 'proposte-click']) {
    if (map.getLayer(id)) map.setFilter(id, filtro as never)
  }

  for (const id of ['esistenti-promiscuo', 'esistenti-tram']) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', filtri.mostraEsistenti ? 'visible' : 'none')
    }
  }

  for (const id of ['metro-alone', 'metro-linea', 'metro-stazione']) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', filtri.mostraMetro ? 'visible' : 'none')
    }
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  )
}
