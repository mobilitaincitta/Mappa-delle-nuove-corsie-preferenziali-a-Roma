import { Crosshair, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formattaLunghezza, formattaNumero } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Feature, PropProposta } from '@/lib/types'

interface Props {
  segmento: Feature<PropProposta>
  /** Altri segmenti con lo stesso nome, già esclusa la feature corrente. */
  omonimi: Feature<PropProposta>[]
  onChiudi: () => void
  onInquadra: () => void
  onVaiA: (id: number) => void
}

const CLASSE_SFONDO: Record<number, string> = { 1: 'bg-sc1', 2: 'bg-sc2', 3: 'bg-sc3' }

export function SegmentDetail({ segmento, omonimi, onChiudi, onInquadra, onVaiA }: Props) {
  const p = segmento.properties

  return (
    <Card className="gap-0 px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Segmento selezionato
          </div>
          <h2 className="mt-0.5 text-sm leading-snug font-semibold">{p.nome}</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onChiudi}
          className="-mt-1 -mr-1.5 size-7 shrink-0 text-muted-foreground"
          aria-label="Chiudi il dettaglio"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" className="gap-1.5 font-normal">
          <span
            className={cn('size-2 rounded-full', CLASSE_SFONDO[p.scenario])}
            aria-hidden
          />
          Scenario {p.scenario}
        </Badge>
        <Badge variant="outline" className="font-normal">
          {formattaLunghezza(p.len)}
        </Badge>
        {p.tratti > 1 && (
          <Badge variant="outline" className="font-normal">
            {formattaNumero(p.tratti)} tratti
          </Badge>
        )}
      </div>

      <Separator className="my-3" />

      <dl className="grid gap-2 text-[13px]">
        <Riga etichetta="Tipologia">
          {p.tipo ? (
            <span>
              {p.glossa ?? p.tipo}
              {p.glossa && (
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {p.tipo} · {p.tipoId}
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground italic">non indicata nel dato</span>
          )}
        </Riga>
        {p.len < 5 && (
          <Riga etichetta="Nota">
            <span className="text-muted-foreground">
              Geometria di lunghezza trascurabile: probabile residuo di
              digitalizzazione.
            </span>
          </Riga>
        )}
      </dl>

      <Button variant="outline" size="sm" onClick={onInquadra} className="mt-3 h-8 gap-1.5">
        <Crosshair className="size-3.5" />
        Inquadra il segmento
      </Button>

      {omonimi.length > 0 && (
        <>
          <Separator className="my-3" />
          <div className="text-[11px] text-muted-foreground">
            Altri {omonimi.length === 1 ? 'tratto' : 'tratti'} su questa strada
          </div>
          <div className="mt-1.5 grid gap-0.5">
            {omonimi.map((f) => (
              <button
                key={f.properties.id}
                type="button"
                onClick={() => onVaiA(f.properties.id)}
                className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs transition-colors hover:bg-accent/60"
              >
                <span
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    CLASSE_SFONDO[f.properties.scenario]
                  )}
                  aria-hidden
                />
                <span className="text-muted-foreground">Scenario {f.properties.scenario}</span>
                <span className="tabular ml-auto">{formattaLunghezza(f.properties.len)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}

function Riga({ etichetta, children }: { etichetta: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[86px_1fr] gap-2">
      <dt className="text-muted-foreground">{etichetta}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}
