import { Card } from '@/components/ui/card'
import { formattaKm, formattaPercento, descrizioneScenario } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { GruppoKm, Scenario } from '@/lib/types'

interface Props {
  perScenario: GruppoKm[]
  totale: number
  attivi: Set<Scenario>
  onToggle: (s: Scenario) => void
}

const CLASSE_SFONDO: Record<number, string> = { 1: 'bg-sc1', 2: 'bg-sc2', 3: 'bg-sc3' }

/**
 * Composizione della rete per priorità di attuazione.
 *
 * Una barra unica divisa in tre, non tre barre affiancate: la domanda è "come si
 * ripartisce il piano", che è una composizione di un intero. I tre gradini sono
 * la stessa tonalità perché lo scenario è una scala ordinata, e le righe sotto
 * fanno da legenda e da filtro insieme.
 */
export function ScenarioControl({ perScenario, totale, attivi, onToggle }: Props) {
  return (
    <Card className="gap-3 px-4 py-3.5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Priorità di attuazione</h2>
        <span className="text-[11px] text-muted-foreground">{formattaKm(totale)} in totale</span>
      </div>

      {/* 2 px di superficie tra i segmenti: senza lo stacco i gradini della
          stessa tonalità si leggono come una banda continua. */}
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
        {perScenario.map((g) => {
          const scenario = Number(g.key)
          const spento = !attivi.has(scenario as Scenario)
          return (
            <button
              key={scenario}
              type="button"
              onClick={() => onToggle(scenario as Scenario)}
              style={{ flexGrow: g.len }}
              title={`Scenario ${scenario} — ${formattaKm(g.len)}`}
              aria-label={`Mostra o nascondi lo scenario ${scenario}`}
              className={cn(
                'h-full min-w-1 cursor-pointer rounded-full transition-opacity first:rounded-l-full last:rounded-r-full',
                CLASSE_SFONDO[scenario],
                spento && 'opacity-20'
              )}
            />
          )
        })}
      </div>

      <div className="grid gap-1">
        {perScenario.map((g) => {
          const scenario = Number(g.key) as Scenario
          const acceso = attivi.has(scenario)
          return (
            <button
              key={scenario}
              type="button"
              onClick={() => onToggle(scenario)}
              aria-pressed={acceso}
              className={cn(
                'group flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-accent/60',
                !acceso && 'opacity-45'
              )}
            >
              <span
                className={cn(
                  'size-2.5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15',
                  CLASSE_SFONDO[scenario]
                )}
              />
              <span className="min-w-0 flex-1 truncate text-[13px]">
                Scenario {scenario}
                <span className="ml-1.5 text-[11px] text-muted-foreground">
                  {descrizioneScenario[scenario]}
                </span>
              </span>
              <span className="tabular shrink-0 text-[13px] font-medium">
                {formattaKm(g.len)}
              </span>
              <span className="tabular w-9 shrink-0 text-right text-[11px] text-muted-foreground">
                {formattaPercento(g.len, totale)}
              </span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
