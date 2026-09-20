import { useEffect, useMemo, useRef, useState } from 'react'
import { TriangleAlert } from 'lucide-react'

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

import { MapView, type MapHandle } from '@/components/map-view'
import { AnalisiControl } from '@/components/analisi-control'
import { AnalisiPanel } from '@/components/analisi-panel'
import { SCALE } from '@/lib/analisi'
import { StreetSearch } from '@/components/street-search'
import { StatTiles } from '@/components/stat-tiles'
import { ScenarioControl } from '@/components/scenario-control'
import { SegmentDetail } from '@/components/segment-detail'
import { SegmentTable } from '@/components/segment-table'
import { Legend } from '@/components/legend'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TooltipProvider } from '@/components/ui/tooltip'

import { caricaDataset, caricaVelocita } from '@/lib/dataset'
import { costruisciIndice, bboxDiFeature } from '@/lib/streets'
import { formattaNumero } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Dataset, Filtri, ModoAnalisi, Scenario, Velocita } from '@/lib/types'

const TUTTI_SCENARI: Scenario[] = [1, 2, 3]

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [selezionato, setSelezionato] = useState<number | null>(null)
  const [selezionatoBus, setSelezionatoBus] = useState<number | null>(null)
  const [pannelloAperto, setPannelloAperto] = useState(true)
  const mappa = useRef<MapHandle>(null)

  const [filtri, setFiltri] = useState<Filtri>({
    scenari: new Set(TUTTI_SCENARI),
    mostraEsistenti: true,
    mostraMetro: true,
    analisi: 'scenario',
  })

  // I segmenti osservati pesano 1,4 MB: si scaricano alla prima accensione di
  // uno dei due strati, una volta sola, e restano per il resto della sessione.
  const [velocita, setVelocita] = useState<Velocita | null>(null)
  const [caricandoAnalisi, setCaricandoAnalisi] = useState(false)

  /** Cambiando analisi cambia il soggetto: la selezione precedente non vale più. */
  const cambiaAnalisi = (modo: ModoAnalisi) => {
    setFiltri((f) => ({ ...f, analisi: modo }))
    setSelezionato(null)
    setSelezionatoBus(null)
    mappa.current?.pulisciEvidenza()
    if (modo === 'scenario' || velocita || caricandoAnalisi) return
    setCaricandoAnalisi(true)
    caricaVelocita()
      .then(setVelocita)
      .catch((e: Error) => setErrore(e.message))
      .finally(() => setCaricandoAnalisi(false))
  }

  useEffect(() => {
    caricaDataset()
      .then(setDataset)
      .catch((e: Error) => setErrore(e.message))
  }, [])

  const indice = useMemo(
    () => (dataset ? costruisciIndice(dataset.proposte, dataset.esistenti) : []),
    [dataset]
  )

  const filtrati = useMemo(() => {
    if (!dataset) return []
    return dataset.proposte.features.filter((f) =>
      filtri.scenari.has(f.properties.scenario)
    )
  }, [dataset, filtri])

  /**
   * I km sono quelli dichiarati dal piano in meta, non la somma delle geometrie
   * della bozza. Il filtro agisce solo sulla priorità, quindi la selezione è
   * sempre l'unione di scenari interi e il conto torna con il totale.
   */
  const lenFiltrata = useMemo(() => {
    if (!dataset) return 0
    return dataset.meta.proposte.perScenario
      .filter((g) => filtri.scenari.has(Number(g.key) as Scenario))
      .reduce((acc, g) => acc + g.len, 0)
  }, [dataset, filtri])

  const segmento = useMemo(
    () =>
      dataset && selezionato != null
        ? (dataset.proposte.features.find((f) => f.properties.id === selezionato) ?? null)
        : null,
    [dataset, selezionato]
  )

  const segmentoBus = useMemo(
    () =>
      velocita && selezionatoBus != null
        ? (velocita.features.find((f) => f.properties.id === selezionatoBus) ?? null)
        : null,
    [velocita, selezionatoBus]
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

  const filtriAttivi = !!dataset && filtri.scenari.size !== TUTTI_SCENARI.length

  const toggleScenario = (s: Scenario) =>
    setFiltri((f) => {
      const scenari = new Set(f.scenari)
      if (scenari.has(s)) scenari.delete(s)
      else scenari.add(s)
      return { ...f, scenari }
    })

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full flex-col">
        <header className="z-20 flex shrink-0 flex-wrap items-center gap-2 bg-[var(--brand-fondo)] px-4 py-2.5 text-white">
          {/* Il pannello si chiude: incorporata in una colonna stretta, o su
              uno schermo piccolo, la mappa vale più dei numeri. */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPannelloAperto((v) => !v)}
            className="hidden size-8 shrink-0 text-white/80 hover:bg-white/15 hover:text-white lg:inline-flex"
            aria-label={pannelloAperto ? 'Chiudi il pannello' : 'Apri il pannello'}
            aria-expanded={pannelloAperto}
          >
            {pannelloAperto ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelLeftOpen className="size-4" />
            )}
          </Button>
          <div className="mr-auto min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold">
                Nuove corsie preferenziali a Roma
              </h1>
              <Badge
                variant="outline"
                className="shrink-0 border-transparent bg-[var(--brand-giallo)] text-[10px] font-medium text-[var(--brand-inchiostro)]"
              >
                bozza
              </Badge>
            </div>
            <p className="truncate text-[11px] text-white/85">
              Proposta di rete su tre scenari di priorità
            </p>
          </div>
          {dataset && (
            <StreetSearch
              classeTrigger="border-transparent bg-white text-muted-foreground shadow-sm hover:bg-white"
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
        </header>

        <div
          className={cn(
            'grid min-h-0 flex-1',
            pannelloAperto ? 'lg:grid-cols-[minmax(320px,380px)_1fr]' : 'lg:grid-cols-[0_1fr]'
          )}
        >
          {/* Pannello: su schermi stretti scorre sotto la mappa. Da chiuso
              resta nel flusso ma a larghezza zero, così non si smonta e la
              posizione di scorrimento sopravvive alla riapertura. */}
          <aside
            className={cn(
              'order-2 flex min-h-0 flex-col border-t lg:order-1 lg:border-t-0 lg:border-r',
              !pannelloAperto && 'hidden lg:flex lg:overflow-hidden lg:border-r-0'
            )}
          >
            {!dataset ? (
              <div className="grid gap-3 p-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : (
              <>
                <AnalisiControl
                  analisi={filtri.analisi}
                  onCambia={cambiaAnalisi}
                  caricando={caricandoAnalisi}
                />

                {filtri.analisi !== 'scenario' ? (
                  <ScrollArea className="min-h-0 flex-1">
                    <AnalisiPanel
                      scala={SCALE[filtri.analisi]}
                      velocita={velocita}
                      segmento={segmentoBus}
                      onChiudi={() => setSelezionatoBus(null)}
                      onInquadra={() =>
                        segmentoBus &&
                        mappa.current?.inquadra(bboxDiFeature([segmentoBus]), 17)
                      }
                    />
                  </ScrollArea>
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
              </>
            )}

            {/* Fuori dall'area che scorre: gli autori restano visibili
                qualunque analisi sia attiva e a qualunque punto della lista. */}
            <footer className="shrink-0 border-t px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">A cura di</span> Caridad
              Pineda, Matteo Collotti, Gaia Sgaramella, Giorgio Rubino, Giulia Galbiati,
              Nicola Ippolito
            </footer>
          </aside>

          <main className="relative order-1 min-h-[45vh] lg:order-2">
            {dataset && (
              <>
                <MapView
                  ref={mappa}
                  dataset={dataset}
                  velocita={velocita}
                  filtri={filtri}
                  selezionato={selezionato}
                  onSelezione={setSelezionato}
                  selezionatoBus={selezionatoBus}
                  onSelezioneBus={setSelezionatoBus}
                />
                <div className="pointer-events-none absolute top-3 left-3 z-10">
                  <Legend
                    analisi={filtri.analisi}
                    mostraEsistenti={filtri.mostraEsistenti}
                    onToggleEsistenti={() =>
                      setFiltri((f) => ({ ...f, mostraEsistenti: !f.mostraEsistenti }))
                    }
                    mostraMetro={filtri.mostraMetro}
                    onToggleMetro={() =>
                      setFiltri((f) => ({ ...f, mostraMetro: !f.mostraMetro }))
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
