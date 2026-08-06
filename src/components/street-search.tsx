import { useEffect, useRef, useState } from 'react'
import { Globe2, Loader2, Route, Search } from 'lucide-react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cercaIndice, normalizza, type VoceStrada } from '@/lib/streets'
import { cercaStradeRoma, type RisultatoPhoton } from '@/lib/photon'
import { formattaKm } from '@/lib/format'
import { cn } from '@/lib/utils'

interface Props {
  indice: VoceStrada[]
  onSceltaLocale: (voce: VoceStrada) => void
  onSceltaRemota: (risultato: RisultatoPhoton) => void
}

export function StreetSearch({ indice, onSceltaLocale, onSceltaRemota }: Props) {
  const [aperta, setAperta] = useState(false)
  const [query, setQuery] = useState('')
  const [remoti, setRemoti] = useState<RisultatoPhoton[]>([])
  const [caricando, setCaricando] = useState(false)
  const [erroreRemoto, setErroreRemoto] = useState(false)

  const locali = query.trim().length >= 2 ? cercaIndice(indice, query, 8) : []

  // ⌘K / Ctrl+K da qualunque punto della pagina.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setAperta((v) => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Ricerca remota: attesa dopo l'ultimo tasto e annullamento della richiesta
  // precedente, altrimenti si manda una query per carattere e le risposte
  // arrivano fuori ordine.
  const abort = useRef<AbortController | null>(null)
  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setRemoti([])
      setCaricando(false)
      setErroreRemoto(false)
      abort.current?.abort()
      return
    }

    const timer = setTimeout(() => {
      abort.current?.abort()
      const controller = new AbortController()
      abort.current = controller
      setCaricando(true)
      setErroreRemoto(false)

      cercaStradeRoma(q, controller.signal)
        .then((r) => {
          setRemoti(r)
          setCaricando(false)
        })
        .catch((e) => {
          if ((e as Error).name === 'AbortError') return
          setRemoti([])
          setErroreRemoto(true)
          setCaricando(false)
        })
    }, 280)

    return () => clearTimeout(timer)
  }, [query])

  // I nomi già presenti nel piano non vanno ripetuti nel gruppo remoto: stessa
  // normalizzazione dell'indice, altrimenti il confronto fallisce sugli accenti.
  const chiaviLocali = new Set(locali.map((v) => v.norm))
  const remotiFiltrati = remoti.filter((r) => !chiaviLocali.has(normalizza(r.nome)))

  /**
   * Con shouldFilter disattivato cmdk non evidenzia più da sé il primo
   * risultato, e senza un item attivo il tasto Invio non ha nulla da
   * selezionare. L'item attivo va quindi gestito qui: resta quello scelto con le
   * frecce se è ancora fra i risultati, altrimenti torna al primo.
   */
  const valori = [
    ...locali.map((v) => v.key),
    ...remotiFiltrati.map((r) => `remoto-${r.key}`),
  ]
  const [attivo, setAttivo] = useState('')
  const chiaveValori = valori.join('|')
  useEffect(() => {
    setAttivo((corrente) => (valori.includes(corrente) ? corrente : (valori[0] ?? '')))
    // Dipende dall'insieme dei risultati, non dall'identità dell'array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiaveValori])

  const chiudi = () => {
    setAperta(false)
    setQuery('')
    setRemoti([])
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setAperta(true)}
        className="h-9 w-full justify-start gap-2 px-3 text-muted-foreground sm:w-72"
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate text-sm font-normal">Cerca una strada…</span>
        <kbd className="ml-auto hidden shrink-0 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:inline-flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog
        open={aperta}
        onOpenChange={(v) => (v ? setAperta(true) : chiudi())}
        title="Cerca una strada"
        description="Cerca tra le strade del piano o tra tutte le strade di Roma"
        className="sm:max-w-xl"
        // Il filtro di cmdk va disattivato: l'ordinamento locale è già calcolato
        // e i risultati remoti non devono essere filtrati una seconda volta.
        // Disattivandolo, però, l'item attivo diventa responsabilità nostra.
        commandProps={{
          shouldFilter: false,
          value: attivo,
          onValueChange: setAttivo,
        }}
      >
        <CommandInput
          placeholder="Nome della strada, anche senza «via»…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[420px]">
          {query.trim().length < 2 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Digita almeno due lettere.
              <br />
              <span className="text-xs">
                {indice.length} strade nel piano, più tutte le strade di Roma.
              </span>
            </div>
          )}

          {query.trim().length >= 2 &&
            !locali.length &&
            !remotiFiltrati.length &&
            !caricando && (
              <CommandEmpty>Nessuna strada trovata.</CommandEmpty>
            )}

          {locali.length > 0 && (
            <CommandGroup heading="Strade del piano">
              {locali.map((voce) => (
                <CommandItem
                  key={voce.key}
                  value={voce.key}
                  onSelect={() => {
                    onSceltaLocale(voce)
                    chiudi()
                  }}
                  className="gap-3"
                >
                  <Route className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{voce.label}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {voce.scenari.map((s) => (
                      <PallinoScenario key={s} scenario={s} />
                    ))}
                    {voce.esistenti.length > 0 && (
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
                        esistente
                      </Badge>
                    )}
                    {voce.len > 0 && (
                      <span className="tabular w-16 text-right text-xs text-muted-foreground">
                        {formattaKm(voce.len)}
                      </span>
                    )}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {(remotiFiltrati.length > 0 || caricando || erroreRemoto) && (
            <>
              {locali.length > 0 && <CommandSeparator />}
              <CommandGroup heading="Tutte le strade di Roma">
                {caricando && !remotiFiltrati.length && (
                  <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Cerco in tutta la città…
                  </div>
                )}
                {erroreRemoto && (
                  <div className="px-2 py-3 text-sm text-muted-foreground">
                    Servizio di ricerca non raggiungibile. Le strade del piano
                    restano cercabili.
                  </div>
                )}
                {remotiFiltrati.map((r) => (
                  <CommandItem
                    key={r.key}
                    value={`remoto-${r.key}`}
                    onSelect={() => {
                      onSceltaRemota(r)
                      chiudi()
                    }}
                    className="gap-3"
                  >
                    <Globe2 className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{r.nome}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {r.contesto}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}

function PallinoScenario({ scenario }: { scenario: number }) {
  return (
    <span
      title={`Scenario ${scenario}`}
      className={cn(
        'size-2.5 rounded-full ring-1 ring-black/10 dark:ring-white/15',
        scenario === 1 && 'bg-sc1',
        scenario === 2 && 'bg-sc2',
        scenario === 3 && 'bg-sc3'
      )}
    />
  )
}
