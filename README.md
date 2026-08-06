# Corsie preferenziali di Roma — dashboard della rete proposta

Dashboard della rete di corsie preferenziali proposte per Roma: 208,3 km di nuove
corsie su tre scenari di priorità, messi a confronto con i 114,4 km esistenti.

## Provenienza dei dati

I dati vengono da un export qgis2web di
[Mobilità in Città](https://github.com/mobilitaincitta), conservato invariato in
[`legacy/`](legacy/) (commit di origine `f2ccb21`). Il repository originale non
dichiara una licenza: questa è una rielaborazione interna della **bozza**, non una
pubblicazione del piano.

L'export originale resta funzionante: si apre con
[`legacy/index.html`](legacy/index.html) senza alcun server.

## Perché una riscrittura e non una modifica dell'export

L'export qgis2web usava il geocoder di serie, cioè Nominatim interrogato **senza
alcun vincolo geografico**:

```js
"https://nominatim.openstreetmap.org/search?format=geojson&addressdetails=1&"
```

Senza bounding box la ricerca è planetaria e ordinata per «importance» di OSM: per
«Via Tiburtina» il primo risultato è a Guidonia Montecelio, non a Roma. In più
qgis2web crea una voce di autocomplete **per feature**, quindi «Viale Palmiro
Togliatti» compariva 5 volte e lo zoom finiva su uno spezzone a caso.

Qui la ricerca ha due gruppi:

- **Strade del piano** — indice locale sulle 339 strade in mappa, una voce per
  nome, con zoom sull'unione di tutti i segmenti omonimi. Istantaneo e offline.
- **Tutte le strade di Roma** — [Photon](https://photon.komoot.io), pensato per
  l'autocomplete (Nominatim lo vieta esplicitamente nella sua usage policy),
  vincolato alla bbox romana e filtrato sul comune.

Photon ha un difetto verificato sull'endpoint: con il prefisso davanti degrada —
`via giulia` restituisce Via Laurentina, `giulia` trova Via Giulia. Per questo la
query viene inviata senza il prefisso Via/Viale/Piazza, con un filtro di
pertinenza e un riordino lato client.

## Scelte di visualizzazione

`scenario` è una **priorità di attuazione**, quindi una scala ordinale: una sola
tonalità in tre gradini di luminosità, non tre colori diversi. Lo scenario 1 è il
gradino con più contrasto sulla superficie in entrambi i temi. La rampa è
verificata (luminosità monotona, gap ≥ 0,06, estremo chiaro sopra 2:1).

Le corsie **esistenti** sono contesto, non soggetto: grigio neutro, con TRAM e
PROMISCUO distinti dal tratteggio e non dal colore, così il blu significa una cosa
sola in tutta la dashboard.

L'unico filtro è quello per scenario. La tipologia di corsia (`Ty_CP`) resta
visibile sul singolo segmento — nella tabella e nel pannello di dettaglio — ma non
ha un proprio pannello di filtro: su 275 segmenti è indicata solo per 131, quindi
come dimensione di analisi vale poco.

## Limiti del dato di partenza

Sono dichiarati in dashboard, non nascosti:

| Rilievo | Valore |
|---|---|
| Proposte senza tipologia (`Ty_CP` vuoto) | 144 feature su 275, pari a 74,3 km |
| Nomi con più grafie | 77 su 339 (`Via Tiburtina` / `via tiburtina` / `VIA TIBURTINA`) |
| Geometrie sotto i 5 m | 4 |
| Feature più estesa | 11,6 km in 103 parti, probabile unione di più strade |

Le lunghezze non esistono nell'export: sono calcolate qui dalla geometria
(haversine su WGS84). Le glosse italiane delle tipologie NACTO sono una traduzione
di servizio e **vanno confermate** con chi ha redatto il piano.

## Sviluppo

```bash
npm install
npm run dev
```

Rigenerare i dati dopo un nuovo export da QGIS: sostituire i file in
`legacy/layers/` e poi

```bash
npm run data
```

Lo script legge le assegnazioni JavaScript di qgis2web, uniforma i nomi dei campi
(`STRADA`/`TIPO_USO` negli esistenti, `strada`/`scenario`/`Ty_CP` nelle proposte),
calcola lunghezze e aggregati e scrive in `public/data/`.

## Stack

Vite · React 19 · TypeScript · Tailwind 4 · shadcn/ui · MapLibre GL · Photon ·
tile di base Esri Canvas (le stesse dell'export originale, con la variante scura).

## Pubblicazione

Sito: **https://matteocollotti-code.github.io/corsie-preferenziali-roma/**

Ogni push su `main` fa scattare `.github/workflows/deploy.yml`, che compila e
pubblica `dist/` su GitHub Pages. Pages non può servire i sorgenti, da qui il
passaggio di build. Il `base` in `vite.config.ts` vale solo per la build ed è
impostato sul nome del repository; in sviluppo resta `/`.
