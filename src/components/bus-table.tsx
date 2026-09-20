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
import { classe, type Scala } from '@/lib/analisi'
import { formattaLunghezza, formattaNumero } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Feature, PropVelocita } from '@/lib/types'

type Colonna = 'valore' | 'nome' | 'len'

interface Props {
  segmenti: Feature<PropVelocita>[]
  scala: Scala
  selezionati: Set<number>
  onSeleziona: (id: number) => void
}

/**
 * Quante righe si disegnano davvero.
 *
 * I segmenti osservati sono quasi 4000: metterli tutti nel DOM rende lo
 * scorrimento a scatti per una lista che nessuno legge fino in fondo. La lista
 * serve a leggere gli estremi — i più lenti, i più promettenti — e quelli
 * stanno in cima appena si ordina. Chi cerca qualcosa in mezzo restringe con i
 * filtri di classe, che agiscono anche qui.
 */
const RIGHE_MASSIME = 300

/**
 * Soglia dei «molto lenti», applicata alla sola lista.
 *
 * Sotto i 5 km/h stanno 500 segmenti e 201 km — un ottavo della rete — che
 * dentro la fascia 0-10 non si distinguono. Restano lì anche nella scala dei
 * colori, perché spezzare la classificazione cambierebbe la lettura della mappa
 * per tutti: qui è solo un modo di scorrere l'elenco.
 */
const SOGLIA_LENTI = 5

export function BusTable({ segmenti, scala, selezionati, onSeleziona }: Props) {
  const [soloLenti, setSoloLenti] = useState(false)
  const [colonna, setColonna] = useState<Colonna>('valore')
  // L'ordine di partenza è quello che risponde alla domanda dello strato: nella
  // velocità interessano i più lenti, nel benefit i punteggi più alti.
  const [discendente, setDiscendente] = useState(scala.campo === 'ben')

  const elencabili = useMemo(
    () =>
      scala.campo === 'vel' && soloLenti
        ? segmenti.filter((f) => f.properties.vel < SOGLIA_LENTI)
        : segmenti,
    [segmenti, scala.campo, soloLenti]
  )

  const ordinati = useMemo(() => {
    const copia = [...elencabili]
    copia.sort((a, b) => {
      let d: number
      if (colonna === 'nome') {
        d = (a.properties.nome ?? '').localeCompare(b.properties.nome ?? '', 'it')
      } else if (colonna === 'len') {
        d = a.properties.len - b.properties.len
      } else {
        d = a.properties[scala.campo] - b.properties[scala.campo]
      }
      return discendente ? -d : d
    })
    return copia
  }, [elencabili, colonna, discendente, scala.campo])

  const ordina = (c: Colonna) => {
    if (c === colonna) setDiscendente((v) => !v)
    else {
      setColonna(c)
      // Su una grandezza si parte dal più grande, su un nome dalla A.
      setDiscendente(c !== 'nome')
    }
  }

  const mostrati = ordinati.slice(0, RIGHE_MASSIME)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {scala.campo === 'vel' && (
        <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
          <button
            type="button"
            onClick={() => setSoloLenti((v) => !v)}
            aria-pressed={soloLenti}
            className={cn(
              'rounded-md border px-2 py-1 text-[11px] transition-colors',
              soloLenti
                ? 'border-transparent bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Solo sotto {SOGLIA_LENTI} km/h
          </button>
          <span className="text-[11px] text-muted-foreground">
            {formattaNumero(elencabili.length)} segmenti
          </span>
        </div>
      )}

      {!ordinati.length ? (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          Nessun segmento con questi filtri.
        </div>
      ) : (
      <ScrollArea className="min-h-0 flex-1">
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
                attiva={colonna === 'valore'}
                discendente={discendente}
                onClick={() => ordina('valore')}
                className="w-24 text-right"
              >
                {scala.campo === 'vel' ? 'km/h' : 'Benefit'}
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
            {mostrati.map((f) => {
              const p = f.properties
              const valore = p[scala.campo]
              return (
                <TableRow
                  key={p.id}
                  onClick={() => onSeleziona(p.id)}
                  className={cn(
                    'cursor-pointer',
                    selezionati.has(p.id) && 'bg-accent hover:bg-accent'
                  )}
                >
                  <TableCell className="max-w-0">
                    <div className="truncate font-medium">
                      {p.nome ?? 'Strada non indicata'}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {p.da} → {p.a}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="flex items-center justify-end gap-1.5">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: scala.tinte[classe(scala, valore)] }}
                        aria-hidden
                      />
                      <span className="tabular">
                        {scala.campo === 'vel'
                          ? valore.toFixed(1).replace('.', ',')
                          : valore}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="tabular text-right text-muted-foreground">
                    {formattaLunghezza(p.len)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </ScrollArea>
      )}

      {ordinati.length > RIGHE_MASSIME && (
        <p className="shrink-0 border-t px-3 py-2 text-[11px] text-muted-foreground">
          Primi {formattaNumero(RIGHE_MASSIME)} di {formattaNumero(ordinati.length)}.
          Spegni delle classi per restringere.
        </p>
      )}
    </div>
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
  const Freccia = discendente ? ArrowDown : ArrowUp
  return (
    <TableHead className={cn('h-9', className)}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1 text-[11px] font-medium tracking-wide uppercase',
          attiva ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {children}
        {attiva && <Freccia className="size-3" />}
      </button>
    </TableHead>
  )
}
