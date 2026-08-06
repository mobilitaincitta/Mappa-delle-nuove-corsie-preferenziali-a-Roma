import { Eye, EyeOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  mostraEsistenti: boolean
  onToggleEsistenti: () => void
}

/**
 * Legenda sovrapposta alla mappa. L'identità non è mai affidata al solo colore:
 * ogni voce ha il campione accanto al testo, e le due corsie esistenti si
 * distinguono per tratteggio.
 */
export function Legend({ mostraEsistenti, onToggleEsistenti }: Props) {
  return (
    <div className="pointer-events-auto w-[210px] rounded-lg border bg-card/95 p-3 shadow-sm backdrop-blur-sm">
      <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Nuove corsie
      </div>
      <div className="mt-2 grid gap-1.5">
        <Voce classe="bg-sc1" testo="Scenario 1" nota="prima priorità" />
        <Voce classe="bg-sc2" testo="Scenario 2" nota="seconda priorità" />
        <Voce classe="bg-sc3" testo="Scenario 3" nota="terza priorità" />
      </div>

      <div className="mt-3 flex items-center justify-between border-t pt-2.5">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Esistenti
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleEsistenti}
          className="-mr-1.5 h-6 gap-1 px-1.5 text-[11px] font-normal text-muted-foreground"
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
    </div>
  )
}

function Voce({
  classe,
  testo,
  nota,
  tratteggiata,
}: {
  classe: string
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
        <span className={cn('h-0.5 w-5 shrink-0 rounded-full', classe)} />
      )}
      <span className="text-xs">{testo}</span>
      {nota && <span className="text-[10px] text-muted-foreground">{nota}</span>}
    </div>
  )
}
