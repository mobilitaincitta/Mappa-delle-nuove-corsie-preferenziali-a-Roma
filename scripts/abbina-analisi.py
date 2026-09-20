# -*- coding: utf-8 -*-
"""
Attacca ai segmenti della rete proposta la velocita' e il benefit score
osservati, presi dai segmenti bus che ci passano sopra.

I due dati non hanno una chiave in comune: la rete proposta viene dall'export
qgis2web, i segmenti osservati dal GeoPackage GTFS. Gli identificativi non si
parlano e i nomi di strada nemmeno, perche' le due fonti li scrivono in modo
diverso. L'aggancio e' quindi geometrico: ogni segmento osservato viene
allargato di 10 m e si misura quanta parte della proposta ci cade dentro.

Quella lunghezza e' anche il peso della media. Non e' un dettaglio: su una
strada percorsa da piu' linee, o nei due sensi, lo stesso tratto compare in piu'
segmenti osservati, e pesarli per quanto coprono significa mediare sul traffico
bus che quel tratto vede davvero, non sul numero di righe nel file.

Va eseguito DOPO build-data.mjs e build-velocita.py, perche' riscrive
proposte.json: rigenerandolo, i campi aggiunti qui sparirebbero.

Richiede geopandas. Uso: python scripts/abbina-analisi.py
"""

import json
from pathlib import Path

import geopandas as gpd
from shapely.geometry import shape

DATI = Path(__file__).resolve().parent.parent / "public" / "data"
PROPOSTE = DATI / "proposte.json"
VELOCITA = DATI / "velocita.json"

# Roma sta nel fuso 33N: in metri le distanze sono distanze, non gradi.
METRICO = 32633
RAGGIO_M = 10

proposte = json.loads(PROPOSTE.read_text(encoding="utf-8"))
osservati = json.loads(VELOCITA.read_text(encoding="utf-8"))

P = gpd.GeoDataFrame(
    [f["properties"] for f in proposte["features"]],
    geometry=[shape(f["geometry"]) for f in proposte["features"]],
    crs=4326,
).to_crs(METRICO)
V = gpd.GeoDataFrame(
    [f["properties"] for f in osservati["features"]],
    geometry=[shape(f["geometry"]) for f in osservati["features"]],
    crs=4326,
).to_crs(METRICO)

intorni = V.geometry.buffer(RAGGIO_M)
indice = gpd.GeoSeries(intorni, crs=METRICO).sindex

agganciate = 0
for feature, geometria in zip(proposte["features"], P.geometry):
    vicini = indice.query(geometria, predicate="intersects")
    peso_totale = 0.0
    somma_vel = 0.0
    somma_ben = 0.0
    contribuenti = 0
    for k in vicini:
        sovrapposto = geometria.intersection(intorni.iloc[k]).length
        if sovrapposto <= 0:
            continue
        peso_totale += sovrapposto
        somma_vel += sovrapposto * float(V.vel.iloc[k])
        somma_ben += sovrapposto * float(V.ben.iloc[k])
        contribuenti += 1

    if peso_totale <= 0:
        continue
    feature["properties"]["vel"] = round(somma_vel / peso_totale, 1)
    feature["properties"]["ben"] = int(round(somma_ben / peso_totale))
    feature["properties"]["nseg"] = contribuenti
    agganciate += 1

PROPOSTE.write_text(
    json.dumps(proposte, ensure_ascii=False, separators=(",", ":")),
    encoding="utf-8",
)

print(f"proposte agganciate: {agganciate}/{len(proposte['features'])}")
print(f"senza dato osservato: {len(proposte['features']) - agganciate}")
print(f"peso file: {PROPOSTE.stat().st_size / 1024:.0f} KB")
