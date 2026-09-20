import { Eye, EyeOff, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ModoAnalisi } from '@/lib/types'
import { SCALE } from '@/lib/analisi'

interface Props {
  mostraEsistenti: boolean
  onToggleEsistenti: () => void
  mostraMetro: boolean
  onToggleMetro: () => void
  analisi: ModoAnalisi
  onCambiaAnalisi: (modo: ModoAnalisi) => void
  caricandoAnalisi: boolean
}



/** Le tre linee, con i colori della segnaletica presi dai token CSS. */
const LINEE_METRO = [
  { ref: 'A', variabile: 'var(--metro-a)' },
  { ref: 'B', variabile: 'var(--metro-b)' },
  { ref: 'C', variabile: 'var(--metro-c)' },
]

/**
 * Legenda sovrapposta alla mappa. L'identità non è mai affidata al solo colore:
 * ogni voce ha il campione accanto al testo, e le due corsie esistenti si
 * distinguono per tratteggio.
 */
export function Legend({
  mostraEsistenti,
  onToggleEsistenti,
  mostraMetro,
  onToggleMetro,
  analisi,
  onCambiaAnalisi,
  caricandoAnalisi,
}: Props) {
  const scala = analisi === 'nessuna' ? null : SCALE[analisi]
  return (
    <div className="pointer-events-auto w-[246px] rounded-lg border bg-card/95 p-3 shadow-sm backdrop-blur-sm">
      <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Corsie preferenziali proposte
      </div>
      <div className="mt-2 grid gap-1.5">
        <Voce classe="bg-sc1" testo="Scenario 1" nota="prima priorità" />
        <Voce classe="bg-sc2" testo="Scenario 2" nota="seconda priorità" />
        <Voce classe="bg-sc3" testo="Scenario 3" nota="terza priorità" />
      </div>

      {/* Il titolo ora va a capo: lascialo crescere e tieni fermo il comando. */}
      <div className="mt-3 flex items-start justify-between gap-2 border-t pt-2.5">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Corsie preferenziali esistenti
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleEsistenti}
          className="-mt-0.5 -mr-1.5 h-6 shrink-0 gap-1 px-1.5 text-[11px] font-normal text-muted-foreground"
          aria-pressed={mostraEsistenti}
        >
          {mostraEsistenti ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
          {mostraEsistenti ? 'visibili' : 'nascoste'}
        </Button>
      </div>
      <div className={cn('mt-1.5 grid gap-1.5', !mostraEsistenti && 'opacity-40')}>
        <Voce classe="bg-existing" testo="Promiscuo" />
        <Voce classe="bg-existing" testo="Tram" tratteggiata />
      </div>

      {/* La metropolitana non fa parte del piano: è il riferimento con cui si
          legge la mappa, quindi ha una riga propria e si può spegnere. */}
      <div className="mt-3 flex items-center justify-between border-t pt-2.5">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Metropolitana
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleMetro}
          className="-mr-1.5 h-6 gap-1 px-1.5 text-[11px] font-normal text-muted-foreground"
          aria-pressed={mostraMetro}
        >
          {mostraMetro ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
          {mostraMetro ? 'visibile' : 'nascosta'}
        </Button>
      </div>
      <div className={cn('mt-1.5 flex items-center gap-1.5', !mostraMetro && 'opacity-40')}>
        {LINEE_METRO.map((l) => (
          <span
            key={l.ref}
            className="metro-bollino"
            style={{ backgroundColor: l.variabile }}
            title={`Linea ${l.ref}`}
          >
            {l.ref}
          </span>
        ))}
        <span className="ml-0.5 text-[10px] text-muted-foreground">linee e stazioni</span>
      </div>

      {/* I due strati colorano gli stessi segmenti: si scelgono, non si
          sommano, quindi un selettore a tre stati e non due interruttori. */}
      <div className="mt-3 border-t pt-2.5">
        <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Analisi dei segmenti bus
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-md bg-muted p-0.5">
          {(
            [
              ['nessuna', 'Nessuna'],
              ['velocita', 'Velocità'],
              ['benefit', 'Benefit'],
            ] as [ModoAnalisi, string][]
          ).map(([modo, etichetta]) => (
            <button
              key={modo}
              type="button"
              onClick={() => onCambiaAnalisi(modo)}
              aria-pressed={analisi === modo}
              className={cn(
                'rounded-[5px] px-1.5 py-1 text-[11px] transition-colors',
                analisi === modo
                  ? 'bg-card font-medium shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {etichetta}
            </button>
          ))}
        </div>

        {caricandoAnalisi && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Carico i segmenti…
          </div>
        )}

        {scala && !caricandoAnalisi && (
          <div className="mt-2">
            <div className="text-[11px] text-muted-foreground">
              {scala.titolo}
              <span className="ml-1 opacity-70">({scala.unita})</span>
            </div>
            <div className="mt-1.5 grid gap-1">
              {scala.etichette.map((testo, i) => (
                <div key={testo} className="flex items-center gap-2">
                  <span
                    className="h-0.5 w-5 shrink-0 rounded-full"
                    style={{ backgroundColor: scala.tinte[i] }}
                  />
                  <span className="text-xs">{testo}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>


    </div>
  )
}

function Voce({
  classe,
  testo,
  nota,
  tratteggiata,
}: {
  classe: string
  testo: string
  nota?: string
  tratteggiata?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      {tratteggiata ? (
        <span className="flex h-0.5 w-5 shrink-0 gap-[3px]">
          {[0, 1, 2].map((i) => (
            <span key={i} className={cn('h-full flex-1 rounded-full', classe)} />
          ))}
        </span>
      ) : (
        <span className={cn('h-0.5 w-5 shrink-0 rounded-full', classe)} />
      )}
      <span className="text-xs">{testo}</span>
      {nota && <span className="text-[10px] text-muted-foreground">{nota}</span>}
    </div>
  )
}
