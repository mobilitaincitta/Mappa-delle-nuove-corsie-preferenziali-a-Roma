import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'

import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formattaLunghezza, formattaNumero } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Feature, PropProposta } from '@/lib/types'

type Colonna = 'nome' | 'scenario' | 'len'

interface Props {
  segmenti: Feature<PropProposta>[]
  selezionato: number | null
  onSeleziona: (id: number) => void
}

const CLASSE_SFONDO: Record<number, string> = { 1: 'bg-sc1', 2: 'bg-sc2', 3: 'bg-sc3' }

/**
 * La vista tabellare è anche il rimedio previsto per i gradini più chiari della
 * rampa, che sulla superficie chiara stanno sotto 3:1 di contrasto: qui ogni
 * segmento è leggibile per nome e numero, non per colore.
 */
export function SegmentTable({ segmenti, selezionato, onSeleziona }: Props) {
  const [colonna, setColonna] = useState<Colonna>('len')
  const [discendente, setDiscendente] = useState(true)

  const ordinati = useMemo(() => {
    const copia = [...segmenti]
    copia.sort((a, b) => {
      let d: number
      if (colonna === 'nome') {
        d = a.properties.nome.localeCompare(b.properties.nome, 'it')
      } else if (colonna === 'scenario') {
        d = a.properties.scenario - b.properties.scenario || b.properties.len - a.properties.len
      } else {
        d = a.properties.len - b.properties.len
      }
      return discendente ? -d : d
    })
    return copia
  }, [segmenti, colonna, discendente])

  const ordina = (c: Colonna) => {
    if (c === colonna) {
      setDiscendente((v) => !v)
    } else {
      setColonna(c)
      setDiscendente(c === 'len')
    }
  }

  if (!segmenti.length) {
    return (
      <div className="px-4 py-10 text-center text-sm text-muted-foreground">
        Nessun segmento corrisponde ai filtri attivi.
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <Table className="text-[13px]">
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow className="hover:bg-transparent">
            <Intestazione
              attiva={colonna === 'nome'}
              discendente={discendente}
              onClick={() => ordina('nome')}
            >
              Strada
            </Intestazione>
            <Intestazione
              attiva={colonna === 'scenario'}
              discendente={discendente}
              onClick={() => ordina('scenario')}
              className="w-20"
            >
              Sc.
            </Intestazione>
            <Intestazione
              attiva={colonna === 'len'}
              discendente={discendente}
              onClick={() => ordina('len')}
              className="w-24 text-right"
            >
              Lunghezza
            </Intestazione>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordinati.map((f) => {
            const p = f.properties
            return (
              <TableRow
                key={p.id}
                onClick={() => onSeleziona(p.id)}
                className={cn(
                  'cursor-pointer',
                  selezionato === p.id && 'bg-accent hover:bg-accent'
                )}
              >
                <TableCell className="max-w-0">
                  <div className="truncate font-medium">{p.nome}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {p.glossa ?? p.tipo ?? 'tipologia non indicata'}
                    {p.tratti > 1 && ` · ${formattaNumero(p.tratti)} tratti`}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn('size-2 shrink-0 rounded-full', CLASSE_SFONDO[p.scenario])}
                      aria-hidden
                    />
                    <span className="tabular">{p.scenario}</span>
                  </span>
                </TableCell>
                <TableCell className="tabular text-right">
                  {formattaLunghezza(p.len)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </ScrollArea>
  )
}

function Intestazione({
  children,
  attiva,
  discendente,
  onClick,
  className,
}: {
  children: React.ReactNode
  attiva: boolean
  discendente: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <TableHead className={cn('h-9', className)}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1 text-xs font-medium transition-colors hover:text-foreground',
          attiva ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {children}
        {attiva &&
          (discendente ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
      </button>
    </TableHead>
  )
}
