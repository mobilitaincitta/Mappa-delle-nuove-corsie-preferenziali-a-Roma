import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  // In produzione il sito è servito da https://<utente>.github.io/<repo>/, quindi
  // gli asset non possono essere referenziati dalla radice del dominio. In
  // sviluppo invece il base va lasciato su '/': altrimenti l'app risponde solo
  // su localhost:<porta>/corsie-preferenziali-roma/ e la radice sembra vuota.
  base: command === 'build' ? '/corsie-preferenziali-roma/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  // Vite non legge PORT da solo: serve per farsi assegnare una porta libera
  // quando 5173 è già occupata da un altro dev server.
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
  build: {
    // I due GeoJSON pesano ~480 KB: tenerli in un chunk a parte evita di
    // invalidare il bundle dell'app a ogni riesportazione da QGIS.
    rollupOptions: {
      output: {
        manualChunks: {
          maplibre: ['maplibre-gl'],
        },
      },
    },
  },
}))
