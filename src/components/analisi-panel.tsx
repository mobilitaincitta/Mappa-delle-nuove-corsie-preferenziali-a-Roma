import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { classe, type Scala } from '@/lib/analisi'
import { cn } from '@/lib/utils'
import {
  formattaKm,
  formattaLunghezza,
  formattaNumero,
  formattaPercento,
  formattaVelocita,
} from '@/lib/format'
import type { Feature, PropVelocita, Velocita } from '@/lib/types'

interface Props {
  scala: Scala
  velocita: Velocita | null
  classiAttive: Set<number>
  onToggleClasse: (i: number) => void
  /** Selezione corrente: uno, nessuno o molti. */
  segmenti: Feature<PropVelocita>[]
  onChiudi: () => void
}

/**
 * Il pannello dell'analisi attiva: com'è distribuita la rete osservata fra le
 * quattro classi, e cosa dice il segmento selezionato.
 *
 * Le classi portano i km oltre al numero di segmenti: 400 spezzoni corti e 400
 * lunghi sono la stessa riga in un conteggio, e due realtà diverse in strada.
 */
export function AnalisiPanel({
  scala,
  velocita,
  classiAttive,
  onToggleClasse,
  segmenti,
  onChiudi,
}: Props) {
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
  const accese = classi.filter((c) => classiAttive.has(c._i))
  const metriAccesi = accese.reduce((a, c) => a + c.metri, 0)
  const nAccesi = accese.reduce((a, c) => a + c.n, 0)
  const filtroAttivo = classiAttive.size !== classi.length

  return (
    <div className="grid gap-3 p-4">
      <Card className="gap-0 px-4 py-3.5">
        <div className="text-xs font-medium text-muted-foreground">
          {filtroAttivo ? 'Selezione corrente' : scala.titolo}
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl leading-none font-semibold tracking-tight">
            {formattaNumero(nAccesi)}
          </span>
          <span className="text-sm text-muted-foreground">
            segmenti{filtroAttivo && ` su ${formattaNumero(features.length)}`}
          </span>
        </div>
        <div className="mt-1.5 text-xs text-muted-foreground">
          {formattaKm(metriAccesi)} di rete bus &middot; misurati fra due fermate
        </div>
      </Card>

      <Card className="gap-3 px-4 py-3.5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Classi</h2>
          <span className="text-[11px] text-muted-foreground">{scala.unita}</span>
        </div>

        {/* Barra unica divisa in quattro: la domanda è come si ripartisce la
            rete, che è una composizione di un intero. */}
        {/* Le classi si accendono e si spengono come gli scenari: stessa barra
            divisa, stesse righe che fanno da legenda e da filtro insieme. */}
        <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
          {classi.map((c) => (
            <button
              key={c.etichetta}
              type="button"
              onClick={() => onToggleClasse(c._i)}
              style={{ flexGrow: c.metri, backgroundColor: c.tinta }}
              title={`${c.etichetta} — ${formattaKm(c.metri)}`}
              aria-label={`Mostra o nascondi la classe ${c.etichetta}`}
              className={cn(
                'h-full min-w-1 cursor-pointer rounded-full transition-opacity first:rounded-l-full last:rounded-r-full',
                !classiAttive.has(c._i) && 'opacity-20'
              )}
            />
          ))}
        </div>

        <div className="grid gap-1">
          {classi.map((c) => (
            <button
              key={c.etichetta}
              type="button"
              onClick={() => onToggleClasse(c._i)}
              aria-pressed={classiAttive.has(c._i)}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-accent/60',
                !classiAttive.has(c._i) && 'opacity-45'
              )}
            >
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
            </button>
          ))}
        </div>
      </Card>

      {segmenti.length === 1 ? (
        <DettaglioSegmento scala={scala} segmento={segmenti[0]} onChiudi={onChiudi} />
      ) : segmenti.length > 1 ? (
        <SelezioneMultipla scala={scala} segmenti={segmenti} onChiudi={onChiudi} />
      ) : (
        <p className="px-1 text-xs leading-relaxed text-muted-foreground">
          Tocca i segmenti in mappa o nella lista: si sommano, e l'inquadratura
          li segue.
        </p>
      )}
    </div>
  )
}

/**
 * Con più segmenti scelti la domanda cambia: non «quanto vale questo» ma
 * «quanto pesano insieme». La media è pesata sulla lunghezza, perché un tratto
 * di 50 m e uno di 900 non contano uguale.
 */
function SelezioneMultipla({
  scala,
  segmenti,
  onChiudi,
}: {
  scala: Scala
  segmenti: Feature<PropVelocita>[]
  onChiudi: () => void
}) {
  const metri = segmenti.reduce((a, f) => a + f.properties.len, 0)
  const media = metri
    ? segmenti.reduce((a, f) => a + f.properties[scala.campo] * f.properties.len, 0) / metri
    : 0
  const i = classe(scala, media)

  return (
    <Card className="gap-0 px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Selezione
          </div>
          <h2 className="mt-0.5 text-sm leading-snug font-semibold">
            {formattaNumero(segmenti.length)} segmenti &middot; {formattaKm(metri)}
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

      <div className="mt-2.5 flex items-baseline gap-2">
        <span
          className="size-2.5 shrink-0 self-center rounded-full ring-1 ring-black/10"
          style={{ backgroundColor: scala.tinte[i] }}
          aria-hidden
        />
        <span className="text-2xl leading-none font-semibold tracking-tight">
          {scala.campo === 'vel' ? formattaVelocita(media) : Math.round(media)}
        </span>
        <span className="text-sm text-muted-foreground">
          {scala.campo === 'vel' ? 'km/h' : 'su 100'}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">media sui km</span>
      </div>

      <Separator className="my-3" />

      <ul className="grid max-h-40 gap-1 overflow-auto text-[12px]">
        {segmenti.map((f) => (
          <li key={f.properties.id} className="flex items-center gap-2">
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{
                backgroundColor: scala.tinte[classe(scala, f.properties[scala.campo])],
              }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate">
              {f.properties.nome ?? 'Strada non indicata'}
            </span>
            <span className="tabular shrink-0 text-muted-foreground">
              {scala.campo === 'vel'
                ? `${formattaVelocita(f.properties.vel)} km/h`
                : f.properties.ben}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function DettaglioSegmento({
  scala,
  segmento,
  onChiudi,
}: {
  scala: Scala
  segmento: Feature<PropVelocita>
  onChiudi: () => void
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
          {scala.campo === 'vel' ? formattaVelocita(valore) : valore}
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
            {scala.campo === 'vel' ? `${p.ben} su 100` : `${formattaVelocita(p.vel)} km/h`}
          </span>
        </Riga>
      </dl>

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
