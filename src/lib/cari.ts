/** Pencarian tempat: kota, gunung api, provinsi, sungai. Tanpa pustaka, cukup cocokkan awalan dan isi kata. */

export interface Entitas {
  jenis: "kota" | "gunung" | "provinsi" | "sungai";
  nama: string;
  /** keterangan kecil di kanan (provinsi, kabupaten, ...) */
  ket: string;
  lon: number;
  lat: number;
  zoom: number;
  /** kota utama dan gunung api tampil lebih dulu saat skornya sama */
  bobot: number;
}

export function normal(teks: string): string {
  return teks
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Skor kecocokan: 3 sama persis, 2 awalan nama, 1.5 awalan salah satu kata, 1 ada di dalam nama, 0 tidak cocok. */
export function skor(nama: string, kueri: string): number {
  const n = normal(nama);
  const q = normal(kueri);
  if (!q) return 0;
  if (n === q) return 3;
  if (n.startsWith(q)) return 2;
  if (n.split(" ").some((k) => k.startsWith(q))) return 1.5;
  if (n.includes(q)) return 1;
  return 0;
}

export function cariEntitas(entitas: Entitas[], kueri: string, batas = 12): Entitas[] {
  if (!normal(kueri)) return entitas.filter((e) => e.bobot >= 3).slice(0, batas);
  return entitas
    .map((e) => ({ e, s: skor(e.nama, kueri) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.e.bobot - a.e.bobot || a.e.nama.localeCompare(b.e.nama))
    .slice(0, batas)
    .map((x) => x.e);
}
