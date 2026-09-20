import { Loader2, RotateCcw, TriangleAlert } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { ModoAnalisi } from '@/lib/types'

interface Props {
  analisi: ModoAnalisi
  onCambia: (modo: ModoAnalisi) => void
  caricando: boolean
  errore: string | null
  onRiprova: () => void
}

/**
 * Le tre analisi non sono tre strati da sommare: hanno soggetti diversi — i
 * tratti del piano la prima, i segmenti bus osservati le altre due — e il
 * pannello sotto racconta quella scelta. Per questo è un selettore e non tre
 * interruttori, e sta in cima: decide tutto ciò che viene dopo.
 */
const VOCI: [ModoAnalisi, string][] = [
  ['scenario', 'Scenario'],
  ['velocita', 'Velocità'],
  ['benefit', 'Benefit'],
]

export function AnalisiControl({ analisi, onCambia, caricando, errore, onRiprova }: Props) {
  return (
    <div className="border-b px-4 py-3">
      <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Analisi
      </div>
      <div
        role="radiogroup"
        aria-label="Analisi da mostrare"
        className="mt-2 grid grid-cols-3 gap-1 rounded-md bg-muted p-0.5"
      >
        {VOCI.map(([modo, etichetta]) => (
          <button
            key={modo}
            type="button"
            role="radio"
            aria-checked={analisi === modo}
            onClick={() => onCambia(modo)}
            className={cn(
              'rounded-[5px] px-2 py-1.5 text-[12px] transition-colors',
              analisi === modo
                ? 'bg-card font-medium shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {etichetta}
          </button>
        ))}
      </div>
      {caricando && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Carico i segmenti osservati…
        </div>
      )}
      {errore && !caricando && (
        <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-[11px]">
          <div className="flex items-start gap-1.5 text-destructive">
            <TriangleAlert className="mt-0.5 size-3 shrink-0" />
            <span>I segmenti osservati non sono arrivati: {errore}</span>
          </div>
          <button
            type="button"
            onClick={onRiprova}
            className="mt-1.5 inline-flex items-center gap-1 font-medium text-foreground hover:underline"
          >
            <RotateCcw className="size-3" />
            Riprova
          </button>
        </div>
      )}
    </div>
  )
}
