/**
 * Briefing harian otomatis (SITREP): semua sumber live diringkas jadi empat bagian dengan tingkat ancaman.
 * Tanpa model bahasa: isinya kalimat berpola yang diisi angka dari data, jadi tidak bisa "mengarang".
 */

import type { DataBencana, DataHotspot, Gempa, GunungApi, Peringatan, SnapshotCuaca } from "../jenis";
import { ringkasPerProvinsi } from "../sumber/firms";
import type { KotaTerpapar } from "./asap";
import { NAMA_TINGKAT, statusSungai, type TingkatRisiko } from "./banjir";
import { gugusApi } from "./asap";
import type { PrakiraanProvinsi } from "./prakiraan";
import { formatHariWib } from "../waktu";

export interface Fokus {
  lon: number;
  lat: number;
  zoom: number;
}

export interface ButirSitrep {
  id: string;
  en: string;
  fokus?: Fokus;
}

export type KunciBagian = "karhutla" | "gempa" | "gunung" | "hidromet";

export interface BagianSitrep {
  kunci: KunciBagian;
  tingkat: TingkatRisiko;
  judul: { id: string; en: string };
  butir: ButirSitrep[];
}

export interface Sitrep {
  waktu: number;
  tingkat: TingkatRisiko;
  ringkas: { id: string; en: string };
  bagian: BagianSitrep[];
}

export interface MasukanSitrep {
  sekarang: number;
  hotspot: DataHotspot | null;
  gempa: Gempa[] | null;
  gunung: GunungApi[] | null;
  bencana: DataBencana | null;
  peringatan: Peringatan[] | null;
  cuaca: SnapshotCuaca | null;
  prakiraan: PrakiraanProvinsi[];
  kotaAsap: KotaTerpapar[];
}

const KELAS_FWI = [
  { id: "rendah", en: "low" },
  { id: "sedang", en: "moderate" },
  { id: "tinggi", en: "high" },
  { id: "ekstrem", en: "extreme" },
];

const JUDUL: Record<KunciBagian, { id: string; en: string }> = {
  karhutla: { id: "Karhutla & asap", en: "Wildfire & haze" },
  gempa: { id: "Gempa & tsunami", en: "Earthquake & tsunami" },
  gunung: { id: "Gunung api", en: "Volcanoes" },
  hidromet: { id: "Banjir & cuaca", en: "Flood & weather" },
};

function daftar(nama: string[], lang: "id" | "en", maks = 3): string {
  const d = nama.slice(0, maks);
  if (d.length <= 1) return d.join("");
  const dan = lang === "id" ? "dan" : "and";
  return `${d.slice(0, -1).join(", ")} ${dan} ${d[d.length - 1]}`;
}

function maks(...t: TingkatRisiko[]): TingkatRisiko {
  return Math.max(0, ...t) as TingkatRisiko;
}

/**
 * Ambang jumlah titik panas 24 jam (gabungan VIIRS NOAA-20/21 + MODIS): 150 waspada, 750 siaga, 3.000 awas.
 * Sebagai pembanding, puncak September 2019 mencapai ~3.000 deteksi per hari dari MODIS saja.
 */
export function tingkatKarhutla(jumlah24: number, adaFwiEkstrem: boolean): TingkatRisiko {
  let t: TingkatRisiko = jumlah24 >= 3000 ? 3 : jumlah24 >= 750 ? 2 : jumlah24 >= 150 ? 1 : 0;
  if (adaFwiEkstrem && jumlah24 >= 150 && t < 2) t = 2;
  return t;
}

export function tingkatGempa(magTerbesar24: number, adaTsunami: boolean): TingkatRisiko {
  if (adaTsunami || magTerbesar24 >= 7) return 3;
  if (magTerbesar24 >= 6) return 2;
  if (magTerbesar24 >= 5) return 1;
  return 0;
}

export function tingkatGunung(levelTertinggi: number): TingkatRisiko {
  return Math.max(0, Math.min(3, levelTertinggi - 1)) as TingkatRisiko;
}

function bagianKarhutla(m: MasukanSitrep): BagianSitrep {
  const butir: ButirSitrep[] = [];
  const sejak = m.sekarang / 60_000 - 24 * 60;
  const titik24 = m.hotspot ? m.hotspot.titik.filter((t) => t[4] >= sejak) : [];
  const ekstrem = m.prakiraan.filter((p) => p.kelasFwi === 3);
  if (m.hotspot) {
    const perProv = ringkasPerProvinsi(m.hotspot, sejak);
    if (titik24.length === 0) {
      butir.push({ id: "Tidak ada titik panas berkeyakinan sedang/tinggi dalam 24 jam terakhir.", en: "No nominal or high confidence hotspots in the last 24 hours." });
    } else {
      const top = perProv.slice(0, 3).map((p) => `${p.provinsi} (${p.jumlah})`);
      butir.push({
        id: `${titik24.length} titik panas dalam 24 jam di ${perProv.length} provinsi. Terbanyak: ${daftar(top, "id")}.`,
        en: `${titik24.length} hotspots in 24 hours across ${perProv.length} provinces. Most: ${daftar(top, "en")}.`,
      });
      const gugus = gugusApi(titik24, 0.5)[0];
      if (gugus && gugus.jumlah >= 3) {
        const prov = m.hotspot.provinsi[gugus.prov] ?? "";
        butir.push({
          id: `Gugus terkuat di ${prov}: ${gugus.jumlah} titik, daya pancar ${gugus.frp} MW.`,
          en: `Strongest cluster in ${prov}: ${gugus.jumlah} detections, ${gugus.frp} MW radiative power.`,
          fokus: { lon: gugus.lon, lat: gugus.lat, zoom: 7.2 },
        });
      }
    }
  }
  if (m.prakiraan.length > 0) {
    const urut = [...m.prakiraan].sort((a, b) => b.fwiPuncak - a.fwiPuncak);
    const p = urut[0];
    const hari = m.cuaca ? Date.parse(`${m.cuaca.harian.hari[p.hariFwiPuncak]}T05:00:00Z`) : m.sekarang;
    const tinggi = urut.filter((x) => x.kelasFwi >= 2).length;
    butir.push({
      id: `Cuaca api 8 hari: ${tinggi} provinsi masuk kelas tinggi/ekstrem. Puncak di ${p.provinsi}, FWI ${p.fwiPuncak.toFixed(1)} (${KELAS_FWI[p.kelasFwi].id}) pada ${formatHariWib(hari, "id")}.`,
      en: `8-day fire weather: ${tinggi} provinces reach high/extreme. Peak in ${p.provinsi}, FWI ${p.fwiPuncak.toFixed(1)} (${KELAS_FWI[p.kelasFwi].en}) on ${formatHariWib(hari, "en")}.`,
      fokus: { lon: p.lon, lat: p.lat, zoom: 6 },
    });
  }
  if (m.kotaAsap.length > 0) {
    const kota = m.kotaAsap.slice(0, 4).map((k) => `${k.nama} (+${k.jam} jam)`);
    const kotaEn = m.kotaAsap.slice(0, 4).map((k) => `${k.nama} (+${k.jam} h)`);
    butir.push({
      id: `Angin 850 hPa membawa asap ke arah ${daftar(kota, "id", 4)}.`,
      en: `850 hPa winds carry smoke toward ${daftar(kotaEn, "en", 4)}.`,
    });
  }
  return { kunci: "karhutla", tingkat: tingkatKarhutla(titik24.length, ekstrem.length > 0), judul: JUDUL.karhutla, butir };
}

function bagianGempa(m: MasukanSitrep): BagianSitrep {
  const butir: ButirSitrep[] = [];
  const gempa = m.gempa ?? [];
  const g24 = gempa.filter((g) => g.waktu >= m.sekarang - 86_400_000);
  const terbesar24 = [...g24].sort((a, b) => b.mag - a.mag)[0];
  const terbesar7 = [...gempa].sort((a, b) => b.mag - a.mag)[0];
  const tsunami = gempa.find((g) => g.tsunami && g.waktu >= m.sekarang - 6 * 3600_000);
  if (m.gempa) {
    const m5 = g24.filter((g) => g.mag >= 5).length;
    butir.push({
      id: `${g24.length} gempa tercatat dalam 24 jam, ${m5} di antaranya M5 ke atas.`,
      en: `${g24.length} earthquakes recorded in 24 hours, ${m5} of them M5 or larger.`,
    });
    if (terbesar24) {
      butir.push({
        id: `Terbesar 24 jam: M${terbesar24.mag.toFixed(1)}, ${terbesar24.tempat}, kedalaman ${terbesar24.dalam} km${terbesar24.dirasakan ? `; dirasakan ${terbesar24.dirasakan}` : ""}.`,
        en: `Largest in 24 h: M${terbesar24.mag.toFixed(1)}, ${terbesar24.tempat}, depth ${terbesar24.dalam} km${terbesar24.dirasakan ? `; felt ${terbesar24.dirasakan}` : ""}.`,
        fokus: { lon: terbesar24.lon, lat: terbesar24.lat, zoom: 6.5 },
      });
    }
    if (terbesar7 && terbesar7 !== terbesar24 && terbesar7.mag >= 5) {
      butir.push({
        id: `Terbesar 7 hari: M${terbesar7.mag.toFixed(1)}, ${terbesar7.tempat}.`,
        en: `Largest in 7 days: M${terbesar7.mag.toFixed(1)}, ${terbesar7.tempat}.`,
        fokus: { lon: terbesar7.lon, lat: terbesar7.lat, zoom: 6.5 },
      });
    }
    if (tsunami) {
      butir.push({
        id: `PERINGATAN TSUNAMI BMKG aktif untuk gempa M${tsunami.mag.toFixed(1)} ${tsunami.tempat}.`,
        en: `BMKG TSUNAMI WARNING active for the M${tsunami.mag.toFixed(1)} ${tsunami.tempat} earthquake.`,
        fokus: { lon: tsunami.lon, lat: tsunami.lat, zoom: 6 },
      });
    } else {
      butir.push({ id: "Tidak ada peringatan tsunami yang berlaku.", en: "No tsunami warning in effect." });
    }
  }
  return { kunci: "gempa", tingkat: tingkatGempa(terbesar24?.mag ?? 0, Boolean(tsunami)), judul: JUDUL.gempa, butir };
}

function bagianGunung(m: MasukanSitrep): BagianSitrep {
  const butir: ButirSitrep[] = [];
  const gunung = (m.gunung ?? []).filter((g) => g.level > 0);
  let tertinggi = 0;
  if (gunung.length > 0) {
    const awas = gunung.filter((g) => g.level === 4);
    const siaga = gunung.filter((g) => g.level === 3);
    const waspada = gunung.filter((g) => g.level === 2);
    tertinggi = awas.length ? 4 : siaga.length ? 3 : waspada.length ? 2 : 1;
    butir.push({
      id: `${awas.length} gunung Level IV (Awas), ${siaga.length} Level III (Siaga), ${waspada.length} Level II (Waspada).`,
      en: `${awas.length} volcanoes at Level IV (Awas), ${siaga.length} at Level III (Siaga), ${waspada.length} at Level II (Waspada).`,
    });
    for (const g of [...awas, ...siaga].slice(0, 5)) {
      const level = g.level === 4 ? "Awas" : "Siaga";
      butir.push({
        id: `${g.nama} (${g.provinsi}) berstatus ${level}.`,
        en: `${g.nama} (${g.provinsi}) is at ${level}.`,
        fokus: { lon: g.lon, lat: g.lat, zoom: 8.5 },
      });
    }
  } else if (m.gunung) {
    butir.push({ id: "Status MAGMA sedang tidak terjangkau; level gunung api tidak diketahui.", en: "MAGMA is unreachable right now; alert levels unknown." });
  }
  return { kunci: "gunung", tingkat: tingkatGunung(tertinggi), judul: JUDUL.gunung, butir };
}

function bagianHidromet(m: MasukanSitrep): BagianSitrep {
  const butir: ButirSitrep[] = [];
  let tingkat: TingkatRisiko = 0;
  const peringatan = (m.peringatan ?? []).filter((p) => p.berakhir > m.sekarang);
  if (m.peringatan) {
    if (peringatan.length > 0) {
      tingkat = maks(tingkat, 1);
      const wilayah = [...new Set(peringatan.map((p) => p.wilayah))];
      butir.push({
        id: `${peringatan.length} peringatan dini cuaca BMKG berlaku: ${daftar(wilayah, "id", 5)}${wilayah.length > 5 ? ", dan lainnya" : ""}.`,
        en: `${peringatan.length} BMKG weather warnings in effect: ${daftar(wilayah, "en", 5)}${wilayah.length > 5 ? ", and more" : ""}.`,
      });
    } else {
      butir.push({ id: "Tidak ada peringatan dini cuaca BMKG yang berlaku.", en: "No BMKG weather warnings in effect." });
    }
  }
  const basah = m.prakiraan.filter((p) => p.tingkatHujan >= 1).sort((a, b) => b.hujan3Hari - a.hujan3Hari);
  if (m.prakiraan.length > 0) {
    if (basah.length > 0) {
      tingkat = maks(tingkat, basah[0].tingkatHujan);
      const nama = basah.slice(0, 4).map((p) => `${p.provinsi} (${Math.round(p.hujan3Hari)} mm)`);
      butir.push({
        id: `Hujan 3 hari ke depan paling deras di ${daftar(nama, "id", 4)}: risiko banjir ${NAMA_TINGKAT[basah[0].tingkatHujan].id.toLowerCase()}.`,
        en: `Heaviest 3-day rain in ${daftar(nama, "en", 4)}: flood risk ${NAMA_TINGKAT[basah[0].tingkatHujan].en.toLowerCase()}.`,
        fokus: { lon: basah[0].lon, lat: basah[0].lat, zoom: 6 },
      });
    } else {
      butir.push({ id: "Prakiraan hujan 3 hari di bawah ambang waspada di semua provinsi.", en: "3-day rain forecast below advisory thresholds in every province." });
    }
  }
  if (m.cuaca) {
    const naik = m.cuaca.sungai.map((s) => ({ s, st: statusSungai(s) })).filter((x) => x.st.tingkat >= 1).sort((a, b) => b.st.rasio - a.st.rasio);
    if (naik.length > 0) {
      tingkat = maks(tingkat, naik[0].st.tingkat);
      const nama = naik.slice(0, 3).map((x) => `${x.s.nama} (${Math.round(x.st.puncak)} m³/s)`);
      butir.push({
        id: `Debit di atas persentil 90: ${daftar(nama, "id")}.`,
        en: `Discharge above the 90th percentile: ${daftar(nama, "en")}.`,
        fokus: { lon: naik[0].s.lon, lat: naik[0].s.lat, zoom: 7.5 },
      });
    }
  }
  if (m.bencana && m.bencana.bnpb.length > 0) {
    const b = m.bencana.bnpb;
    const kejadian = b.reduce((s, x) => s + x.kejadian, 0);
    const meninggal = b.reduce((s, x) => s + x.meninggal + x.hilang, 0);
    const mengungsi = b.reduce((s, x) => s + x.mengungsi, 0);
    if (meninggal > 0) tingkat = maks(tingkat, 2);
    butir.push({
      id: `Rekap BNPB minggu ini: ${kejadian} kejadian di ${b.length} kabupaten/kota, ${meninggal} meninggal/hilang, ${mengungsi.toLocaleString("id-ID")} mengungsi.`,
      en: `BNPB this week: ${kejadian} incidents in ${b.length} regencies, ${meninggal} dead/missing, ${mengungsi.toLocaleString("en-US")} displaced.`,
    });
  }
  if (m.bencana) {
    const banjir = m.bencana.laporan.filter((l) => l.jenis === "flood" && l.waktu >= m.sekarang - 86_400_000);
    if (banjir.length > 0) {
      const terdalam = [...banjir].sort((a, b) => (b.kedalaman ?? 0) - (a.kedalaman ?? 0))[0];
      butir.push({
        id: `${banjir.length} laporan banjir warga dalam 24 jam${terdalam.kedalaman ? `, terdalam ${terdalam.kedalaman} cm di ${terdalam.kota}` : ""}.`,
        en: `${banjir.length} citizen flood reports in 24 hours${terdalam.kedalaman ? `, deepest ${terdalam.kedalaman} cm in ${terdalam.kota}` : ""}.`,
        fokus: { lon: terdalam.lon, lat: terdalam.lat, zoom: 9 },
      });
    }
  }
  return { kunci: "hidromet", tingkat, judul: JUDUL.hidromet, butir };
}

export function susunSitrep(m: MasukanSitrep): Sitrep {
  const bagian = [bagianKarhutla(m), bagianGempa(m), bagianGunung(m), bagianHidromet(m)];
  const tingkat = maks(...bagian.map((b) => b.tingkat));
  const teratas = bagian.filter((b) => b.tingkat === tingkat && tingkat > 0).map((b) => b.judul);
  const ringkas =
    tingkat === 0
      ? { id: "Situasi nasional tenang. Tidak ada ancaman di atas normal.", en: "National situation calm. Nothing above normal." }
      : {
          id: `Status nasional ${NAMA_TINGKAT[tingkat].id.toUpperCase()}, didorong oleh ${daftar(teratas.map((j) => j.id.toLowerCase()), "id", 4)}.`,
          en: `National status ${NAMA_TINGKAT[tingkat].en.toUpperCase()}, driven by ${daftar(teratas.map((j) => j.en.toLowerCase()), "en", 4)}.`,
        };
  return { waktu: m.sekarang, tingkat, ringkas, bagian };
}

/** Briefing sebagai Markdown (untuk disalin atau diunduh). */
export function sitrepKeMarkdown(s: Sitrep, lang: "id" | "en", waktuTeks: string): string {
  const baris = [`# Disaster Ops SITREP`, ``, `${waktuTeks}`, ``, `**${s.ringkas[lang]}**`, ``];
  for (const b of s.bagian) {
    baris.push(`## ${b.judul[lang]} · ${NAMA_TINGKAT[b.tingkat][lang]}`, ``);
    for (const x of b.butir) baris.push(`- ${x[lang]}`);
    baris.push(``);
  }
  baris.push(lang === "id" ? "_Dibuat otomatis dari data publik (NASA FIRMS, BMKG, USGS, PVMBG, BNPB, Open-Meteo). Bukan pengganti peringatan resmi._" : "_Generated automatically from public data (NASA FIRMS, BMKG, USGS, PVMBG, BNPB, Open-Meteo). Not a substitute for official warnings._");
  return baris.join("\n");
}
