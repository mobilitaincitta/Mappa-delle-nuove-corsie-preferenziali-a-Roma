# -*- coding: utf-8 -*-
"""
Converte il GeoPackage dei segmenti osservati in public/data/velocita.json.

La sorgente e' un file QGIS fuori dal repository: 3992 segmenti di percorso bus
con la velocita' media rilevata fra due fermate e i benefit score dei tre
scenari di intervento. Qui diventa un GeoJSON leggero, tagliato su cio' che la
dashboard disegna davvero.

Cosa succede al dato:
  - la geometria viene semplificata e arrotondata: a video la differenza non si
    vede, il file si dimezza;
  - i punteggi diventano interi, perche' in mappa servono solo a scegliere una
    delle quattro classi;
  - dei sei benefit score resta solo quello dello scenario 2 «total», cioe'
    quello su cui e' costruita la selezione «final Top benefit score»; gli altri
    cinque non arrivano in mappa.

Attenzione: lo scenario 2 di questo file e' uno scenario di INTERVENTO, non la
seconda priorita' di attuazione della rete proposta. Stessa numerazione, cose
diverse.

Richiede geopandas. Uso: python scripts/build-velocita.py [percorso.gpkg]
"""

import json
import sys
from pathlib import Path

import geopandas as gpd

SORGENTE = Path(
    sys.argv[1]
    if len(sys.argv) > 1
    else r"C:\Users\matte\OneDrive\Desktop\fondazione\260918_velocita_edited.gpkg"
)
USCITA = Path(__file__).resolve().parent.parent / "public" / "data" / "velocita.json"

# ~2 m: sotto questa soglia i vertici non cambiano nulla a video e pesano.
TOLLERANZA = 0.00002

BENEFIT = "scenario_2_benefit_score_total_100"

g = gpd.read_file(SORGENTE)
if g.crs is None or g.crs.to_epsg() != 4326:
    g = g.to_crs(4326)

vertici_prima = int(g.geometry.apply(lambda x: len(x.coords)).sum())
g["geometry"] = g.geometry.simplify(TOLLERANZA, preserve_topology=False)
vertici_dopo = int(g.geometry.apply(lambda x: len(x.coords)).sum())


def coordinate(linea):
    return [[round(x, 5), round(y, 5)] for x, y in linea.coords]


def testo(valore):
    """I campi vuoti del GeoPackage arrivano come NaN, non come stringa vuota."""
    if valore is None or valore != valore:
        return None
    return str(valore).strip() or None


features = []
for i, r in enumerate(g.itertuples(index=False)):
    proprieta = {
        "id": i,
        "nome": testo(getattr(r, "osm_road_name", None)),
        "da": testo(getattr(r, "from_stop_name", None)),
        "a": testo(getattr(r, "to_stop_name", None)),
        "len": int(getattr(r, "segment_length_m", 0)),
        "linee": int(getattr(r, "shared_corridor_line_count", 0)),
        "vel": round(float(getattr(r, "observed_avg_speed_kmh", 0)), 1),
    }
    proprieta["ben"] = int(round(float(getattr(r, BENEFIT))))
    features.append(
        {
            "type": "Feature",
            "id": i,
            "properties": proprieta,
            "geometry": {"type": "LineString", "coordinates": coordinate(r.geometry)},
        }
    )

USCITA.parent.mkdir(parents=True, exist_ok=True)
USCITA.write_text(
    json.dumps(
        {
            "type": "FeatureCollection",
            "features": features,
            "fonte": SORGENTE.name,
        },
        ensure_ascii=False,
        separators=(",", ":"),
    ),
    encoding="utf-8",
)

peso = USCITA.stat().st_size / 1024
print(f"segmenti: {len(features)}")
print(f"vertici:  {vertici_prima} -> {vertici_dopo} ({round((1 - vertici_dopo / vertici_prima) * 100)}% in meno)")
print(f"scritto:  {USCITA.name}  {peso:.0f} KB")
