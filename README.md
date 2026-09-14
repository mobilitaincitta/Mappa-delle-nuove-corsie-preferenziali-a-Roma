# Nuove corsie preferenziali a Roma — dashboard della proposta di rete

Dashboard della rete di corsie preferenziali proposte per Roma: 159 km di nuove
corsie su tre scenari di priorità (87 + 53 + 19 km), messi a confronto con i
114,4 km esistenti.

I km di sintesi sono quelli dichiarati dal piano, impostati in `KM_DICHIARATI`
dentro [`scripts/build-data.mjs`](scripts/build-data.mjs): non vengono misurati
sulle geometrie della bozza, che in mappa sono ancora quelle dell'export
originale.

## Metropolitana

Le linee A, B/B1 e C e le 71 stazioni vengono da OpenStreetMap, scaricate con
[`scripts/build-metro.mjs`](scripts/build-metro.mjs) (`npm run metro`) e salvate
in `public/data/metro.json`. I colori sono quelli della segnaletica ATAC, presi
dai tag `colour` delle relazioni, e restano identici nei due temi: sono
un'identita' di linea, non una scelta grafica.

Il ramo B1 e' taggato `ref=B` in OSM e resta accorpato alla B. Le stazioni non
si ricavano dai membri delle relazioni — quei nodi sono punti di fermata sul
binario, senza nome — ma dai nodi `station=subway` tenuti solo se entro 150 m da
una delle tre linee: lo stesso criterio esclude la Metromare, taggata allo stesso
modo, e assegna le linee a ciascuna stazione, cosi' i tre interscambi (Termini,
San Giovanni, Colosseo) risultano dal dato.

Il dato OSM e' sotto ODbL: l'attribuzione in mappa e' una condizione della licenza.

### Il font

Il carattere istituzionale di Roma Capitale e' **Urbs**, disegnato da Inarea. E'
proprietario e non ridistribuibile, quindi nel repository non c'e'. La variabile
`--font-metro` in [`src/index.css`](src/index.css) lo nomina comunque per primo:
chi ne ha la licenza mette i file in `public/fonts/` e toglie il commento al
blocco `@font-face` accanto alla variabile, e le etichette delle stazioni, i
bollini di linea e la legenda passano a Urbs senza altre modifiche. Senza quei
file vale il ripiego della pila.

## Incorporare la mappa in un altro sito

La dashboard sta in un `<iframe>` senza alcuna configurazione: GitHub Pages non
manda `X-Frame-Options` ne' CSP, e il foglio di stile mette `height: 100%` su
`html, body, #root`, quindi l'app riempie il riquadro che le si da'.

La pagina [`public/incorporare.html`](public/incorporare.html) e' l'esempio da
mostrare a chi cura il sito: contiene la mappa incorporata dal vivo dentro una
pagina qualsiasi. Essendo in `public/` viene copiata tale e quale nella build,
quindi e' pubblicata accanto alla mappa:

    https://mobilitaincitta.github.io/Mappa-delle-nuove-corsie-preferenziali-a-Roma/incorporare.html

La larghezza conta piu' dell'altezza: sopra i 1024 px il pannello sta a fianco
della mappa, sotto scivola sotto e i due si dividono l'altezza. Il posto giusto e'
una fascia a tutta larghezza, alta 700 px.

Due limiti noti, entrambi risolvibili leggendo dei parametri nell'indirizzo:
filtri e strada cercata non finiscono nell'URL, quindi non si puo' aprire la mappa
su una vista specifica; e il tema non segue la pagina ospite, perche' dentro
l'iframe l'app guarda le preferenze del browser di chi legge.

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

L'unico filtro è quello per scenario. La tipologia di intervento (`Ty_CP`
nell'export) non viene riportata: resta nel dato di origine in `legacy/`, ma non
entra né nel GeoJSON né nell'interfaccia.

## Limiti del dato di partenza

Sono dichiarati in dashboard, non nascosti:

| Rilievo | Valore |
|---|---|
| Nomi con più grafie | 77 su 339 (`Via Tiburtina` / `via tiburtina` / `VIA TIBURTINA`) |
| Geometrie sotto i 5 m | 4 |
| Feature più estesa | 11,6 km in 103 parti, probabile unione di più strade |

Le lunghezze non esistono nell'export: sono calcolate qui dalla geometria
(haversine su WGS84).

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
(`STRADA`/`TIPO_USO` negli esistenti, `strada`/`scenario` nelle proposte),
calcola lunghezze e aggregati e scrive in `public/data/`.

## Stack

Vite · React 19 · TypeScript · Tailwind 4 · shadcn/ui · MapLibre GL · Photon ·
tile di base Esri Canvas (le stesse dell'export originale, con la variante scura).

## Pubblicazione

Sito: **https://matteocollotti-code.github.io/corsie-preferenziali-roma/**

Pages serve il branch **`gh-pages`**, che contiene la build. Pages non può
servire i sorgenti, da qui il passaggio di compilazione. Il `base` in
`vite.config.ts` vale solo per la build ed è impostato sul nome del repository;
in sviluppo resta `/`.

Ogni push su `main` fa scattare `.github/workflows/deploy.yml`, che compila e
spinge `dist/` su `gh-pages`. Per pubblicare a mano, quando le Actions non sono
disponibili:

```bash
npm run build
cd dist && touch .nojekyll && git init -q && git checkout -b gh-pages \
  && git add -A && git commit -qm "build" \
  && git push -f https://github.com/matteocollotti-code/corsie-preferenziali-roma.git gh-pages
```
