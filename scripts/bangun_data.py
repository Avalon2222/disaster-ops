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
import time
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
    # ekspor OpenStreetMap oleh Humanitarian OpenStreetMap Team (HDX), diperbarui berkala
    "rs_hotosm.zip": "https://production-raw-data-api.s3.amazonaws.com/ISO3/IDN/health_facilities/hotosm_idn_health_facilities_osm_geojson.zip",
}


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


# pusat kasar kepulauan Indonesia: gigi megathrust menunjuk ke arah sini (lempeng yang menumpang)
PUSAT_NUSANTARA = (118.0, -2.0)


def _chaikin(garis: list, ulang: int = 2) -> list:
    """Haluskan sudut garis (Chaikin): tiap ruas diganti dua titik di 1/4 dan 3/4-nya."""
    for _ in range(ulang):
        if len(garis) < 3:
            break
        hasil = [garis[0]]
        for a, b in zip(garis, garis[1:]):
            hasil.append([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25])
            hasil.append([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75])
        hasil.append(garis[-1])
        garis = hasil
    return garis


def _sambung(potongan: list[list]) -> list[list]:
    """Rangkai potongan garis yang ujungnya bertemu jadi garis panjang."""
    sisa = [list(p) for p in potongan]
    hasil = []
    dekat = lambda a, b: abs(a[0] - b[0]) < 0.02 and abs(a[1] - b[1]) < 0.02  # noqa: E731
    while sisa:
        garis = sisa.pop(0)
        berubah = True
        while berubah:
            berubah = False
            for i, p in enumerate(sisa):
                if dekat(garis[-1], p[0]):
                    garis += p[1:]
                elif dekat(garis[-1], p[-1]):
                    garis += p[::-1][1:]
                elif dekat(garis[0], p[-1]):
                    garis = p[:-1] + garis
                elif dekat(garis[0], p[0]):
                    garis = p[::-1][:-1] + garis
                else:
                    continue
                sisa.pop(i)
                berubah = True
                break
        hasil.append(garis)
    return hasil


def _arahkan(garis: list) -> list:
    """Balik arah garis kalau perlu, supaya pusat Nusantara ada di sisi KIRI arah jalannya."""
    cx, cy = PUSAT_NUSANTARA
    silang = sum((b[0] - a[0]) * (cy - a[1]) - (b[1] - a[1]) * (cx - a[0]) for a, b in zip(garis, garis[1:]))
    return garis if silang >= 0 else garis[::-1]


def bangun_sesar() -> None:
    """Sesar aktif (GEM) dan zona subduksi (PB2002) di kawasan Indonesia."""
    fitur = []
    lihat = set()
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
            # katalog GEM memuat sebagian sesar dua kali (dari dua sumber): cukup satu
            kunci = (tuple(l2[0]), tuple(l2[-1]), len(l2))
            if kunci in lihat or (kunci[1], kunci[0], kunci[2]) in lihat:
                continue
            lihat.add(kunci)
            # jejak yang didigitasi kasar (ruas panjang, belokan patah) dihaluskan supaya tidak tampak bersudut
            if max(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(l2, l2[1:])) > 0.12:
                l2 = _potong(_chaikin(l2))
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
    pb = json.loads(ambil("pb2002.json").read_text(encoding="utf-8"))
    potongan = [f["geometry"]["coordinates"] for f in pb["features"] if f["properties"].get("Type") == "subduction" and any(dalam_kotak(c[0], c[1]) for c in f["geometry"]["coordinates"])]
    megathrust = []
    for garis in _sambung(potongan):
        # dirangkai, diarahkan (gigi menunjuk ke lempeng yang menumpang), lalu dihaluskan
        halus = _potong(_chaikin(_arahkan(garis)))
        megathrust.append({
            "type": "Feature",
            "properties": {"jenis": "megathrust", "nama": "", "gerak": "Subduction", "laju": None},
            "geometry": {"type": "LineString", "coordinates": halus},
        })
    # GEM juga memuat jejak palung yang sama dengan garis megathrust: dibuang supaya tidak ada garis kembar
    rapat = []
    for m in megathrust:
        k = m["geometry"]["coordinates"]
        for (x0, y0), (x1, y1) in zip(k, k[1:]):
            n = max(1, int(math.hypot(x1 - x0, y1 - y0) / 0.1))
            rapat += [(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n) for i in range(n + 1)]
    rapat = np.array(rapat)

    def kembar(f) -> bool:
        k = np.array(f["geometry"]["coordinates"])
        jarak = np.sqrt(((k[:, None, :] - rapat[None, :, :]) ** 2).sum(axis=2)).min(axis=1)
        return float((jarak < 0.45).mean()) >= 0.7 or "subduction" in f["properties"]["gerak"].lower()

    sebelum = len(fitur)
    fitur = [f for f in fitur if not kembar(f)]
    n_sesar = len(fitur)
    print(f"  {sebelum - n_sesar} jejak GEM dibuang karena berimpit dengan megathrust")
    fitur += megathrust
    print(f"  sesar aktif {n_sesar}, zona subduksi {len(fitur) - n_sesar} (dari {len(potongan)} potongan)")
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
    # ringkasan harian sebagai CSV biasa, supaya bisa dipakai di luar aplikasi ini
    from datetime import timedelta

    with open(AKAR / "data" / "karhutla_2019_harian.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["tanggal", "titik_panas", "frp_total_mw"])
        for h in range(n_hari):
            w.writerow([(mulai + timedelta(days=h)).isoformat(), per_hari[h], round(frp_hari[h])])
    return {"mulai": mulai.isoformat(), "hari": n_hari, "jumlah": len(rek), "per_hari": per_hari, "frp_hari": [round(x) for x in frp_hari]}


# ---------------------------------------------------------------- rumah sakit


def bangun_rs() -> None:
    """Rumah sakit dari OpenStreetMap (amenity=hospital), lewat ekspor HOT: [lon, lat, nama]."""
    import zipfile

    with zipfile.ZipFile(ambil("rs_hotosm.zip")) as z:
        d = json.loads(z.read("health_facilities.geojson"))
    baris, lihat = [], set()
    for f in d["features"]:
        p = f["properties"]
        if p.get("amenity") != "hospital":
            continue
        g = f["geometry"]
        if g["type"] == "Point":
            lon, lat = g["coordinates"][:2]
        elif g["type"] in ("Polygon", "MultiPolygon"):
            # bangunan rumah sakit: pakai titik tengah ring luarnya
            ring = g["coordinates"][0] if g["type"] == "Polygon" else g["coordinates"][0][0]
            lon = sum(c[0] for c in ring) / len(ring)
            lat = sum(c[1] for c in ring) / len(ring)
        else:
            continue
        if not dalam_kotak(lon, lat):
            continue
        # node dan bangunan untuk rumah sakit yang sama sering dua-duanya ada: cukup satu per ~100 m
        kunci = (round(lon, 3), round(lat, 3))
        if kunci in lihat:
            continue
        lihat.add(kunci)
        nama = (p.get("name") or p.get("name_id") or p.get("name_en") or "").strip()
        baris.append([round(lon, 4), round(lat, 4), nama])
    baris.sort()
    print(f"  rumah sakit: {len(baris)} ({sum(1 for b in baris if b[2])} bernama)")
    tulis_json("rs.json", baris)


# ---------------------------------------------------------------- peta bahaya InaRISK

# Kotak ini harus sama dengan KOTAK_INARISK di src/lib/peta/pasang.ts
KOTAK_INARISK = (94.5, -11.5, 141.5, 6.5)
LEBAR_INARISK = 4096
LAYANAN_INARISK = {
    "gempa": "INDEKS_BAHAYA_GEMPABUMI",
    "tsunami": "INDEKS_BAHAYA_TSUNAMI",
    "banjir": "INDEKS_BAHAYA_BANJIR",
    "longsor": "INDEKS_BAHAYA_TANAHLONGSOR",
    "karhutla": "INDEKS_BAHAYA_KARHUTLA",
    "gunungapi": "INDEKS_BAHAYA_GUNUNGAPI",
}
# bahaya yang bentuknya tipis (pesisir, lereng gunung): ditebalkan sedikit supaya terbaca dari jauh
TEBALKAN_INARISK = {"tsunami": 2, "gunungapi": 2}


def _merc(lat: float) -> float:
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def _baca_tiff_jarang(jalur: Path) -> np.ndarray:
    """
    TIFF F32 dari ArcGIS itu "jarang": ubin yang seluruhnya kosong tidak disimpan (offset 0).
    Pillow tetap membacanya dari awal berkas, jadi ubin itu berisi sampah header. Di sini diganti NaN.
    """
    from PIL import Image

    im = Image.open(jalur)
    a = np.array(im, dtype=np.float32)
    tag = im.tag_v2
    offset, lebar_ubin, tinggi_ubin = tag.get(324), tag.get(322), tag.get(323)
    if offset and lebar_ubin and tinggi_ubin:
        per_baris = math.ceil(a.shape[1] / lebar_ubin)
        for i, o in enumerate(offset):
            if o == 0:
                r, k = divmod(i, per_baris)
                a[r * tinggi_ubin : (r + 1) * tinggi_ubin, k * lebar_ubin : (k + 1) * lebar_ubin] = np.nan
    return a


def _indeks_inarisk(layanan: str, lebar: int, tinggi: int) -> np.ndarray:
    """Indeks bahaya 0..1 (NaN = tidak ada data) dari ImageServer BNPB, diambil dua kali resolusi tujuan dalam dua paruh."""
    from io import BytesIO

    from PIL import Image

    x0, y0, x1, y1 = KOTAK_INARISK
    tengah = (x0 + x1) / 2
    paruh = []
    for i, (a, b) in enumerate(((x0, tengah), (tengah, x1))):
        jalur = SUMBER / f"inarisk_{layanan}_{i}.tif"
        if not jalur.exists() or jalur.stat().st_size < 100_000:
            url = (
                f"https://gis.bnpb.go.id/server/rest/services/inarisk/{layanan}/ImageServer/exportImage"
                f"?bbox={a},{y0},{b},{y1}&bboxSR=4326&imageSR=3857&size={lebar},{tinggi * 2}&format=tiff&pixelType=F32&noData=-9999&f=image"
            )
            for coba in range(4):
                try:
                    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36"})
                    with urllib.request.urlopen(req, timeout=300) as res:
                        isi = res.read()
                    Image.open(BytesIO(isi)).size  # noqa: B018 - pastikan benar-benar gambar
                    jalur.write_bytes(isi)
                    break
                except Exception as e:  # noqa: BLE001
                    print(f"    {layanan} paruh {i} gagal ({e}), coba lagi")
                    time.sleep(10 * (coba + 1))
            else:
                raise SystemExit(f"InaRISK {layanan} tidak bisa diambil")
        paruh.append(_baca_tiff_jarang(jalur))
    a = np.concatenate(paruh, axis=1)
    a[~((a >= 0) & (a <= 1.001))] = np.nan
    return a


def bangun_inarisk() -> None:
    """Peta bahaya InaRISK (BNPB) jadi satu gambar per jenis, sudah diwarnai dengan palet sendiri."""
    from PIL import Image

    palet = json.loads((AKAR / "src" / "lib" / "peta" / "palet_inarisk.json").read_text(encoding="utf-8"))
    x0, y0, x1, y1 = KOTAK_INARISK
    lebar = LEBAR_INARISK
    tinggi = round(lebar * (_merc(y1) - _merc(y0)) / math.radians(x1 - x0))
    keluar = KELUAR / "inarisk"
    keluar.mkdir(parents=True, exist_ok=True)
    for jenis, layanan in LAYANAN_INARISK.items():
        a = _indeks_inarisk(layanan, lebar, tinggi)
        # turunkan 2x dengan rata-rata yang sadar "tidak ada data": tepi pulau jadi halus, bukan bergerigi
        ada = np.isfinite(a)
        nilai = np.where(ada, a, 0).reshape(tinggi, 2, lebar, 2).sum(axis=(1, 3))
        cakup = ada.reshape(tinggi, 2, lebar, 2).sum(axis=(1, 3)).astype(np.float32)
        v = np.where(cakup > 0, nilai / np.maximum(cakup, 1), 0)
        cakup /= 4
        henti = np.array(palet[jenis], dtype=np.float32)
        rgba = np.stack([np.interp(v, henti[:, 0], henti[:, k]) for k in (1, 2, 3, 4)], axis=-1)
        alfa = rgba[..., 3] * np.minimum(1, cakup * 1.5)
        for _ in range(TEBALKAN_INARISK.get(jenis, 0)):
            # tebalkan: piksel kosong mengambil warna tetangga terkuatnya, sedikit lebih pudar
            terbaik = alfa.copy()
            warna = rgba[..., :3].copy()
            for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                geser_a = np.roll(alfa, (dy, dx), axis=(0, 1)) * 0.8
                geser_w = np.roll(rgba[..., :3], (dy, dx), axis=(0, 1))
                ganti = geser_a > terbaik
                terbaik = np.where(ganti, geser_a, terbaik)
                warna = np.where(ganti[..., None], geser_w, warna)
            alfa = terbaik
            rgba = np.concatenate([warna, alfa[..., None]], axis=-1)
        rgba[..., 3] = alfa
        gambar = Image.fromarray(np.clip(rgba + 0.5, 0, 255).astype(np.uint8), "RGBA")
        jalur = keluar / f"{jenis}.webp"
        gambar.save(jalur, "WEBP", quality=84, alpha_quality=92, method=6)
        terisi = float((alfa > 8).mean()) * 100
        print(f"  -> {jalur.relative_to(AKAR)} {lebar}x{tinggi} ({jalur.stat().st_size / 1024:.0f} KB), {terisi:.1f}% piksel berwarna")


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
    "inarisk": bangun_inarisk,
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
