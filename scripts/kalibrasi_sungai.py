"""Kalibrasi titik sungai untuk prakiraan debit GloFAS (Open-Meteo Flood API).

GloFAS memakai grid ~5 km. Koordinat kota di tepi sungai sering jatuh di sel tetangga yang bukan
alur utama, sehingga debitnya jauh terlalu kecil. Skrip ini mencari sel berdebit terbesar di sekitar
titik awal (data/sungai_awal.csv), lalu menghitung klimatologi 1991-2020 (median, persentil 90 dan 99)
untuk sel itu. Hasilnya data/sungai.csv, cukup dijalankan sekali.

    python scripts/kalibrasi_sungai.py
    python scripts/kalibrasi_sungai.py Kapuas Barito     # ulang sungai tertentu saja
"""

from __future__ import annotations

import csv
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np

AKAR = Path(__file__).resolve().parent.parent
API = "https://flood-api.open-meteo.com/v1/flood"
LANGKAH = 0.05


def ambil(params: dict) -> list[dict]:
    url = API + "?" + urllib.parse.urlencode(params)
    for percobaan in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "disaster-ops-data-build/1.0"}), timeout=120) as res:
                d = json.loads(res.read())
            return d if isinstance(d, list) else [d]
        except Exception as e:  # noqa: BLE001 - batas laju: tunggu lalu coba lagi
            print(f"    ulang ({e})")
            time.sleep(20 * (percobaan + 1))
    raise SystemExit("Flood API tidak menjawab")


def main() -> None:
    hanya = set(sys.argv[1:])
    jalur_hasil = AKAR / "data" / "sungai.csv"
    lama = {}
    if hanya and jalur_hasil.exists():
        with open(jalur_hasil, encoding="utf-8") as f:
            lama = {r["nama"]: r for r in csv.DictReader(f)}
    keluar = []
    with open(AKAR / "data" / "sungai_awal.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if hanya and r["nama"] not in hanya:
                if r["nama"] in lama:
                    keluar.append(lama[r["nama"]])
                continue
            lat0, lon0, cari = float(r["lat"]), float(r["lon"]), float(r["cari"])
            n = round(cari / LANGKAH)
            titik = [(lat0 + j * LANGKAH, lon0 + i * LANGKAH) for j in range(-n, n + 1) for i in range(-n, n + 1)]
            d = ambil({
                "latitude": ",".join(f"{t[0]:.3f}" for t in titik),
                "longitude": ",".join(f"{t[1]:.3f}" for t in titik),
                "daily": "river_discharge",
                "start_date": "2020-01-01",
                "end_date": "2020-12-31",
            })
            rata = [float(np.nanmean(np.array(x["daily"]["river_discharge"], dtype=float))) for x in d]
            k = int(np.nanargmax(rata))
            lat, lon = d[k]["latitude"], d[k]["longitude"]
            time.sleep(3)
            panjang = ambil({"latitude": f"{lat:.4f}", "longitude": f"{lon:.4f}", "daily": "river_discharge", "start_date": "1991-01-01", "end_date": "2020-12-31"})[0]
            q = np.array(panjang["daily"]["river_discharge"], dtype=float)
            q = q[np.isfinite(q)]
            p50, p90, p99 = (float(np.percentile(q, p)) for p in (50, 90, 99))
            print(f"  {r['nama']:14s} {r['lokasi']:14s} sel ({lat:.3f}, {lon:.3f})  rata 2020 {rata[k]:8.0f}  p50 {p50:8.0f}  p90 {p90:8.0f}  p99 {p99:8.0f} m3/s")
            keluar.append({"nama": r["nama"], "lokasi": r["lokasi"], "lat": round(lat, 4), "lon": round(lon, 4), "p50": round(p50, 1), "p90": round(p90, 1), "p99": round(p99, 1)})
            time.sleep(3)
    with open(jalur_hasil, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(keluar[0]))
        w.writeheader()
        w.writerows(keluar)
    print(f"-> data/sungai.csv ({len(keluar)} sungai)")


if __name__ == "__main__":
    main()
