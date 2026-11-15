"""Membangun data statis di public/data dari sumber publik.

    python scripts/bangun_data.py            # pakai berkas di data/sumber, unduh yang belum ada
    python scripts/bangun_data.py --hanya batimetri populasi

Sumber mentah yang besar (ETOPO, WorldPop, GEM, FIRMS 2019) disimpan di data/sumber dan tidak
ikut di-commit. Hasilnya kecil dan ikut di-commit, jadi aplikasi bisa jalan tanpa skrip ini.
Rincian sumber dan lisensi ada di data/SUMBER_DATA.md.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import struct
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np

AKAR = Path(__file__).resolve().parent.parent
SUMBER = AKAR / "data" / "sumber"
KELUAR = AKAR / "public" / "data"
UA = "disaster-ops-data-build/1.0 (+https://github.com/Avalon2222/disaster-ops)"

# kotak kerja: seluruh Indonesia plus laut di sekitarnya
KOTAK = {"lon_min": 92.0, "lon_max": 143.0, "lat_min": -13.0, "lat_max": 9.0}

URL = {
    # ETOPO 2022 15 detik busur, diambil tiap 16 sel (= 4 menit busur, ~7,4 km)
    "etopo.csv": "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.csvp?z%5B(-15):16:(12)%5D%5B(90):16:(145)%5D",
    "idn_pop.tif": "https://data.worldpop.org/GIS/Population/Global_2000_2020_1km_UNadj/2020/IDN/idn_ppp_2020_1km_Aggregated_UNadj.tif",
    "gem_faults.geojson": "https://raw.githubusercontent.com/GEMScienceTools/gem-global-active-faults/master/geojson/gem_active_faults_harmonized.geojson",
    "pb2002.json": "https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json",
    "usgs_m6.json": "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=1900-01-01&minmagnitude=6&minlatitude=-13&maxlatitude=9&minlongitude=92&maxlongitude=143&orderby=time",
    "modis_2019_Indonesia.csv": "https://firms.modaps.eosdis.nasa.gov/data/country/modis/2019/modis_2019_Indonesia.csv",
}
OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]


def ambil(nama: str) -> Path:
    """Berkas sumber; diunduh kalau belum ada."""
    jalur = SUMBER / nama
    if jalur.exists() and jalur.stat().st_size > 1000:
        return jalur
    SUMBER.mkdir(parents=True, exist_ok=True)
    print(f"  unduh {nama} ...")
    req = urllib.request.Request(URL[nama], headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=600) as res, open(jalur, "wb") as f:
        f.write(res.read())
    return jalur


def tulis_json(nama: str, isi) -> None:
    KELUAR.mkdir(parents=True, exist_ok=True)
    jalur = KELUAR / nama
    jalur.write_text(json.dumps(isi, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"  -> {jalur.relative_to(AKAR)} ({jalur.stat().st_size / 1024:.0f} KB)")


def dalam_kotak(lon: float, lat: float) -> bool:
    return KOTAK["lon_min"] <= lon <= KOTAK["lon_max"] and KOTAK["lat_min"] <= lat <= KOTAK["lat_max"]


# ---------------------------------------------------------------- batimetri


def bangun_batimetri() -> dict:
    """Grid kedalaman laut (Int16, meter; daratan positif) untuk waktu tempuh tsunami."""
    lat, lon, z = [], [], []
    with open(ambil("etopo.csv"), encoding="utf-8") as f:
        next(f)
        for baris in f:
            a, b, c = baris.split(",")
            lat.append(float(a))
            lon.append(float(b))
            z.append(float(c))
    lat_u = sorted(set(lat))
    lon_u = sorted(set(lon))
    ny, nx = len(lat_u), len(lon_u)
    assert ny * nx == len(z), "grid ETOPO tidak persegi"
    grid = np.array(z, dtype=np.float32).reshape(ny, nx)  # baris 0 = paling selatan
    data = np.clip(np.round(grid), -32000, 32000).astype("<i2")
    (KELUAR / "batimetri.dat").write_bytes(data.tobytes())
    meta = {"lon0": round(lon_u[0], 5), "lat0": round(lat_u[0], 5), "dx": round(lon_u[1] - lon_u[0], 6), "nx": nx, "ny": ny}
    print(f"  -> public/data/batimetri.dat {nx}x{ny} ({data.nbytes / 1024:.0f} KB), terdalam {data.min()} m")
    return meta


# ---------------------------------------------------------------- populasi

FAKTOR = 6  # 30 detik busur x 6 = 3 menit busur (0,05 derajat, ~5,5 km)
SKALA_AKAR = 60  # nilai tersimpan = round(sqrt(penduduk) * 60), muat sampai 1,19 juta per sel


def bangun_populasi() -> dict:
    """Grid penduduk WorldPop 2020 (UN-adjusted) dijumlahkan ke sel 0,05 derajat."""
    from PIL import Image

    Image.MAX_IMAGE_PIXELS = None
    im = Image.open(ambil("idn_pop.tif"))
    skala = im.tag_v2[33550]
    ikat = im.tag_v2[33922]
    a = np.array(im, dtype=np.float64)
    a[a < 0] = 0
    ny0, nx0 = a.shape
    ny, nx = ny0 // FAKTOR, nx0 // FAKTOR
    kecil = a[: ny * FAKTOR, : nx * FAKTOR].reshape(ny, FAKTOR, nx, FAKTOR).sum(axis=(1, 3))
    kecil = kecil[::-1]  # baris 0 = paling selatan
    total = float(a.sum())
    simpan = np.clip(np.round(np.sqrt(kecil) * SKALA_AKAR), 0, 65535).astype("<u2")
    (KELUAR / "populasi.dat").write_bytes(simpan.tobytes())
    dx = skala[0] * FAKTOR
    lat_atas = ikat[4]
    meta = {
        "lon0": round(ikat[3] + dx / 2, 5),  # pusat sel pertama
        "lat0": round(lat_atas - ny * dx + dx / 2, 5),
        "dx": round(dx, 6),
        "nx": nx,
        "ny": ny,
        "skala_akar": SKALA_AKAR,
        "total": round(total),
    }
    balik = float(((simpan.astype(np.float64) / SKALA_AKAR) ** 2).sum())
    print(f"  -> public/data/populasi.dat {nx}x{ny} ({simpan.nbytes / 1024:.0f} KB), total {total / 1e6:.1f} juta, setelah kuantisasi {balik / 1e6:.1f} juta")
    return meta


# ---------------------------------------------------------------- sesar & megathrust


def _potong(koordinat: list, presisi: int = 3) -> list:
    hasil = []
    for c in koordinat:
        p = [round(c[0], presisi), round(c[1], presisi)]
        if not hasil or hasil[-1] != p:
            hasil.append(p)
    return hasil


def _angka_pertama(teks) -> float | None:
    try:
        return float(str(teks).strip("()").split(",")[0])
    except (ValueError, IndexError):
        return None


def bangun_sesar() -> None:
    """Sesar aktif (GEM) dan batas subduksi (PB2002) di kawasan Indonesia."""
    fitur = []
    gem = json.loads(ambil("gem_faults.geojson").read_text(encoding="utf-8"))
    for f in gem["features"]:
        g = f["geometry"]
        garis = [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]
        p = f["properties"]
        for l in garis:
            if not any(dalam_kotak(c[0], c[1]) for c in l):
                continue
            l2 = _potong(l)
            if len(l2) < 2:
                continue
            fitur.append({
                "type": "Feature",
                "properties": {
                    "jenis": "sesar",
                    "nama": p.get("name") or "",
                    "gerak": p.get("slip_type") or "",
                    "laju": _angka_pertama(p.get("net_slip_rate")),
                },
                "geometry": {"type": "LineString", "coordinates": l2},
            })
    n_sesar = len(fitur)
    pb = json.loads(ambil("pb2002.json").read_text(encoding="utf-8"))
    for f in pb["features"]:
        p = f["properties"]
        if p.get("Type") != "subduction":
            continue
        l = f["geometry"]["coordinates"]
        if not any(dalam_kotak(c[0], c[1]) for c in l):
            continue
        fitur.append({
            "type": "Feature",
            "properties": {"jenis": "megathrust", "nama": f"Subduksi {p.get('Name', '')}", "gerak": "Subduction", "laju": None},
            "geometry": {"type": "LineString", "coordinates": _potong(l)},
        })
    print(f"  sesar aktif {n_sesar}, segmen subduksi {len(fitur) - n_sesar}")
    tulis_json("sesar.geojson", {"type": "FeatureCollection", "features": fitur})


# ---------------------------------------------------------------- gempa historis


def bangun_gempa_historis() -> None:
    """Katalog USGS M>=6 sejak 1900: [lon, lat, kedalaman km, magnitudo, tahun, tempat]."""
    u = json.loads(ambil("usgs_m6.json").read_text(encoding="utf-8"))
    baris = []
    for f in u["features"]:
        lon, lat, dalam = f["geometry"]["coordinates"]
        p = f["properties"]
        if p.get("mag") is None:
            continue
        tahun = 1970 + p["time"] / 31_556_952_000
        baris.append([round(lon, 2), round(lat, 2), round(dalam or 0), round(p["mag"], 1), int(tahun), (p.get("place") or "").replace(", Indonesia", "")])
    baris.sort(key=lambda b: b[4])
    print(f"  gempa M>=6: {len(baris)} ({baris[0][4]}-{baris[-1][4]}), M>=7,5: {sum(1 for b in baris if b[3] >= 7.5)}")
    tulis_json("gempa_historis.json", baris)


# ---------------------------------------------------------------- karhutla 2019


def bangun_karhutla_2019() -> dict:
    """Titik panas MODIS Juli-November 2019. 6 byte per titik: lon*100, lat*100 (Int16), hari (Uint8), FRP (Uint8, log)."""
    from datetime import date

    mulai, akhir = date(2019, 7, 1), date(2019, 11, 30)
    n_hari = (akhir - mulai).days + 1
    buf = bytearray()
    per_hari = [0] * n_hari
    frp_hari = [0.0] * n_hari
    with open(ambil("modis_2019_Indonesia.csv"), encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["type"] != "0" or int(r["confidence"]) < 30:
                continue
            y, m, d = map(int, r["acq_date"].split("-"))
            t = date(y, m, d)
            if not (mulai <= t <= akhir):
                continue
            h = (t - mulai).days
            frp = float(r["frp"] or 0)
            kode = min(255, round(math.log1p(frp) * 32))
            buf += struct.pack("<hhBB", round(float(r["longitude"]) * 100), round(float(r["latitude"]) * 100), h, kode)
            per_hari[h] += 1
            frp_hari[h] += frp
    # urutkan menurut hari supaya pemutar cukup menggeser indeks
    rek = [buf[i : i + 6] for i in range(0, len(buf), 6)]
    rek.sort(key=lambda b: b[4])
    (KELUAR / "karhutla2019.dat").write_bytes(b"".join(rek))
    print(f"  -> public/data/karhutla2019.dat {len(rek)} titik ({len(buf) / 1024:.0f} KB), puncak {max(per_hari)} titik/hari")
    return {"mulai": mulai.isoformat(), "hari": n_hari, "jumlah": len(rek), "per_hari": per_hari, "frp_hari": [round(x) for x in frp_hari]}


# ---------------------------------------------------------------- rumah sakit


def bangun_rs() -> None:
    """Rumah sakit dari OpenStreetMap (amenity=hospital): [lon, lat, nama]."""
    jalur = SUMBER / "rs_osm.json"
    if not jalur.exists() or jalur.stat().st_size < 10_000:
        kueri = '[out:json][timeout:300];area["ISO3166-1"="ID"][admin_level=2]->.a;(nwr["amenity"="hospital"](area.a););out center tags;'
        badan = urllib.parse.urlencode({"data": kueri}).encode()
        for url in OVERPASS:
            try:
                print(f"  Overpass {url} ...")
                req = urllib.request.Request(url, data=badan, headers={"User-Agent": UA, "Accept": "application/json"})
                with urllib.request.urlopen(req, timeout=400) as res:
                    isi = res.read()
                if len(isi) > 10_000:
                    jalur.write_bytes(isi)
                    break
            except Exception as e:  # noqa: BLE001 - coba cermin berikutnya
                print(f"    gagal: {e}")
        else:
            raise SystemExit("Semua server Overpass gagal")
    d = json.loads(jalur.read_text(encoding="utf-8"))
    baris, lihat = [], set()
    for e in d["elements"]:
        lat = e.get("lat") or (e.get("center") or {}).get("lat")
        lon = e.get("lon") or (e.get("center") or {}).get("lon")
        if lat is None or lon is None:
            continue
        nama = (e.get("tags") or {}).get("name") or ""
        kunci = (round(lon, 3), round(lat, 3))
        if kunci in lihat:
            continue
        lihat.add(kunci)
        baris.append([round(lon, 4), round(lat, 4), nama.strip()])
    baris.sort()
    print(f"  rumah sakit: {len(baris)} ({sum(1 for b in baris if b[2])} bernama)")
    tulis_json("rs.json", baris)


# ---------------------------------------------------------------- berkas kecil


def bangun_kecil() -> None:
    """Provinsi, gunung api, kota: salin/ubah bentuk dari CSV di data/."""
    prov = json.loads((AKAR / "data" / "provinsi.geojson").read_text(encoding="utf-8"))
    for f in prov["features"]:
        f.pop("id", None)
    tulis_json("provinsi.geojson", prov)

    gunung = []
    with open(AKAR / "data" / "gunung_api.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            gunung.append({"nama": r["nama"], "lat": float(r["lat"]), "lon": float(r["lon"]), "elevasi": int(float(r["elevasi_m"])), "provinsi": r["provinsi"]})
    tulis_json("gunung.json", gunung)

    kota, lihat = [], set()
    with open(AKAR / "data" / "kota.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            kota.append({"nama": r["nama"], "lat": float(r["lat"]), "lon": float(r["lon"]), "provinsi": r["provinsi"], "utama": 1})
            lihat.add(r["nama"].lower())
    with open(AKAR / "data" / "ibukota_kabupaten.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            lat, lon = float(r["lat"]), float(r["lon"])
            # nama sama, atau berimpit dengan kota yang sudah ada (ejaan beda: Tua Pejat / Tuapejat)
            if r["ibukota"].lower() in lihat or any(abs(k["lat"] - lat) < 0.07 and abs(k["lon"] - lon) < 0.07 for k in kota):
                continue
            lihat.add(r["ibukota"].lower())
            kota.append({"nama": r["ibukota"], "lat": float(r["lat"]), "lon": float(r["lon"]), "provinsi": "", "kab": r["kabupaten"], "utama": 0})
    tulis_json("kota.json", kota)


TAHAP = {
    "batimetri": bangun_batimetri,
    "populasi": bangun_populasi,
    "sesar": bangun_sesar,
    "gempa": bangun_gempa_historis,
    "karhutla2019": bangun_karhutla_2019,
    "rs": bangun_rs,
    "kecil": bangun_kecil,
}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--hanya", nargs="*", choices=list(TAHAP), help="tahap yang dijalankan (default semua)")
    args = ap.parse_args()
    KELUAR.mkdir(parents=True, exist_ok=True)
    jalur_meta = KELUAR / "grid.json"
    meta = json.loads(jalur_meta.read_text(encoding="utf-8")) if jalur_meta.exists() else {}
    for nama in args.hanya or list(TAHAP):
        print(f"[{nama}]")
        hasil = TAHAP[nama]()
        if isinstance(hasil, dict):
            meta[nama] = hasil
    tulis_json("grid.json", meta)


if __name__ == "__main__":
    sys.exit(main())
