import { useCallback, useEffect, useLayoutEffect, useState } from 'react'

/**
 * Il tema è già applicato dallo script inline in index.html prima del primo
 * paint; qui si legge lo stato reale dal DOM per non ricalcolarlo in modo
 * diverso e provocare un salto.
 */
export function useTheme() {
  const [scuro, setScuro] = useState(() =>
    document.documentElement.classList.contains('dark')
  )

  /**
   * Layout effect, non effect: la classe deve essere sul documento prima che i
   * figli leggano i token CSS.
   *
   * React esegue gli effetti dal basso verso l'alto, quindi l'effetto di
   * MapView — che e' figlio — girava prima di questo e leggeva i colori del
   * tema precedente: l'alone delle corsie restava chiaro sul tema scuro e
   * viceversa, sfasato di uno a ogni cambio. Gli effetti di layout del padre
   * girano invece prima degli effetti passivi dei figli.
   */
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', scuro)
    try {
      localStorage.setItem('tema', scuro ? 'dark' : 'light')
    } catch {
      /* modalità privata: la preferenza vale solo per questa sessione */
    }
  }, [scuro])

  // Segue il sistema solo finché l'utente non ha scelto esplicitamente.
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => {
      let scelto = null
      try {
        scelto = localStorage.getItem('tema')
      } catch {
        /* ignorato */
      }
      if (!scelto) setScuro(e.matches)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const alterna = useCallback(() => setScuro((v) => !v), [])
  return { scuro, alterna }
}
