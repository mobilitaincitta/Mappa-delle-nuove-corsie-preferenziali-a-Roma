import { useEffect, useMemo, useRef, useState } from 'react'
import { Info, TriangleAlert } from 'lucide-react'

import { MapView, type MapHandle } from '@/components/map-view'
import { StreetSearch } from '@/components/street-search'
import { StatTiles } from '@/components/stat-tiles'
import { ScenarioControl } from '@/components/scenario-control'
import { TypeControl } from '@/components/type-control'
import { SegmentDetail } from '@/components/segment-detail'
import { SegmentTable } from '@/components/segment-table'
import { Legend } from '@/components/legend'
import { ThemeToggle } from '@/components/theme-toggle'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { TooltipProvider } from '@/components/ui/tooltip'

import { caricaDataset } from '@/lib/dataset'
import { costruisciIndice, bboxDiFeature } from '@/lib/streets'
import { useTheme } from '@/lib/use-theme'
import { formattaKm, formattaNumero } from '@/lib/format'
import type { Dataset, Filtri, Meta, Scenario, TipoId } from '@/lib/types'

const TUTTI_SCENARI: Scenario[] = [1, 2, 3]

export default function App() {
  const { scuro, alterna } = useTheme()
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [selezionato, setSelezionato] = useState<number | null>(null)
  const mappa = useRef<MapHandle>(null)

  const [filtri, setFiltri] = useState<Filtri>({
    scenari: new Set(TUTTI_SCENARI),
    tipi: new Set<TipoId>(),
    mostraEsistenti: true,
  })

  useEffect(() => {
    caricaDataset()
      .then((d) => {
        setDataset(d)
        // I tipi si conoscono solo a dati caricati: all'inizio sono tutti attivi,
        // compreso il gruppo senza tipologia (chiave null).
        setFiltri((f) => ({
          ...f,
          tipi: new Set(d.meta.proposte.perTipo.map((g) => (g.key === null ? null : Number(g.key)))),
        }))
      })
      .catch((e: Error) => setErrore(e.message))
  }, [])

  const indice = useMemo(
    () => (dataset ? costruisciIndice(dataset.proposte, dataset.esistenti) : []),
    [dataset]
  )

  const filtrati = useMemo(() => {
    if (!dataset) return []
    return dataset.proposte.features.filter(
      (f) =>
        filtri.scenari.has(f.properties.scenario) && filtri.tipi.has(f.properties.tipoId)
    )
  }, [dataset, filtri])

  const lenFiltrata = useMemo(
    () => filtrati.reduce((a, f) => a + f.properties.len, 0),
    [filtrati]
  )

  const segmento = useMemo(
    () =>
      dataset && selezionato != null
        ? (dataset.proposte.features.find((f) => f.properties.id === selezionato) ?? null)
        : null,
    [dataset, selezionato]
  )

  const omonimi = useMemo(() => {
    if (!dataset || !segmento) return []
    return dataset.proposte.features.filter(
      (f) =>
        f.properties.nome === segmento.properties.nome &&
        f.properties.id !== segmento.properties.id
    )
  }, [dataset, segmento])

  if (errore) {
    return (
      <div className="grid h-full place-items-center p-6">
        <Card className="max-w-md gap-2 p-6 text-center">
          <TriangleAlert className="mx-auto size-8 text-muted-foreground" />
          <h1 className="text-base font-semibold">Dati non caricati</h1>
          <p className="text-sm text-muted-foreground">{errore}</p>
        </Card>
      </div>
    )
  }

  const filtriAttivi =
    !!dataset &&
    (filtri.scenari.size !== TUTTI_SCENARI.length ||
      filtri.tipi.size !== dataset.meta.proposte.perTipo.length)

  const toggleScenario = (s: Scenario) =>
    setFiltri((f) => {
      const scenari = new Set(f.scenari)
      if (scenari.has(s)) scenari.delete(s)
      else scenari.add(s)
      return { ...f, scenari }
    })

  const toggleTipo = (t: TipoId) =>
    setFiltri((f) => {
      const tipi = new Set(f.tipi)
      if (tipi.has(t)) tipi.delete(t)
      else tipi.add(t)
      return { ...f, tipi }
    })

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full flex-col">
        <header className="z-20 flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2.5">
          <div className="mr-auto min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold">
                Corsie preferenziali di Roma
              </h1>
              <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                bozza
              </Badge>
            </div>
            <p className="truncate text-[11px] text-muted-foreground">
              Rete proposta su tre scenari di priorità, a confronto con quella esistente
            </p>
          </div>
          {dataset && (
            <StreetSearch
              indice={indice}
              onSceltaLocale={(voce) => {
                mappa.current?.evidenzia(voce.proposte, voce.esistenti)
                mappa.current?.inquadra(voce.bbox)
                setSelezionato(voce.proposte.length === 1 ? voce.proposte[0] : null)
              }}
              onSceltaRemota={(r) => {
                mappa.current?.pulisciEvidenza()
                setSelezionato(null)
                if (r.bbox) mappa.current?.inquadra(r.bbox, 17)
                else mappa.current?.volaSu(r.lon, r.lat)
              }}
            />
          )}
          <ThemeToggle scuro={scuro} onAlterna={alterna} />
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(320px,380px)_1fr]">
          {/* Pannello: su schermi stretti scorre sotto la mappa. */}
          <aside className="order-2 flex min-h-0 flex-col border-t lg:order-1 lg:border-t-0 lg:border-r">
            {!dataset ? (
              <div className="grid gap-3 p-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : (
              <Tabs defaultValue="panoramica" className="flex min-h-0 flex-1 flex-col gap-0">
                <TabsList className="mx-4 mt-3 grid w-auto grid-cols-2">
                  <TabsTrigger value="panoramica">Panoramica</TabsTrigger>
                  <TabsTrigger value="segmenti">
                    Segmenti
                    <span className="tabular ml-1.5 text-[11px] text-muted-foreground">
                      {formattaNumero(filtrati.length)}
                    </span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="panoramica" className="min-h-0 flex-1">
                  <ScrollArea className="h-full">
                    <div className="grid gap-3 p-4">
                      <StatTiles
                        meta={dataset.meta}
                        lenFiltrata={lenFiltrata}
                        nFiltrati={filtrati.length}
                        filtriAttivi={filtriAttivi}
                        nStrade={indice.length}
                      />

                      {segmento && (
                        <SegmentDetail
                          segmento={segmento}
                          omonimi={omonimi}
                          onChiudi={() => {
                            setSelezionato(null)
                            mappa.current?.pulisciEvidenza()
                          }}
                          onInquadra={() =>
                            mappa.current?.inquadra(bboxDiFeature([segmento]), 17)
                          }
                          onVaiA={(id) => setSelezionato(id)}
                        />
                      )}

                      <ScenarioControl
                        perScenario={dataset.meta.proposte.perScenario}
                        totale={dataset.meta.proposte.len}
                        attivi={filtri.scenari}
                        onToggle={toggleScenario}
                      />

                      <TypeControl
                        perTipo={dataset.meta.proposte.perTipo}
                        glosse={dataset.meta.glosse}
                        attivi={filtri.tipi}
                        onToggle={toggleTipo}
                      />

                      <NotaFonte qualita={dataset.meta.qualita} />
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="segmenti" className="mt-3 min-h-0 flex-1">
                  <SegmentTable
                    segmenti={filtrati}
                    selezionato={selezionato}
                    onSeleziona={(id) => {
                      setSelezionato(id)
                      const f = dataset.proposte.features.find((x) => x.properties.id === id)
                      if (f) mappa.current?.inquadra(bboxDiFeature([f]), 17)
                    }}
                  />
                </TabsContent>
              </Tabs>
            )}
          </aside>

          <main className="relative order-1 min-h-[45vh] lg:order-2">
            {dataset && (
              <>
                <MapView
                  ref={mappa}
                  dataset={dataset}
                  filtri={filtri}
                  scuro={scuro}
                  selezionato={selezionato}
                  onSelezione={setSelezionato}
                />
                <div className="pointer-events-none absolute top-3 left-3 z-10">
                  <Legend
                    mostraEsistenti={filtri.mostraEsistenti}
                    onToggleEsistenti={() =>
                      setFiltri((f) => ({ ...f, mostraEsistenti: !f.mostraEsistenti }))
                    }
                  />
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}

/**
 * I limiti del dato di partenza sono dichiarati, non nascosti: chi legge la
 * dashboard deve sapere che metà dei chilometri non ha una tipologia assegnata.
 */
function NotaFonte({ qualita }: { qualita: Meta['qualita'] }) {
  const { kmSenzaTipo, segmentiSotto5m, maxLen, maxTratti, nomiConPiuGrafie, nomiDistinti } =
    qualita
  return (
    <Card className="gap-2 border-dashed px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        <Info className="size-3" />
        Sul dato
      </div>
      <ul className="grid gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <li>
          <strong className="font-medium text-foreground">{formattaKm(kmSenzaTipo)}</strong> di
          proposte non hanno tipologia assegnata nel campo Ty_CP.
        </li>
        <li>
          <Tooltip>
            <TooltipTrigger className="cursor-help text-left underline decoration-dotted underline-offset-2">
              {nomiConPiuGrafie} nomi su {nomiDistinti} compaiono con grafie diverse.
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              Nel dato originale la stessa strada è scritta in più modi — «Via Tiburtina»,
              «via tiburtina» e «VIA TIBURTINA» sono tre record distinti — con doppi spazi e
              apostrofi incoerenti. La ricerca normalizza i nomi, quindi qui la strada resta
              una sola; in QGIS restano da uniformare.
            </TooltipContent>
          </Tooltip>
        </li>
        <li>
          Le lunghezze sono calcolate qui dalla geometria: l'export di origine non le
          contiene.
        </li>
        <li>
          <Tooltip>
            <TooltipTrigger className="cursor-help text-left underline decoration-dotted underline-offset-2">
              {segmentiSotto5m} geometrie sotto i 5 m e un segmento da{' '}
              {formattaKm(maxLen)} in {maxTratti} parti.
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              Anomalie del dato di partenza: le prime sono probabili residui di
              digitalizzazione, l'ultima sembra l'unione di più strade in una sola
              feature. Vanno verificate in QGIS, non qui.
            </TooltipContent>
          </Tooltip>
        </li>
        <li className="pt-1">
          Fonte: export qgis2web di{' '}
          <a
            className="underline decoration-dotted underline-offset-2 hover:text-foreground"
            href="https://github.com/mobilitaincitta"
            target="_blank"
            rel="noreferrer"
          >
            Mobilità in Città
          </a>
          , conservato in <code className="text-[10px]">legacy/</code>.
        </li>
      </ul>
    </Card>
  )
}
