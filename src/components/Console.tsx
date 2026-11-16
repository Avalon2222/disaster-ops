"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapLibre, MapMouseEvent, PointLike, RasterTileSource } from "maplibre-gl";
import AlatGempa, { DALAM_AWAL, MAG_AWAL, type SkenarioGempa } from "./AlatGempa";
import AlatTsunami, { MAG_TSUNAMI_AWAL } from "./AlatTsunami";
import Bantuan from "./Bantuan";
import Boot from "./Boot";
import Cari from "./Cari";
import Hud, { type Alat } from "./Hud";
import LiniMasa, { type Legenda } from "./LiniMasa";
import PanelDetail from "./PanelDetail";
import RelLapisan, { ChipLapisan } from "./RelLapisan";
import Replay2019 from "./Replay2019";
import Ticker from "./Ticker";
import WarRoom from "./WarRoom";
import { UMUR_MAKS_CUACA, useData, type KunciSumber } from "./konsol/useData";
import { TOLERANSI_KLIK, usePeta, useSempit, type PenanganPeta } from "./konsol/usePeta";
import type { Entitas } from "@/lib/cari";
import type { PoligonBerkotak } from "@/lib/geo";
import { terjemah, type Kunci, type Lang } from "@/lib/i18n";
import { defLapisan, LAPISAN, LAPISAN_AWAL, medanAktif, modeWaktu, toggleLapisan, type IdLapisan, type JenisInarisk } from "@/lib/lapisan";
import { gugusApi, kotaTerpapar, lintasanAsap, type MedanAngin } from "@/lib/model/asap";
import { NAMA_TINGKAT, statusSungai } from "@/lib/model/banjir";
import { prakiraanPerProvinsi, provinsiPerSel } from "@/lib/model/prakiraan";
import { susunSitrep } from "@/lib/model/sitrep";
import { fiturBencana, fiturGempa, fiturGunung, fiturHistoris, fiturHotspot, fiturLaporan, fiturPeringatan, fiturRs, fiturSungai, pusatPoligon, type Pilihan } from "@/lib/peta/fitur";
import { gambarMedan, pasangGambar } from "@/lib/peta/medan";
import { animasiArus, LAYER_INTERAKTIF, pudarkanRaster, setData, sinkronVisibilitas, sorotGaris, SUDUT_INARISK, titik, urlCitra, urlInarisk } from "@/lib/peta/pasang";
import { hujanTerbasah, labelMedan, ringkasPilihan } from "@/lib/peta/ringkas";
import { SKALA } from "@/lib/peta/warna";
import { muatGunungStatis, muatHistoris, muatKota, muatPenduduk, muatProvinsi, muatRs, type GempaHistoris, type Kota } from "@/lib/statis";
import { ringkasPerProvinsi } from "@/lib/sumber/firms";
import { bacaUrl, tampilanAwal, tulisUrl } from "@/lib/urlState";
import { formatHariWib, formatWib, tanggalWib, umur } from "@/lib/waktu";

const KUNCI_BAHASA = "dops-bahasa";
const URUTAN_KLIK = ["gempa-titik", "gunung-ikon", "bencana-ikon", "laporan-ikon", "sungai-ikon", "hotspot-titik", "rs-ikon", "rs-titik", "replay-titik", "historis-titik", "sesar-kena", "peringatan-isi"];
/** lapisan yang tetap tampil saat alat skenario gempa/tsunami terbuka */
const LAPISAN_SAAT_ALAT: IdLapisan[] = ["sesar", "inarisk", "penduduk", "rs"];
/** lapisan yang bergantung pada tiap sumber, untuk menandai "sumber sedang mati" di rel */
const LAPISAN_SUMBER: Record<KunciSumber, IdLapisan[]> = {
  hotspot: ["hotspot"],
  gempa: ["gempa"],
  gunung: ["gunung"],
  bencana: ["bencana", "laporan"],
  peringatan: ["peringatan"],
  cuaca: ["angin", "hujan", "suhu", "udara", "fwi", "asap", "banjir", "sungai"],
};

function bahasaAwal(dariUrl?: Lang): Lang {
  if (dariUrl) return dariUrl;
  try {
    const simpan = window.localStorage.getItem(KUNCI_BAHASA);
    if (simpan === "en" || simpan === "id") return simpan;
  } catch {
    /* penyimpanan diblokir */
  }
  return "id";
}

export default function Console() {
  const awal = useMemo(() => bacaUrl(), []);
  const [lang, setLang] = useState<Lang>(() => bahasaAwal(awal.lang));
  const [aktif, setAktif] = useState<Set<IdLapisan>>(() => new Set(awal.lapisan ?? LAPISAN_AWAL));
  const [sat, setSat] = useState(Boolean(awal.sat));
  const [datar, setDatar] = useState(Boolean(awal.datar));
  const [boot, setBoot] = useState(true);
  const [alat, setAlat] = useState<Alat | null>(awal.alat ?? null);
  const [pilihan, setPilihan] = useState<Pilihan | null>(null);
  const [rentang, setRentang] = useState<24 | 168>(24);
  const [inarisk, setInarisk] = useState<JenisInarisk>("gempa");
  const [posisiJam, setPosisiJam] = useState<number | null>(null);
  const [posisiHari, setPosisiHari] = useState(0);
  const [main, setMain] = useState(false);
  const [skenGempa, setSkenGempa] = useState<SkenarioGempa | null>(null);
  const [skenTsunami, setSkenTsunami] = useState<SkenarioGempa | null>(null);
  const [cari, setCari] = useState(false);
  const [bantuan, setBantuan] = useState(false);
  const [briefing, setBriefing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sekarang, setSekarang] = useState(() => Date.now());
  const [kota, setKota] = useState<Kota[]>([]);
  const [provinsi, setProvinsi] = useState<PoligonBerkotak[]>([]);
  const [entitas, setEntitas] = useState<Entitas[]>([]);
  const [jumlahRs, setJumlahRs] = useState<number | null>(null);

  const t = useCallback((k: Kunci) => terjemah(lang, k), [lang]);
  const sempit = useSempit();
  const data = useData(rentang);
  const historisRef = useRef<GempaHistoris[]>([]);

  // --- peta ---
  const penanganRef = useRef<PenanganPeta>({ saatKlik: () => undefined, saatMoveEnd: () => undefined, saatHover: () => false, saatKeluar: () => undefined });
  const tipRef = useRef<HTMLDivElement>(null);
  const tampilan = useMemo(() => awal.tampilan ?? tampilanAwal(), [awal]);
  const { wadahRef, map, online, kanvasTsunami, efekRef, terapkanSat } = usePeta({ tampilan, satAwal: Boolean(awal.sat), datarAwal: Boolean(awal.datar), penanganRef });

  // jam berjalan (untuk umur data dan posisi "sekarang" di lini masa)
  useEffect(() => {
    const id = setInterval(() => setSekarang(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      window.localStorage.setItem(KUNCI_BAHASA, lang);
    } catch {
      /* penyimpanan diblokir */
    }
  }, [lang]);

  // data statis untuk pencarian dan ringkasan per provinsi
  useEffect(() => {
    let hidup = true;
    Promise.all([muatKota(), muatProvinsi(), muatGunungStatis()])
      .then(([k, p, g]) => {
        if (!hidup) return;
        setKota(k);
        setProvinsi(p);
        const daftar: Entitas[] = [
          ...k.map((x): Entitas => ({ jenis: "kota", nama: x.nama, ket: x.provinsi || x.kab || "", lon: x.lon, lat: x.lat, zoom: 9, bobot: x.utama ? 3 : 1 })),
          ...g.map((x): Entitas => ({ jenis: "gunung", nama: x.nama, ket: x.provinsi, lon: x.lon, lat: x.lat, zoom: 9.5, bobot: 2 })),
          ...p.map((x): Entitas => ({ jenis: "provinsi", nama: x.nama, ket: "", lon: (x.kotak[0] + x.kotak[2]) / 2, lat: (x.kotak[1] + x.kotak[3]) / 2, zoom: 6.2, bobot: 2 })),
        ];
        setEntitas(daftar);
      })
      .catch(() => undefined);
    return () => {
      hidup = false;
    };
  }, []);

  const cuaca = data.cuaca && sekarang - data.cuaca.dibuat < UMUR_MAKS_CUACA ? data.cuaca : null;

  // sungai ikut bisa dicari begitu snapshot datang
  const entitasLengkap = useMemo<Entitas[]>(() => {
    if (!cuaca) return entitas;
    return [...entitas, ...cuaca.sungai.map((s): Entitas => ({ jenis: "sungai", nama: `Sungai ${s.nama}`, ket: s.lokasi, lon: s.lon, lat: s.lat, zoom: 8.5, bobot: 1 }))];
  }, [entitas, cuaca]);

  // --- lini masa ---
  const langkahKini = cuaca ? Math.min(cuaca.medan.u10.length - 1, Math.max(0, Math.floor((sekarang - cuaca.medan.mulai) / (cuaca.medan.langkahJam * 3600_000)))) : 0;
  const jam = posisiJam ?? langkahKini;
  const replay = alat === "replay";
  // putar ulang menyembunyikan semua lapisan; alat skenario hanya menyisakan lapisan bahaya & eksposur supaya petanya terbaca
  const aktifEfektif = useMemo(() => {
    if (replay) return new Set<IdLapisan>();
    if (alat === "gempa" || alat === "tsunami") return new Set([...aktif].filter((id) => LAPISAN_SAAT_ALAT.includes(id)));
    return aktif;
  }, [replay, alat, aktif]);
  const mode = replay || alat === "tsunami" || alat === "gempa" ? null : cuaca ? modeWaktu(aktifEfektif) : null;
  const hariKini = cuaca ? Math.max(0, cuaca.harian.hari.indexOf(tanggalWib(sekarang))) : 0;
  const hari = Math.max(posisiHari, hariKini);

  useEffect(() => {
    if (!main || !mode || !cuaca) return;
    const id = setInterval(
      () => {
        if (mode === "jam") setPosisiJam((p) => ((p ?? langkahKini) + 1 >= cuaca.medan.u10.length ? langkahKini : (p ?? langkahKini) + 1));
        else setPosisiHari((p) => (Math.max(p, hariKini) + 1 >= cuaca.harian.hari.length ? hariKini : Math.max(p, hariKini) + 1));
      },
      mode === "jam" ? 650 : 1300,
    );
    return () => clearInterval(id);
  }, [main, mode, cuaca, langkahKini, hariKini]);

  // --- ringkasan turunan ---
  const titik24 = useMemo(() => (data.hotspot ? data.hotspot.titik.filter((x) => x[4] >= sekarang / 60_000 - 1440) : []), [data.hotspot, sekarang]);
  const gugus = useMemo(() => gugusApi(titik24, 0.5), [titik24]);
  const medan850 = useMemo<MedanAngin | null>(() => (cuaca ? { grid: cuaca.medan.grid, mulai: cuaca.medan.mulai, langkahJam: cuaca.medan.langkahJam, u: cuaca.medan.u850, v: cuaca.medan.v850 } : null), [cuaca]);
  const lintasan = useMemo(() => (medan850 ? gugus.filter((g) => g.jumlah >= 3).slice(0, 14).map((g) => ({ g, jalur: lintasanAsap(medan850, g.lon, g.lat, sekarang, 48) })) : []), [medan850, gugus, sekarang]);
  const kotaAsap = useMemo(() => kotaTerpapar(lintasan.map((l) => l.jalur), kota.filter((k) => k.utama === 1)), [lintasan, kota]);
  const prakiraan = useMemo(() => (cuaca && provinsi.length ? prakiraanPerProvinsi(cuaca.harian, provinsiPerSel(cuaca.harian.grid, provinsi), provinsi.map((p) => p.nama)) : []), [cuaca, provinsi]);
  const sitrep = useMemo(
    () => susunSitrep({ sekarang, hotspot: data.hotspot, gempa: data.gempa?.gempa ?? null, gunung: data.gunung?.gunung ?? null, bencana: data.bencana, peringatan: data.peringatan?.peringatan ?? null, cuaca, prakiraan, kotaAsap }),
    [sekarang, data.hotspot, data.gempa, data.gunung, data.bencana, data.peringatan, cuaca, prakiraan, kotaAsap],
  );
  const adaData = Boolean(data.hotspot || data.gempa || data.gunung || data.peringatan);

  const hitung = useMemo(
    () => ({
      hotspot: data.hotspot ? titik24.length : null,
      gempa: data.gempa ? data.gempa.gempa.filter((g) => g.waktu >= sekarang - 86_400_000).length : null,
      gunung: data.gunung?.live ? data.gunung.gunung.filter((g) => g.level >= 3).length : null,
      peringatan: data.peringatan ? data.peringatan.peringatan.filter((p) => p.berakhir > sekarang).length : null,
    }),
    [data.hotspot, data.gempa, data.gunung, data.peringatan, titik24, sekarang],
  );

  const jumlah = useMemo<Partial<Record<IdLapisan, number>>>(
    () => ({
      hotspot: data.hotspot?.titik.length,
      gempa: data.gempa?.gempa.length,
      gunung: data.gunung?.live ? data.gunung.gunung.filter((g) => g.level >= 2).length : undefined,
      bencana: data.bencana?.bnpb.length,
      laporan: data.bencana?.laporan.length,
      peringatan: hitung.peringatan ?? undefined,
      sungai: cuaca?.sungai.length,
      asap: lintasan.length || undefined,
      rs: jumlahRs ?? undefined,
    }),
    [data.hotspot, data.gempa, data.gunung, data.bencana, hitung.peringatan, cuaca, lintasan.length, jumlahRs],
  );

  const galat = useMemo(() => {
    const s = new Set<IdLapisan>();
    for (const k of data.galat) for (const l of LAPISAN_SUMBER[k]) s.add(l);
    if (data.gunung && !data.gunung.live) s.add("gunung");
    if (data.cuaca && !cuaca) for (const l of LAPISAN_SUMBER.cuaca) s.add(l);
    return s;
  }, [data.galat, data.gunung, data.cuaca, cuaca]);

  const butirTicker = useMemo(() => {
    const b: string[] = [];
    b.push(sitrep.ringkas[lang]);
    for (const g of (data.gempa?.gempa ?? []).filter((x) => x.mag >= 4).slice(0, 5)) b.push(`${t("kind_quake")} M${g.mag.toFixed(1)} · ${g.tempat} · ${umur(g.waktu, sekarang, lang)}`);
    if (data.hotspot) {
      const top = ringkasPerProvinsi(data.hotspot, sekarang / 60_000 - 1440)[0];
      b.push(`${titik24.length} ${t("ticker_hotspots")}${top ? ` · ${top.provinsi} ${top.jumlah}` : ""}`);
    }
    for (const g of (data.gunung?.gunung ?? []).filter((x) => x.level >= 3)) b.push(`${g.nama} · Level ${g.level === 4 ? "IV Awas" : "III Siaga"}`);
    for (const p of (data.peringatan?.peringatan ?? []).filter((x) => x.berakhir > sekarang).slice(0, 4)) b.push(`BMKG · ${p.judul}`);
    for (const x of (data.bencana?.bnpb ?? []).slice(0, 3)) b.push(`BNPB · ${x.jenis} · ${x.kabupaten}`);
    for (const s of cuaca?.sungai ?? []) {
      const st = statusSungai(s);
      if (st.tingkat >= 1) b.push(`${s.nama} · ${NAMA_TINGKAT[st.tingkat][lang]} · ${Math.round(st.puncak)} m³/s`);
    }
    return adaData ? b : [];
  }, [sitrep, lang, data.gempa, data.hotspot, data.gunung, data.peringatan, data.bencana, cuaca, titik24.length, sekarang, t, adaData]);

  // --- peta: visibilitas lapisan ---
  useEffect(() => {
    if (!map) return;
    sinkronVisibilitas(map, aktifEfektif);
  }, [map, aktifEfektif]);

  // --- peta: data live ke source ---
  useEffect(() => {
    if (map) setData(map, "hotspot", data.hotspot ? fiturHotspot(data.hotspot, sekarang) : []);
  }, [map, data.hotspot, sekarang]);
  useEffect(() => {
    if (map) setData(map, "gempa", data.gempa ? fiturGempa(data.gempa.gempa, sekarang) : []);
  }, [map, data.gempa, sekarang]);
  useEffect(() => {
    if (map) setData(map, "gunung", data.gunung ? fiturGunung(data.gunung.gunung) : []);
  }, [map, data.gunung]);
  useEffect(() => {
    if (!map) return;
    setData(map, "bencana", data.bencana ? fiturBencana(data.bencana.bnpb) : []);
    setData(map, "laporan", data.bencana ? fiturLaporan(data.bencana.laporan) : []);
  }, [map, data.bencana]);
  useEffect(() => {
    if (map) setData(map, "peringatan", data.peringatan ? fiturPeringatan(data.peringatan.peringatan.filter((p) => p.berakhir > sekarang)) : []);
  }, [map, data.peringatan, sekarang]);
  useEffect(() => {
    if (map) setData(map, "sungai", cuaca ? fiturSungai(cuaca.sungai) : []);
  }, [map, cuaca]);

  // lapisan statis yang berat baru dimuat saat dinyalakan
  const sesarAktif = aktif.has("sesar");
  const rsAktif = aktif.has("rs");
  useEffect(() => {
    if (!map || !sesarAktif) return;
    let hidup = true;
    muatHistoris()
      .then((h) => {
        if (!hidup) return;
        historisRef.current = h;
        setData(map, "historis", fiturHistoris(h));
      })
      .catch(() => undefined);
    return () => {
      hidup = false;
    };
  }, [map, sesarAktif]);
  useEffect(() => {
    if (!map || !rsAktif) return;
    let hidup = true;
    muatRs()
      .then((rs) => {
        if (!hidup) return;
        setJumlahRs(rs.length);
        setData(map, "rs", fiturRs(rs));
      })
      .catch(() => undefined);
    return () => {
      hidup = false;
    };
  }, [map, rsAktif]);

  // --- peta: lapisan medan ---
  // gambar dibuat di kanvas lepas lalu dipasang ke source `image`; nyala/matinya diurus opasitas layer (memudar)
  const medan = medanAktif(aktifEfektif);
  const kanvasMedan = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!map || !medan || medan === "inarisk") return;
    const k = (kanvasMedan.current ??= document.createElement("canvas"));
    let hidup = true;
    if (medan === "penduduk") {
      muatPenduduk()
        .then((g) => {
          if (!hidup) return;
          // penduduk per sel -> jiwa/km2 (luas sel mengecil menjauhi khatulistiwa)
          const luas = (g.dx * 111.195) ** 2;
          const nilai = new Float32Array(g.v.length);
          for (let i = 0; i < nilai.length; i++) nilai[i] = (g.v[i] / g.skalaAkar) ** 2;
          const sudut = gambarMedan(k, { grid: { ...g, dy: g.dx }, nilai, skala: SKALA.penduduk, perSel: 1, ubah: (v, lat) => v / (luas * Math.cos((lat * Math.PI) / 180)) });
          pasangGambar(map, "medan-darat", k, sudut);
        })
        .catch(() => undefined);
    } else if (cuaca && (medan === "fwi" || medan === "banjir")) {
      const h = cuaca.harian;
      const nilai = medan === "banjir" ? hujanTerbasah(cuaca, hari) : h.fwi[Math.min(h.fwi.length - 1, hari)];
      pasangGambar(map, "medan-darat", k, gambarMedan(k, { grid: h.grid, nilai, skala: SKALA[medan], pengali: 0.1, kosong: -1, perSel: 12, kabur: 5 }));
    } else if (cuaca && (medan === "hujan" || medan === "suhu" || medan === "udara")) {
      const m = cuaca.medan;
      const i = Math.min(m.u10.length - 1, jam);
      const nilai = medan === "hujan" ? m.hujan[i] : medan === "suhu" ? m.suhu[i] : m.pm25[i];
      pasangGambar(map, "medan-atas", k, gambarMedan(k, { grid: m.grid, nilai, skala: SKALA[medan], pengali: medan === "udara" ? 1 : 0.1, perSel: 12, kabur: 7, pudar: true }));
    }
    return () => {
      hidup = false;
    };
  }, [map, medan, cuaca, jam, hari]);

  // angka prakiraan di kota-kota utama
  useEffect(() => {
    if (map) setData(map, "medan-label", labelMedan(medan, cuaca, jam, hari, kota));
  }, [map, medan, cuaca, jam, hari, kota]);

  // --- peta: efek bergerak (angin, hujan, kabut, asap) ---
  useEffect(() => {
    const e = efekRef.current;
    if (!map || !e) return;
    if (cuaca) {
      const m = cuaca.medan;
      // di mode harian angin memakai tengah hari yang dipilih (sejauh deret 72 jamnya ada)
      const i = mode === "hari" ? Math.min(m.u10.length - 1, langkahKini + (hari - hariKini) * 8) : Math.min(m.u10.length - 1, jam);
      e.grid = m.grid;
      e.u = m.u10[i];
      e.v = m.v10[i];
      e.hujan = m.hujan[i];
      e.pm25 = m.pm25[i];
      e.medanAsap = medan850;
      e.waktuAsap = m.mulai + i * m.langkahJam * 3600_000;
    }
    // alat skenario, putar ulang, dan briefing butuh peta yang tenang
    e.jeda = replay || alat === "tsunami" || alat === "gempa" || briefing;
    e.anginAktif = Boolean(cuaca) && aktifEfektif.has("angin");
    e.hujanAktif = Boolean(cuaca) && aktifEfektif.has("hujan");
    e.kabutAktif = Boolean(cuaca) && aktifEfektif.has("udara");
    e.asapAktif = Boolean(cuaca) && aktifEfektif.has("asap");
  }, [map, efekRef, cuaca, jam, hari, hariKini, langkahKini, mode, medan850, aktifEfektif, replay, alat, briefing]);

  useEffect(() => {
    efekRef.current?.setGugus(gugus);
  }, [map, efekRef, gugus]);

  useEffect(() => {
    if (!map) return;
    const fitur: GeoJSON.Feature[] = [];
    for (const l of lintasan) {
      if (l.jalur.length < 3) continue;
      fitur.push({ type: "Feature", properties: { frp: l.g.frp }, geometry: { type: "LineString", coordinates: l.jalur } });
      fitur.push(titik(l.jalur[l.jalur.length - 1][0], l.jalur[l.jalur.length - 1][1], {}));
    }
    setData(map, "asap", fitur);
  }, [map, lintasan]);

  // --- peta: raster pilihan ---
  // peta bahaya InaRISK: satu gambar per jenis, baru diunduh waktu lapisannya dinyalakan
  // gambarnya ditunggu sampai siap dulu, baru dipudarkan masuk; ganti jenis = pudar keluar, tukar, pudar masuk
  const [inariskSiap, setInariskSiap] = useState<JenisInarisk | null>(null);
  const inariskMuat = medan === "inarisk" && inariskSiap !== inarisk;
  useEffect(() => {
    if (!map || medan !== "inarisk") return;
    let hidup = true;
    const url = urlInarisk(inarisk);
    const mulai = performance.now();
    pudarkanRaster(map, "inarisk-raster", false);
    const gambar = new Image();
    gambar.src = url;
    let lepas = () => undefined as void;
    const tampil = () => {
      lepas();
      if (!hidup) return;
      pudarkanRaster(map, "inarisk-raster", true);
      setInariskSiap(inarisk);
    };
    gambar
      .decode()
      .catch(() => undefined)
      .then(() => {
        // beri waktu pudar-keluar jenis sebelumnya selesai
        window.setTimeout(
          () => {
            if (!hidup) return;
            const saatData = (e: { sourceId?: string }) => {
              if (e.sourceId === "inarisk") window.setTimeout(tampil, 60);
            };
            map.on("sourcedata", saatData);
            const cadangan = window.setTimeout(tampil, 2500);
            lepas = () => {
              map.off("sourcedata", saatData);
              window.clearTimeout(cadangan);
              lepas = () => undefined;
            };
            pasangGambar(map, "inarisk", url, SUDUT_INARISK);
          },
          Math.max(0, 320 - (performance.now() - mulai)),
        );
      });
    return () => {
      hidup = false;
      lepas();
      setInariskSiap(null);
    };
  }, [map, medan, inarisk]);
  const tanggalCitra = tanggalWib(sekarang - 86_400_000);
  useEffect(() => {
    if (!replay) (map?.getSource("citra") as RasterTileSource | undefined)?.setTiles([urlCitra(tanggalCitra)]);
  }, [map, tanggalCitra, replay]);

  // --- peta: sorotan objek terpilih, riak gempa baru, arus di garis megathrust ---
  useEffect(() => {
    if (!map) return;
    const garis = pilihan?.jenis === "sesar";
    sorotGaris(map, garis ? pilihan.idFitur : null);
    if (efekRef.current) efekRef.current.pilih = pilihan && !garis ? { lon: pilihan.lon, lat: pilihan.lat } : null;
  }, [map, efekRef, pilihan]);

  const riak = useMemo(
    () =>
      aktifEfektif.has("gempa")
        ? (data.gempa?.gempa ?? [])
            .filter((g) => g.waktu >= sekarang - 86_400_000 && g.mag >= 4.5)
            .slice(0, 14)
            .map((g) => ({ lon: g.lon, lat: g.lat, mag: g.mag }))
        : [],
    [data.gempa, sekarang, aktifEfektif],
  );
  useEffect(() => {
    if (efekRef.current) efekRef.current.riak = riak;
  }, [map, efekRef, riak]);

  const sesarTampil = aktifEfektif.has("sesar");
  useEffect(() => {
    // di ponsel lebih pelan: tiap langkah = satu kali gambar ulang peta
    if (map && sesarTampil) return animasiArus(map, undefined, window.matchMedia("(max-width: 640px), (pointer: coarse)").matches ? 150 : 90);
  }, [map, sesarTampil]);

  // --- mode peta ---
  useEffect(() => {
    if (map) terapkanSat(map, sat);
  }, [map, sat, terapkanSat]);
  useEffect(() => {
    if (map) map.setProjection({ type: datar ? "mercator" : "globe" });
  }, [map, datar]);

  // --- URL ---
  const tulis = useCallback(
    (m: MapLibre) => {
      const c = m.getCenter();
      tulisUrl({ tampilan: { lat: c.lat, lon: c.lng, zoom: m.getZoom(), bearing: m.getBearing(), pitch: m.getPitch() }, lapisan: LAPISAN.filter((l) => aktif.has(l.id)).map((l) => l.id), lang, sat, datar, alat });
    },
    [aktif, lang, sat, datar, alat],
  );
  useEffect(() => {
    if (map && !boot) tulis(map);
  }, [map, boot, tulis]);

  // --- klik peta ---
  const bukaAlat = useCallback((a: Alat | null) => {
    setAlat((kini) => (kini === a ? null : a));
    setPilihan(null);
    setCari(false);
    setBantuan(false);
    setMain(false);
  }, []);

  const pilihDariFitur = useCallback(
    (layer: string, f: GeoJSON.Feature, lon: number, lat: number): Pilihan | null => {
      const p = (f.properties ?? {}) as Record<string, unknown>;
      const id = String(p.id ?? "");
      const koordinat = f.geometry.type === "Point" ? (f.geometry.coordinates as [number, number]) : ([lon, lat] as [number, number]);
      const jenis = LAYER_INTERAKTIF[layer];
      if (jenis === "hotspot" && data.hotspot) {
        const d = data.hotspot.titik[Number(id.slice(3))];
        return d ? { jenis: "hotspot", id, lon: d[0], lat: d[1], data: d, provinsi: data.hotspot.provinsi[d[5]] ?? "", satelit: data.hotspot.satelit[d[6]] ?? "" } : null;
      }
      if (jenis === "gempa") {
        const g = data.gempa?.gempa.find((x) => x.id === id);
        return g ? { jenis: "gempa", id, lon: g.lon, lat: g.lat, data: g } : null;
      }
      if (jenis === "gunung") {
        const g = data.gunung?.gunung.find((x) => `ga-${x.nama}` === id);
        return g ? { jenis: "gunung", id, lon: g.lon, lat: g.lat, data: g } : null;
      }
      if (jenis === "bencana") {
        const b = data.bencana?.bnpb.find((x) => x.id === id);
        return b ? { jenis: "bencana", id, lon: b.lon, lat: b.lat, data: b } : null;
      }
      if (jenis === "laporan") {
        const l = data.bencana?.laporan.find((x) => x.id === id);
        return l ? { jenis: "laporan", id, lon: l.lon, lat: l.lat, data: l } : null;
      }
      if (jenis === "peringatan") {
        const w = data.peringatan?.peringatan.find((x) => x.id === id);
        if (!w) return null;
        const [x, y] = pusatPoligon(w.poligon[0]);
        return { jenis: "peringatan", id, lon: x, lat: y, data: w };
      }
      if (jenis === "sungai") {
        const s = cuaca?.sungai.find((x) => `sg-${x.nama}` === id);
        return s ? { jenis: "sungai", id, lon: s.lon, lat: s.lat, data: s, status: statusSungai(s) } : null;
      }
      if (jenis === "historis") {
        const h = historisRef.current[Number(id.slice(3))];
        return h ? { jenis: "historis", id, lon: h[0], lat: h[1], data: h } : null;
      }
      if (jenis === "rs") return { jenis: "rs", id, lon: koordinat[0], lat: koordinat[1], nama: String(p.nama ?? "") };
      if (jenis === "sesar") return { jenis: "sesar", id: `sesar-${f.id}`, lon, lat, nama: String(p.nama ?? ""), gerak: String(p.gerak ?? ""), laju: typeof p.laju === "number" ? p.laju : null, megathrust: p.jenis === "megathrust", idFitur: Number(f.id) };
      return null;
    },
    [data.hotspot, data.gempa, data.gunung, data.bencana, data.peringatan, cuaca],
  );

  /** Objek teratas di sekitar satu titik layar (urutan prioritas URUTAN_KLIK), atau null. */
  const cariPilihan = useCallback(
    (m: MapLibre, titikLayar: { x: number; y: number }, r: number, lon: number, lat: number): Pilihan | null => {
      const ids = URUTAN_KLIK.filter((id) => m.getLayer(id) && m.getLayoutProperty(id, "visibility") !== "none");
      const kotak: [PointLike, PointLike] = [
        [titikLayar.x - r, titikLayar.y - r],
        [titikLayar.x + r, titikLayar.y + r],
      ];
      const kena = m.queryRenderedFeatures(kotak, { layers: ids });
      for (const idLayer of URUTAN_KLIK) {
        const f = kena.find((x) => x.layer.id === idLayer);
        if (!f) continue;
        const p = pilihDariFitur(idLayer, f, lon, lat);
        if (p) return p;
      }
      return null;
    },
    [pilihDariFitur],
  );

  useEffect(() => {
    const sembunyikanTip = () => {
      if (tipRef.current) tipRef.current.hidden = true;
    };
    penanganRef.current = {
      saatMoveEnd: (m) => {
        if (!boot) tulis(m);
      },
      saatKeluar: sembunyikanTip,
      // tooltip diubah langsung di DOM: kursor bergerak puluhan kali per detik, jangan sampai seluruh konsol dirender ulang
      saatHover: (m, e) => {
        if (alat === "replay" || alat === "gempa" || alat === "tsunami" || briefing) {
          sembunyikanTip();
          return false;
        }
        const p = cariPilihan(m, e.point, TOLERANSI_KLIK.mouse, e.lngLat.lng, e.lngLat.lat);
        const el = tipRef.current;
        if (!p || !el) {
          sembunyikanTip();
          return Boolean(p);
        }
        el.textContent = ringkasPilihan(p, lang, Date.now());
        el.hidden = false;
        const lebar = el.offsetWidth;
        const x = Math.min(e.point.x + 14, m.getContainer().clientWidth - lebar - 8);
        el.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, e.point.y - 34)}px)`;
        return true;
      },
      saatKlik: (m: MapLibre, e: MapMouseEvent) => {
        const { lng: lon, lat } = e.lngLat;
        sembunyikanTip();
        if (alat === "gempa") {
          setSkenGempa((s) => ({ lon, lat, mag: s?.mag ?? MAG_AWAL, dalam: s?.dalam ?? DALAM_AWAL }));
          return;
        }
        if (alat === "tsunami") {
          setSkenTsunami((s) => ({ lon, lat, mag: s?.mag ?? MAG_TSUNAMI_AWAL, dalam: s?.dalam ?? 20 }));
          return;
        }
        if (alat === "replay" || briefing) return;
        const sentuh = (e.originalEvent as PointerEvent | undefined)?.pointerType === "touch" || window.matchMedia("(pointer: coarse)").matches;
        const p = cariPilihan(m, e.point, sentuh ? TOLERANSI_KLIK.sentuh : TOLERANSI_KLIK.mouse, lon, lat);
        if (p) {
          setPilihan(p);
          return;
        }
        // klik di tempat kosong: tutup panel kalau ada, kalau tidak tampilkan prakiraan titik itu
        setPilihan((kini) => (kini ? null : { jenis: "titik", id: `t-${lon.toFixed(3)}-${lat.toFixed(3)}`, lon, lat }));
      },
    };
  }, [alat, briefing, boot, lang, tulis, cariPilihan]);

  // --- aksi ---
  const toggle = useCallback((id: IdLapisan) => setAktif((a) => toggleLapisan(a, id)), []);
  const reset = useCallback(() => {
    const v = tampilanAwal();
    map?.flyTo({ center: [v.lon, v.lat], zoom: v.zoom, bearing: 0, pitch: 0, duration: 1600 });
  }, [map]);
  const bagikan = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast(t("link_copied"));
    } catch {
      setToast(t("copy_failed"));
    }
  }, [t]);
  const layarPenuh = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }, []);
  const bukaSkenario = useCallback((a: "gempa" | "tsunami", lon: number, lat: number, mag?: number, dalam?: number) => {
    setPilihan(null);
    setAlat(a);
    if (a === "gempa") setSkenGempa({ lon, lat, mag: mag ?? MAG_AWAL, dalam: dalam ?? DALAM_AWAL });
    else setSkenTsunami({ lon, lat, mag: Math.min(9.3, Math.max(6.5, mag ?? MAG_TSUNAMI_AWAL)), dalam: dalam ?? 20 });
    map?.flyTo({ center: [lon, lat], zoom: a === "gempa" ? 6.8 : 4.6, pitch: 0, bearing: 0, duration: 1800 });
  }, [map]);
  const pilihEntitas = useCallback(
    (e: Entitas) => {
      setCari(false);
      map?.flyTo({ center: [e.lon, e.lat], zoom: e.zoom, duration: 2000 });
    },
    [map],
  );
  const geserWaktu = useCallback(
    (arah: 1 | -1) => {
      if (!cuaca || !mode) return;
      setMain(false);
      if (mode === "jam") setPosisiJam((p) => Math.min(cuaca.medan.u10.length - 1, Math.max(langkahKini, (p ?? langkahKini) + arah)));
      else setPosisiHari((p) => Math.min(cuaca.harian.hari.length - 1, Math.max(hariKini, Math.max(p, hariKini) + arah)));
    },
    [cuaca, mode, langkahKini, hariKini],
  );

  // --- keyboard ---
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const mengetik = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCari((c) => !c);
        return;
      }
      if (e.key === "Escape") {
        if (boot) setBoot(false);
        else if (cari) setCari(false);
        else if (bantuan) setBantuan(false);
        else if (pilihan) setPilihan(null);
        else if (alat) setAlat(null);
        return;
      }
      if (mengetik || e.ctrlKey || e.metaKey || e.altKey || boot) return;
      // dialog modal terbuka: pintasan lain dimatikan
      if (cari || bantuan || alat === "warroom") return;
      if (e.key === "/") {
        e.preventDefault();
        setCari(true);
      } else if (e.key === "?") setBantuan(true);
      else if (e.code === "KeyW") bukaAlat("warroom");
      else if (e.code === "KeyM") bukaAlat("gempa");
      else if (e.code === "KeyT") bukaAlat("tsunami");
      else if (e.code === "KeyP") bukaAlat("replay");
      else if (e.code === "KeyS") setSat((s) => !s);
      else if (e.code === "KeyD") setDatar((d) => !d);
      else if (e.code === "KeyL") setLang((l) => (l === "id" ? "en" : "id"));
      else if (e.code === "KeyF") layarPenuh();
      else if (e.code === "KeyR") reset();
      else if (e.code === "Space" && mode) {
        e.preventDefault();
        setMain((m) => !m);
      } else if (e.code === "BracketRight") geserWaktu(1);
      else if (e.code === "BracketLeft") geserWaktu(-1);
      else {
        const l = LAPISAN.find((x) => x.kode === e.code);
        if (l && !replay) toggle(l.id);
      }
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [boot, cari, bantuan, pilihan, alat, mode, replay, bukaAlat, layarPenuh, reset, geserWaktu, toggle]);

  // --- lini masa: label ---
  let label = "";
  let selisih = "";
  if (cuaca && mode === "jam") {
    const waktu = cuaca.medan.mulai + jam * cuaca.medan.langkahJam * 3600_000;
    label = formatWib(waktu, lang);
    const beda = (jam - langkahKini) * cuaca.medan.langkahJam;
    selisih = beda === 0 ? t("now") : `+${beda} ${t("hours_short")}`;
  } else if (cuaca && mode === "hari") {
    label = formatHariWib(Date.parse(`${cuaca.harian.hari[Math.min(cuaca.harian.hari.length - 1, hari)]}T05:00:00Z`), lang);
    selisih = hari === hariKini ? t("today") : `H+${hari - hariKini}`;
  }
  const legenda: Legenda | null = medan && medan !== "inarisk" && !replay && (cuaca || medan === "penduduk") ? { judul: defLapisan(medan).nama[lang], skala: SKALA[medan as keyof typeof SKALA] } : null;
  const panelSamping = !briefing && (alat === "gempa" || alat === "tsunami" || pilihan);

  return (
    <div className="relative h-full w-full overflow-hidden bg-bg" data-siap={map ? "1" : "0"} data-testid="konsol">
      {/* pembungkus: MapLibre memaksa wadahnya position:relative, jadi ukuran diambil dari sini; kanvas angin ikut ditaruh di sini */}
      <div className="absolute inset-0">
        <div ref={wadahRef} className="h-full w-full" role="application" aria-label={t("map_label")} />
      </div>
      {/* tooltip objek di bawah kursor (desktop); isinya diubah langsung dari penangan peta */}
      <div ref={tipRef} hidden role="tooltip" className="glass-padat pointer-events-none absolute left-0 top-0 z-20 max-w-[320px] truncate px-2.5 py-1.5 text-[11.5px] text-text" data-testid="tooltip-peta" />
      <div className="vinyet" />
      <div className="pindai" />

      {!briefing && (
        <Hud
          lang={lang}
          online={online}
          tingkat={adaData ? sitrep.tingkat : null}
          hitung={hitung}
          sat={sat}
          datar={datar}
          alat={alat}
          onToggleSat={() => setSat((s) => !s)}
          onToggleDatar={() => setDatar((d) => !d)}
          onToggleLang={() => setLang((l) => (l === "id" ? "en" : "id"))}
          onCari={() => setCari(true)}
          onBantuan={() => setBantuan(true)}
          onBagikan={() => void bagikan()}
          onFullscreen={layarPenuh}
          onReset={reset}
          onAlat={bukaAlat}
        />
      )}

      {!briefing && !replay && (
        <>
          <RelLapisan lang={lang} aktif={aktif} jumlah={jumlah} galat={galat} onToggle={toggle} />
          {!panelSamping && <ChipLapisan lang={lang} aktif={aktif} onToggle={toggle} bawah={34} />}
          {!(panelSamping && sempit) && (
            <LiniMasa
              lang={lang}
              mode={mode}
              posisi={mode === "hari" ? hari : jam}
              jumlah={cuaca ? (mode === "hari" ? cuaca.harian.hari.length : cuaca.medan.u10.length) : 1}
              label={label}
              selisih={selisih}
              main={main}
              onMain={() => setMain((m) => !m)}
              onPosisi={(i) => {
                setMain(false);
                if (mode === "hari") setPosisiHari(Math.max(hariKini, i));
                else setPosisiJam(Math.max(langkahKini, i));
              }}
              legenda={legenda}
              rentang={aktifEfektif.has("hotspot") ? rentang : null}
              onRentang={setRentang}
              inarisk={medan === "inarisk" ? inarisk : null}
              onInarisk={setInarisk}
              inariskMuat={inariskMuat}
              catatan={cuaca ? `${t("forecast_made")} ${umur(cuaca.dibuat, sekarang, lang)}` : undefined}
            />
          )}
        </>
      )}

      {!briefing && pilihan && alat !== "gempa" && alat !== "tsunami" && <PanelDetail lang={lang} pilihan={pilihan} cuaca={cuaca} sekarang={sekarang} onTutup={() => setPilihan(null)} onSkenario={bukaSkenario} />}
      {alat === "gempa" && <AlatGempa lang={lang} map={map} skenario={skenGempa} onUbah={setSkenGempa} onTutup={() => setAlat(null)} onTsunami={(s) => bukaSkenario("tsunami", s.lon, s.lat, s.mag, s.dalam)} />}
      {alat === "tsunami" && <AlatTsunami lang={lang} map={map} kanvas={kanvasTsunami} skenario={skenTsunami} onUbah={setSkenTsunami} onTutup={() => setAlat(null)} />}
      {alat === "warroom" && <WarRoom lang={lang} map={map} sitrep={sitrep} sumberGagal={data.galat.size} onTutup={() => setAlat(null)} onBriefing={setBriefing} onToast={setToast} />}
      {replay && <Replay2019 lang={lang} map={map} onTutup={() => setAlat(null)} />}

      {cari && <Cari lang={lang} entitas={entitasLengkap} onPilih={pilihEntitas} onTutup={() => setCari(false)} />}
      {bantuan && <Bantuan lang={lang} onTutup={() => setBantuan(false)} />}

      <Ticker lang={lang} butir={butirTicker} />

      {toast && (
        <div className="glass-padat muncul pointer-events-none absolute left-1/2 top-[76px] z-50 -translate-x-1/2 px-4 py-2 text-[12px] text-text" role="status" aria-live="polite">
          {toast}
        </div>
      )}
      {!online && (
        <div className="glass-padat absolute left-1/2 top-1/2 z-40 max-w-[320px] -translate-x-1/2 -translate-y-1/2 px-4 py-3 text-center text-[12px] text-warn" role="alert">
          {t("map_offline")}
        </div>
      )}
      {boot && <Boot onSelesai={() => setBoot(false)} />}
    </div>
  );
}
