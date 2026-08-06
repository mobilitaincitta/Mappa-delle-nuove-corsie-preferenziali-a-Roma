import { AlertTriangle } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formattaKm, formattaNumero } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { GruppoKm, Meta, TipoId } from '@/lib/types'

interface Props {
  perTipo: GruppoKm[]
  glosse: Meta['glosse']
  attivi: Set<TipoId>
  onToggle: (t: TipoId) => void
}

/**
 * Tipologia di corsia: confronto di grandezze tra categorie senza ordine, quindi
 * barre orizzontali di un solo colore. Colorare sei categorie diverse qui
 * significherebbe far competere quei colori con la scala di priorità, che è
 * l'informazione principale della mappa.
 *
 * Ogni riga è anche il filtro della propria categoria: la barra dà la grandezza,
 * il click la accende o la spegne.
 */
export function TypeControl({ perTipo, glosse, attivi, onToggle }: Props) {
  const massimo = Math.max(...perTipo.map((g) => g.len), 1)
  const senzaTipo = perTipo.find((g) => g.key === null)

  return (
    <Card className="gap-3 px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">Tipologia di corsia</h2>
        {senzaTipo && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex cursor-help items-center gap-1 text-[11px] text-muted-foreground">
                <AlertTriangle className="size-3" />
                dato incompleto
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              Il campo Ty_CP è vuoto su {formattaNumero(senzaTipo.n)} dei{' '}
              {formattaNumero(perTipo.reduce((a, g) => a + g.n, 0))} segmenti proposti, pari a{' '}
              {formattaKm(senzaTipo.len)}. Quei tratti esistono nel piano ma non hanno una
              tipologia assegnata nel dato di partenza.
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="grid gap-0.5">
        {perTipo.map((g) => {
          const tipo = g.key === null ? null : Number(g.key)
          const acceso = attivi.has(tipo)
          const etichetta =
            tipo === null ? 'Tipologia non indicata' : (glosse[String(tipo)] ?? `Tipo ${tipo}`)
          return (
            <button
              key={String(g.key)}
              type="button"
              onClick={() => onToggle(tipo)}
              aria-pressed={acceso}
              title={etichetta}
              className={cn(
                'grid grid-cols-[1fr_auto] gap-x-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-accent/60',
                !acceso && 'opacity-45'
              )}
            >
              <span
                className={cn(
                  'min-w-0 truncate text-[13px]',
                  tipo === null && 'text-muted-foreground italic'
                )}
              >
                {etichetta}
              </span>
              <span className="tabular shrink-0 text-[13px] font-medium">
                {formattaKm(g.len)}
              </span>
              <span className="col-span-2 mt-1 flex items-center gap-2">
                {/* Estremo del dato arrotondato e ancorato alla linea di base. */}
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn(
                      'block h-full rounded-full',
                      tipo === null ? 'bg-muted-foreground/40' : 'bg-sc2'
                    )}
                    style={{ width: `${Math.max((g.len / massimo) * 100, 1.5)}%` }}
                  />
                </span>
                <span className="tabular w-14 shrink-0 text-right text-[11px] text-muted-foreground">
                  {formattaNumero(g.n)} tratti
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
