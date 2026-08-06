import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import maplibregl, { type LngLatBoundsLike, type Map as MapLibreMap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import type { Bbox, Dataset, Filtri, PropProposta } from '@/lib/types'
import { formattaLunghezza } from '@/lib/format'

export interface MapHandle {
  inquadra: (bbox: Bbox, zoomMax?: number) => void
  volaSu: (lon: number, lat: number, zoom?: number) => void
  evidenzia: (idProposte: number[], idEsistenti: number[]) => void
  pulisciEvidenza: () => void
}

interface Props {
  dataset: Dataset
  filtri: Filtri
  scuro: boolean
  selezionato: number | null
  onSelezione: (id: number | null) => void
  ref?: Ref<MapHandle>
}

/** Le tile sono le stesse dell'export originale, con la variante scura. */
const BASEMAP = {
  chiaro: 'Canvas/World_Light_Gray_Base',
  chiaroEtichette: 'Canvas/World_Light_Gray_Reference',
  scuro: 'Canvas/World_Dark_Gray_Base',
  scuroEtichette: 'Canvas/World_Dark_Gray_Reference',
}

const tile = (servizio: string) =>
  `https://services.arcgisonline.com/ArcGIS/rest/services/${servizio}/MapServer/tile/{z}/{y}/{x}`

const ATTRIBUZIONE =
  'Tile &copy; Esri &middot; rete proposta: <a href="https://github.com/mobilitaincitta" target="_blank" rel="noreferrer">Mobilità in Città</a>'

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
  }
}

const VUOTO = { type: 'FeatureCollection' as const, features: [] }

export function MapView({
  dataset,
  filtri,
  scuro,
  selezionato,
  onSelezione,
  ref,
}: Props) {
  const contenitore = useRef<HTMLDivElement>(null)
  const mappa = useRef<MapLibreMap | null>(null)
  const pronta = useRef(false)
  const popup = useRef<maplibregl.Popup | null>(null)
  const onSelezioneRef = useRef(onSelezione)
  onSelezioneRef.current = onSelezione

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

  // --- creazione (una sola volta) ---------------------------------------
  useEffect(() => {
    if (!contenitore.current || mappa.current) return

    const colori = leggiColori()
    const bounds: LngLatBoundsLike = [
      [dataset.meta.bbox[0], dataset.meta.bbox[1]],
      [dataset.meta.bbox[2], dataset.meta.bbox[3]],
    ]

    const map = new maplibregl.Map({
      container: contenitore.current,
      attributionControl: false,
      bounds,
      fitBoundsOptions: { padding: 48 },
      style: {
        version: 8,
        glyphs: undefined,
        sources: {
          basemapChiaro: {
            type: 'raster',
            tiles: [tile(BASEMAP.chiaro)],
            tileSize: 256,
            attribution: ATTRIBUZIONE,
          },
          basemapChiaroEtichette: {
            type: 'raster',
            tiles: [tile(BASEMAP.chiaroEtichette)],
            tileSize: 256,
          },
          basemapScuro: {
            type: 'raster',
            tiles: [tile(BASEMAP.scuro)],
            tileSize: 256,
            attribution: ATTRIBUZIONE,
          },
          basemapScuroEtichette: {
            type: 'raster',
            tiles: [tile(BASEMAP.scuroEtichette)],
            tileSize: 256,
          },
          esistenti: { type: 'geojson', data: dataset.esistenti as never },
          proposte: { type: 'geojson', data: dataset.proposte as never },
          evidenza: { type: 'geojson', data: VUOTO },
        },
        layers: [
          // Le due basi restano entrambe caricate e si alternano per visibilità:
          // cambiare setStyle a ogni cambio tema costringerebbe a ricreare
          // sorgenti e layer.
          { id: 'base-chiaro', type: 'raster', source: 'basemapChiaro' },
          { id: 'base-chiaro-etichette', type: 'raster', source: 'basemapChiaroEtichette' },
          { id: 'base-scuro', type: 'raster', source: 'basemapScuro' },
          { id: 'base-scuro-etichette', type: 'raster', source: 'basemapScuroEtichette' },

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
             <div class="mt-0.5 text-muted-foreground">${
               p.tipo ? escapeHtml(String(p.tipo)) : 'tipologia non indicata'
             }</div>
           </div>`
        )
        .addTo(map)
    })

    map.on('mouseleave', 'proposte-click', () => {
      map.getCanvas().style.cursor = ''
      popup.current?.remove()
    })

    map.on('click', 'proposte-click', (e) => {
      const f = e.features?.[0]
      if (f) onSelezioneRef.current(Number((f.properties as { id: number }).id))
    })

    // Un click sul vuoto deseleziona.
    map.on('click', (e) => {
      const sopra = map.queryRenderedFeatures(e.point, { layers: ['proposte-click'] })
      if (!sopra.length) onSelezioneRef.current(null)
    })

    map.on('load', () => {
      pronta.current = true
      aggiornaTema(map, scuro)
      aggiornaFiltri(map, filtri)
    })

    mappa.current = map

    // Aggancio per l'ispezione manuale in sviluppo; non entra nel bundle di
    // produzione perché import.meta.env.DEV è false e il ramo viene eliminato.
    if (import.meta.env.DEV) {
      ;(window as unknown as { __mappa?: MapLibreMap }).__mappa = map
    }

    return () => {
      popup.current?.remove()
      map.remove()
      mappa.current = null
      pronta.current = false
    }
    // Il dataset non cambia per la vita del componente: la mappa si crea una volta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset])

  // --- tema --------------------------------------------------------------
  useEffect(() => {
    quandoPronta((map) => aggiornaTema(map, scuro))
  }, [scuro, quandoPronta])

  // --- filtri ------------------------------------------------------------
  useEffect(() => {
    quandoPronta((map) => aggiornaFiltri(map, filtri))
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

  return <div ref={contenitore} className="absolute inset-0" />
}

// --- aggiornamenti imperativi ---------------------------------------------

function aggiornaTema(map: MapLibreMap, scuro: boolean) {
  const colori = leggiColori()

  const visibilita = (id: string, visibile: boolean) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visibile ? 'visible' : 'none')
    }
  }
  visibilita('base-chiaro', !scuro)
  visibilita('base-chiaro-etichette', !scuro)
  visibilita('base-scuro', scuro)
  visibilita('base-scuro-etichette', scuro)

  if (map.getLayer('proposte')) {
    map.setPaintProperty('proposte', 'line-color', [
      'match',
      ['get', 'scenario'],
      1, colori.sc1,
      2, colori.sc2,
      3, colori.sc3,
      colori.sc2,
    ])
  }
  if (map.getLayer('proposte-alone')) {
    map.setPaintProperty('proposte-alone', 'line-color', colori.superficie)
  }
  for (const id of ['esistenti-promiscuo', 'esistenti-tram']) {
    if (map.getLayer(id)) map.setPaintProperty(id, 'line-color', colori.esistenti)
  }
  if (map.getLayer('evidenza')) {
    map.setPaintProperty('evidenza', 'line-color', colori.evidenza)
  }
}

function aggiornaFiltri(map: MapLibreMap, filtri: Filtri) {
  const scenari = [...filtri.scenari]
  // `tipoId` è null su 144 feature: nelle expression MapLibre null non si
  // confronta, quindi viene ricondotto a -1 da entrambi i lati.
  const tipi = [...filtri.tipi].map((t) => (t == null ? -1 : t))

  const filtro: unknown[] = [
    'all',
    ['in', ['get', 'scenario'], ['literal', scenari]],
    ['in', ['coalesce', ['get', 'tipoId'], -1], ['literal', tipi]],
  ]

  for (const id of ['proposte', 'proposte-alone', 'proposte-click']) {
    if (map.getLayer(id)) map.setFilter(id, filtro as never)
  }

  for (const id of ['esistenti-promiscuo', 'esistenti-tram']) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', filtri.mostraEsistenti ? 'visible' : 'none')
    }
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  )
}
