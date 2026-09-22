import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formattaKm, formattaLunghezza, formattaNumero } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Feature, PropProposta } from '@/lib/types'

const CLASSE_SFONDO: Record<number, string> = { 1: 'bg-sc1', 2: 'bg-sc2', 3: 'bg-sc3' }

/**
 * Riepilogo di più tratti scelti insieme.
 *
 * Con una selezione multipla la domanda non è più «cos'è questo tratto» ma
 * «quanto pesano insieme»: quindi in evidenza vanno i km totali, e la
 * ripartizione per priorità dice se la selezione è omogenea o mescola lotti
 * diversi.
 */
export function SelezioneScenari({
  segmenti,
  onChiudi,
}: {
  segmenti: Feature<PropProposta>[]
  onChiudi: () => void
}) {
  const metri = segmenti.reduce((a, f) => a + f.properties.len, 0)
  const perScenario = [1, 2, 3].map((s) => ({
    scenario: s,
    metri: segmenti
      .filter((f) => f.properties.scenario === s)
      .reduce((a, f) => a + f.properties.len, 0),
  }))

  return (
    <Card className="gap-0 px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Selezione
          </div>
          <h2 className="mt-0.5 text-sm leading-snug font-semibold">
            {formattaNumero(segmenti.length)} tratti &middot; {formattaKm(metri)}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onChiudi}
          className="-mt-1 -mr-1.5 size-7 shrink-0 text-muted-foreground"
          aria-label="Azzera la selezione"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="mt-2.5 flex items-center gap-3 text-[12px]">
        {perScenario
          .filter((s) => s.metri > 0)
          .map((s) => (
            <span key={s.scenario} className="flex items-center gap-1.5">
              <span
                className={cn('size-2 shrink-0 rounded-full', CLASSE_SFONDO[s.scenario])}
                aria-hidden
              />
              <span className="tabular">{formattaKm(s.metri)}</span>
              <span className="text-muted-foreground">pr. {s.scenario}</span>
            </span>
          ))}
      </div>

      <Separator className="my-3" />

      <ul className="grid max-h-40 gap-1 overflow-auto text-[12px]">
        {segmenti.map((f) => (
          <li key={f.properties.id} className="flex items-center gap-2">
            <span
              className={cn(
                'size-1.5 shrink-0 rounded-full',
                CLASSE_SFONDO[f.properties.scenario]
              )}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate">{f.properties.nome}</span>
            <span className="tabular shrink-0 text-muted-foreground">
              {formattaLunghezza(f.properties.len)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
