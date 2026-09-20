import { Crosshair, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { classe, type Scala } from '@/lib/analisi'
import { formattaKm, formattaLunghezza, formattaNumero, formattaPercento } from '@/lib/format'
import type { Feature, PropVelocita, Velocita } from '@/lib/types'

interface Props {
  scala: Scala
  velocita: Velocita | null
  segmento: Feature<PropVelocita> | null
  onChiudi: () => void
  onInquadra: () => void
}

/**
 * Il pannello dell'analisi attiva: com'è distribuita la rete osservata fra le
 * quattro classi, e cosa dice il segmento selezionato.
 *
 * Le classi portano i km oltre al numero di segmenti: 400 spezzoni corti e 400
 * lunghi sono la stessa riga in un conteggio, e due realtà diverse in strada.
 */
export function AnalisiPanel({ scala, velocita, segmento, onChiudi, onInquadra }: Props) {
  const features = velocita?.features ?? []
  const classi = scala.etichette.map((etichetta, i) => ({
    etichetta,
    tinta: scala.tinte[i],
    n: 0,
    metri: 0,
    _i: i,
  }))
  for (const f of features) {
    const riga = classi[classe(scala, f.properties[scala.campo])]
    riga.n += 1
    riga.metri += f.properties.len
  }
  const metriTotali = classi.reduce((a, c) => a + c.metri, 0)

  return (
    <div className="grid gap-3 p-4">
      <Card className="gap-0 px-4 py-3.5">
        <div className="text-xs font-medium text-muted-foreground">{scala.titolo}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl leading-none font-semibold tracking-tight">
            {formattaNumero(features.length)}
          </span>
          <span className="text-sm text-muted-foreground">segmenti osservati</span>
        </div>
        <div className="mt-1.5 text-xs text-muted-foreground">
          {formattaKm(metriTotali)} di rete bus &middot; misurati fra due fermate
        </div>
      </Card>

      <Card className="gap-3 px-4 py-3.5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Classi</h2>
          <span className="text-[11px] text-muted-foreground">{scala.unita}</span>
        </div>

        {/* Barra unica divisa in quattro: la domanda è come si ripartisce la
            rete, che è una composizione di un intero. */}
        <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
          {classi.map((c) => (
            <span
              key={c.etichetta}
              style={{ flexGrow: c.metri, backgroundColor: c.tinta }}
              title={`${c.etichetta} — ${formattaKm(c.metri)}`}
              className="h-full min-w-1 rounded-full first:rounded-l-full last:rounded-r-full"
            />
          ))}
        </div>

        <div className="grid gap-1">
          {classi.map((c) => (
            <div key={c.etichetta} className="flex items-center gap-2.5 px-1.5 py-1">
              <span
                className="size-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: c.tinta }}
              />
              <span className="min-w-0 flex-1 truncate text-[13px]">{c.etichetta}</span>
              <span className="tabular shrink-0 text-[13px] font-medium">
                {formattaKm(c.metri)}
              </span>
              <span className="tabular w-9 shrink-0 text-right text-[11px] text-muted-foreground">
                {formattaPercento(c.metri, metriTotali)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {segmento ? (
        <DettaglioSegmento
          scala={scala}
          segmento={segmento}
          onChiudi={onChiudi}
          onInquadra={onInquadra}
        />
      ) : (
        <p className="px-1 text-xs leading-relaxed text-muted-foreground">
          Tocca un segmento in mappa per vederne il valore.
        </p>
      )}
    </div>
  )
}

function DettaglioSegmento({
  scala,
  segmento,
  onChiudi,
  onInquadra,
}: {
  scala: Scala
  segmento: Feature<PropVelocita>
  onChiudi: () => void
  onInquadra: () => void
}) {
  const p = segmento.properties
  const valore = p[scala.campo]
  const i = classe(scala, valore)

  return (
    <Card className="gap-0 px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Segmento selezionato
          </div>
          <h2 className="mt-0.5 text-sm leading-snug font-semibold">
            {p.nome ?? 'Strada non indicata'}
          </h2>
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

      {/* La cifra dell'analisi in corso è il soggetto della scheda, non una riga
          fra le altre: sta grande, con il colore della sua classe. */}
      <div className="mt-2.5 flex items-baseline gap-2">
        <span
          className="size-2.5 shrink-0 self-center rounded-full ring-1 ring-black/10"
          style={{ backgroundColor: scala.tinte[i] }}
          aria-hidden
        />
        <span className="text-2xl leading-none font-semibold tracking-tight">
          {scala.campo === 'vel' ? valore.toFixed(1).replace('.', ',') : valore}
        </span>
        <span className="text-sm text-muted-foreground">
          {scala.campo === 'vel' ? 'km/h' : 'su 100'}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          classe {scala.etichette[i]}
        </span>
      </div>

      <Separator className="my-3" />

      <dl className="grid gap-2 text-[13px]">
        <Riga etichetta="Da">{p.da ?? '—'}</Riga>
        <Riga etichetta="A">{p.a ?? '—'}</Riga>
        <Riga etichetta="Lunghezza">
          <span className="tabular">{formattaLunghezza(p.len)}</span>
        </Riga>
        <Riga etichetta="Linee sul corridoio">
          <span className="tabular">{formattaNumero(p.linee)}</span>
        </Riga>
        <Riga etichetta={scala.campo === 'vel' ? 'Benefit score' : 'Velocità rilevata'}>
          <span className="tabular text-muted-foreground">
            {scala.campo === 'vel'
              ? `${p.ben} su 100`
              : `${p.vel.toFixed(1).replace('.', ',')} km/h`}
          </span>
        </Riga>
      </dl>

      <Button variant="outline" size="sm" onClick={onInquadra} className="mt-3 h-8 gap-1.5">
        <Crosshair className="size-3.5" />
        Inquadra il segmento
      </Button>
    </Card>
  )
}

function Riga({ etichetta, children }: { etichetta: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-start gap-2">
      <dt className="text-muted-foreground">{etichetta}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}
