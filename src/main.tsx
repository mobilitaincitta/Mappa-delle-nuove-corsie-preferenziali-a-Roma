import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import './index.css'

/**
 * MapLibre analizza lo stile dentro `browser.frame()`, cioè un
 * requestAnimationFrame, e i browser non eseguono rAF nelle schede non
 * visibili: in un contesto automatizzato (scheda mai portata in primo piano)
 * la mappa non si caricherebbe mai, rendendo impossibile verificarla.
 *
 * Solo in sviluppo, e solo se la pagina parte nascosta, rAF viene appoggiato a
 * setTimeout. In produzione questo ramo non esiste.
 */
if (import.meta.env.DEV && document.visibilityState === 'hidden') {
  window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    window.setTimeout(() => cb(performance.now()), 16)) as typeof requestAnimationFrame
  window.cancelAnimationFrame = ((id: number) =>
    window.clearTimeout(id)) as typeof cancelAnimationFrame
}

const radice = document.getElementById('root')
if (!radice) throw new Error('Elemento #root non trovato in index.html')

createRoot(radice).render(
  <StrictMode>
    <App />
  </StrictMode>
)
