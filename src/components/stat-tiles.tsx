import { Card } from '@/components/ui/card'
import { formattaKm, formattaNumero, formattaPercento } from '@/lib/format'
import type { Meta } from '@/lib/types'

interface Props {
  meta: Meta
  /** Metri e conteggio dei soli segmenti che superano i filtri correnti. */
  lenFiltrata: number
  nFiltrati: number
  filtriAttivi: boolean
  /** Nomi di strada distinti nell'indice: cambia se i dati vengono riesportati. */
  nStrade: number
}

export function StatTiles({ meta, lenFiltrata, nFiltrati, filtriAttivi, nStrade }: Props) {
  const totale = meta.proposte.len
  const rapporto = meta.esistenti.len ? totale / meta.esistenti.len : 0

  return (
    <div className="grid gap-3">
      {/* Cifra principale: è il numero che risponde alla domanda "quanto piano
          sto guardando adesso", quindi cambia con i filtri. */}
      <Card className="gap-0 px-4 py-3.5">
        <div className="text-xs font-medium text-muted-foreground">
          {filtriAttivi ? 'Selezione corrente' : 'Rete proposta'}
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl leading-none font-semibold tracking-tight">
            {formattaKm(lenFiltrata)}
          </span>
          {filtriAttivi && (
            <span className="text-sm text-muted-foreground">
              su {formattaKm(totale)} · {formattaPercento(lenFiltrata, totale)}
            </span>
          )}
        </div>
        <div className="mt-1.5 text-xs text-muted-foreground">
          {formattaNumero(nFiltrati)} segmenti
          {!filtriAttivi && ` · ${rapporto.toFixed(1).replace('.', ',')}× la rete esistente`}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Tile
          etichetta="Corsie esistenti"
          valore={formattaKm(meta.esistenti.len)}
          nota={`${formattaNumero(meta.esistenti.n)} segmenti`}
        />
        <Tile
          etichetta="Strade interessate"
          valore={formattaNumero(nStrade)}
          nota="nomi distinti in mappa"
        />
      </div>
    </div>
  )
}

function Tile({
  etichetta,
  valore,
  nota,
}: {
  etichetta: string
  valore: string
  nota: string
}) {
  return (
    <Card className="gap-0 px-3.5 py-3">
      <div className="text-xs font-medium text-muted-foreground">{etichetta}</div>
      <div className="mt-1 text-xl leading-none font-semibold tracking-tight">{valore}</div>
      <div className="mt-1.5 text-[11px] text-muted-foreground">{nota}</div>
    </Card>
  )
}
