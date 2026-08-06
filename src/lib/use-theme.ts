import { useCallback, useEffect, useState } from 'react'

/**
 * Il tema è già applicato dallo script inline in index.html prima del primo
 * paint; qui si legge lo stato reale dal DOM per non ricalcolarlo in modo
 * diverso e provocare un salto.
 */
export function useTheme() {
  const [scuro, setScuro] = useState(() =>
    document.documentElement.classList.contains('dark')
  )

  useEffect(() => {
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
