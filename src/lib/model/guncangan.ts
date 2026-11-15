/**
 * Skenario guncangan: "kalau gempa M sekian terjadi di sini, seberapa kuat terasa dan sampai mana?"
 *
 * Bukan prediksi gempa (gempa tidak bisa diprediksi). Ini persamaan prediksi intensitas (IPE)
 * Allen, Wald & Worden (2012) untuk kerak aktif: MMI sebagai fungsi magnitudo dan jarak ke bidang patahan.
 * Bidang patahan didekati cakram dengan luas dari Wells & Coppersmith (1994), supaya gempa besar
 * tidak diperlakukan sebagai satu titik.
 */

// Allen dkk. (2012), model jarak ke bidang patahan (Rrup)
const C0 = 3.95;
const C1 = 0.913;
const C2 = -1.107;
const C3 = 0.813;

/** Luas bidang patahan (km2) dari magnitudo momen, Wells & Coppersmith (1994), semua jenis sesar. */
export function luasPatahanKm2(mag: number): number {
  return 10 ** (-3.49 + 0.91 * mag);
}

/** Jari-jari cakram yang luasnya sama dengan bidang patahan (km). */
export function radiusPatahanKm(mag: number): number {
  return Math.sqrt(luasPatahanKm2(mag) / Math.PI);
}

/** Jarak ke bidang patahan (km) dari jarak episenter dan kedalaman. */
export function jarakPatahanKm(mag: number, jarakEpisenterKm: number, kedalamanKm: number): number {
  const datar = Math.max(0, jarakEpisenterKm - radiusPatahanKm(mag));
  return Math.max(1, Math.hypot(datar, Math.max(1, kedalamanKm)));
}

/** MMI (1-10, pecahan) di jarak `rrup` km dari bidang patahan. */
export function mmiDariJarak(mag: number, rrup: number): number {
  const rm = 1 + C3 * Math.exp(mag - 5);
  const mmi = C0 + C1 * mag + C2 * Math.log(Math.sqrt(rrup * rrup + rm * rm));
  return Math.min(10, Math.max(1, mmi));
}

export function mmi(mag: number, jarakEpisenterKm: number, kedalamanKm: number): number {
  return mmiDariJarak(mag, jarakPatahanKm(mag, jarakEpisenterKm, kedalamanKm));
}

/** Jarak episenter terjauh (km) yang masih merasakan MMI >= `batas`; 0 kalau di episenter pun tidak sampai. */
export function radiusMmi(mag: number, kedalamanKm: number, batas: number): number {
  if (mmi(mag, 0, kedalamanKm) < batas) return 0;
  let lo = 0;
  let hi = 2000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (mmi(mag, mid, kedalamanKm) >= batas) lo = mid;
    else hi = mid;
  }
  return lo;
}

const ROMAWI = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export function romawi(nilaiMmi: number): string {
  return ROMAWI[Math.min(10, Math.max(1, Math.round(nilaiMmi)))];
}

export const WARNA_MMI: Record<number, string> = {
  4: "#7dd3fc",
  5: "#4ade80",
  6: "#fde047",
  7: "#fb923c",
  8: "#ef4444",
  9: "#b91c1c",
  10: "#7f1d1d",
};

/** Uraian singkat skala MMI (BMKG). */
export const URAIAN_MMI: Record<number, { id: string; en: string }> = {
  4: { id: "Terasa di dalam rumah, gerabah berderik", en: "Felt indoors, dishes rattle" },
  5: { id: "Terasa hampir semua orang, barang jatuh", en: "Felt by nearly everyone, objects fall" },
  6: { id: "Plester retak, perabot bergeser, orang berlarian", en: "Plaster cracks, furniture shifts" },
  7: { id: "Rusak ringan-sedang pada bangunan biasa", en: "Slight to moderate damage in ordinary buildings" },
  8: { id: "Rusak berat pada bangunan lemah, dinding lepas", en: "Heavy damage in weak structures" },
  9: { id: "Bangunan kokoh rusak, rangka bengkok, tanah retak", en: "Well-built structures damaged, ground cracks" },
  10: { id: "Sebagian besar bangunan runtuh", en: "Most structures destroyed" },
};

/** Daftar cincin MMI (terkuat dulu) untuk digambar di peta. */
export function cincinMmi(mag: number, kedalamanKm: number): { mmi: number; radiusKm: number }[] {
  const hasil: { mmi: number; radiusKm: number }[] = [];
  for (let m = 9; m >= 4; m--) {
    // cincin "MMI m" = batas luar wilayah yang intensitasnya dibulatkan ke m atau lebih
    const r = radiusMmi(mag, kedalamanKm, m - 0.5);
    if (r > 1) hasil.push({ mmi: m, radiusKm: r });
  }
  return hasil;
}
