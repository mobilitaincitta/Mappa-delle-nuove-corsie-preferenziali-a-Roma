import { Eye, EyeOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SCALE } from '@/lib/analisi'
import type { ModoAnalisi } from '@/lib/types'

interface Props {
  analisi: ModoAnalisi
  mostraEsistenti: boolean
  onToggleEsistenti: () => void
  mostraMetro: boolean
  onToggleMetro: () => void
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
  analisi,
  mostraEsistenti,
  onToggleEsistenti,
  mostraMetro,
  onToggleMetro,
}: Props) {
  return (
    <div className="pointer-events-auto w-[246px] rounded-lg border bg-card/95 p-3 shadow-sm backdrop-blur-sm">
      {/* Con un'analisi accesa le corsie non sono in mappa: al loro posto va la
          scala di ciò che è disegnato davvero. Serve soprattutto a pannello
          chiuso, quando questa è l'unica legenda rimasta. */}
      {analisi === 'scenario' ? (
        <>
          <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Corsie preferenziali proposte
          </div>
          <div className="mt-2 grid gap-1.5">
            <Voce classe="bg-sc1" testo="Scenario 1" nota="prima priorità" />
            <Voce classe="bg-sc2" testo="Scenario 2" nota="seconda priorità" />
            <Voce classe="bg-sc3" testo="Scenario 3" nota="terza priorità" />
          </div>
        </>
      ) : (
        <>
          <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {SCALE[analisi].titolo}
          </div>
          <div className="mt-2 grid gap-1.5">
            {SCALE[analisi].etichette.map((testo, i) => (
              <Voce
                key={testo}
                tinta={SCALE[analisi].tinte[i]}
                testo={testo}
                nota={i === 0 ? SCALE[analisi].unita : undefined}
              />
            ))}
          </div>
        </>
      )}

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

    </div>
  )
}

function Voce({
  classe,
  tinta,
  testo,
  nota,
  tratteggiata,
}: {
  classe?: string
  /** Colore diretto, per le scale che non hanno una classe Tailwind. */
  tinta?: string
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
        <span
          className={cn('h-0.5 w-5 shrink-0 rounded-full', classe)}
          style={tinta ? { backgroundColor: tinta } : undefined}
        />
      )}
      <span className="text-xs">{testo}</span>
      {nota && <span className="text-[10px] text-muted-foreground">{nota}</span>}
    </div>
  )
}
