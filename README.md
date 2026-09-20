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
su una vista specifica.

## Colori

La palette viene dalla campagna Clean Cities «Corsìa Preferenziale»: magenta
`#ee2b75` e giallo `#ffd642`.

La scala delle priorita' e' una rampa ordinale di quel magenta —
`#8e0c45` / `#ee2b75` / `#f27ba9` — con il colore di campagna esatto al gradino
centrale. Verificata con i criteri dichiarati in `src/index.css`: luminanze
0,064 / 0,212 / 0,359, monotone, gap 0,147 e 0,147 (serve >= 0,06), contrasto
sulla superficie 8,94 / 3,91 / 2,50, con l'estremo chiaro sopra il 2:1 richiesto.

Il giallo fa l'evidenza della selezione. L'header usa `#dd1a68`, un magenta
appena piu' profondo: sopra `#ee2b75` il testo bianco piccolo sta a 4,01:1 e non
passa, su `#dd1a68` arriva a 4,75:1. Il magenta esatto resta dove si vede di
piu', cioe' nei dati.

Le scale di velocita' e benefit restano fuori da questa identita': devono
distinguersi fra loro e dal piano, non ripeterne il colore.

## Autori

Caridad Pineda, poi in ordine alfabetico di cognome: Matteo Collotti, Giulia
Galbiati, Nicola Ippolito, Giorgio Rubino, Gaia Sgaramella.

## Le tre analisi

In cima al pannello di sinistra si sceglie **una** delle tre, e tutto il
pannello racconta quella:

| Analisi | Soggetto | Pannello |
|---|---|---|
| Scenario | i 275 tratti del piano | km per priorita', tabella dei segmenti, dettaglio del tratto |
| Velocita | i 3992 segmenti bus osservati | km per classe, dettaglio del segmento |
| Benefit | gli stessi segmenti | km per classe, dettaglio del segmento |

Non si sommano: hanno soggetti diversi e in mappa si clicca l'uno o l'altro.
Cambiando analisi la selezione si azzera, perche' non vorrebbe piu' dire niente.

Il pannello si chiude dal pulsante in alto a sinistra: incorporata in una
colonna stretta, la mappa vale piu' dei numeri.

I segmenti osservati vengono da un GeoPackage QGIS esterno al repository,
convertito con [`scripts/build-velocita.py`](scripts/build-velocita.py)
(richiede geopandas):

| Strato | Campo | Classi |
|---|---|---|
| Velocita media rilevata | `observed_avg_speed_kmh` | 0-10, 10-20, 20-30, oltre 30 km/h |
| Benefit score | `scenario_2_benefit_score_total_100` | 0-25, 25-50, 50-75, 75-100 |

In mappa velocita' e benefit non sono due layer ma uno solo, di cui cambia
l'espressione di colore: non possono essere accesi insieme per costruzione.

Con un'analisi accesa **le corsie del piano si spengono**: sono disegnate sopra e
piu' spesse, e coprirebbero proprio i segmenti che l'analisi colora. Al loro
posto la legenda in mappa mostra la scala attiva, cosi' anche a pannello chiuso
i colori hanno una chiave.

Dei sei benefit score del file (tre scenari x running/total) arriva in mappa
solo quello dello scenario 2 «total», lo stesso su cui e' costruita la selezione
«final Top benefit score». **Lo scenario 2 di quel file e' uno scenario di
intervento, non la seconda priorita' di attuazione della rete proposta**: stessa
numerazione, cose diverse.

Il GeoJSON pesa 1,4 MB contro i ~500 KB di tutto il resto, quindi **non viene
caricato all'avvio**: arriva alla prima accensione di uno dei due strati, una
volta sola per sessione, con un avviso in legenda mentre scarica. Chi non apre
l'analisi non lo scarica mai.

## Limiti della vista

La vista e' confinata al comune di Roma, il cui confine viene da OpenStreetMap
(`npm run confine`, [`scripts/build-confine.mjs`](scripts/build-confine.mjs)) ed
e' disegnato in mappa come tratteggio.

Lo zoom minimo non e' un numero fisso ma quello al quale il comune riempie il
riquadro, ricalcolato sulle dimensioni vere del contenitore: un valore fisso
sarebbe giusto su un monitor e sbagliato dentro un iframe basso.

Lo zoom massimo e' **17**. Le tile Esri su Roma esistono fino al livello **16**:
dal 17 in su il servizio risponde 200 ma restituisce sempre la stessa immagine
segnaposto da 2521 byte, quella con la scritta che il dato non e' disponibile.
Le sorgenti dichiarano quindi `maxzoom: 16`, cosi' MapLibre non chiede mai quei
livelli e riusa il 16 ingrandendolo: lo sfondo si ammorbidisce di un fattore 2,
la rete resta nitida perche' e' vettoriale, e la scritta non compare mai.

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
tile di base Esri Canvas (le stesse dell'export originale).

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
