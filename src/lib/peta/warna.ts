/** Skala warna untuk lapisan medan (hujan, suhu, PM2.5, FWI, risiko banjir, penduduk) dan legenda-nya. */

export type Rgba = [number, number, number, number];

export interface Skala {
  /** titik henti: [nilai, r, g, b, alfa 0..255] */
  henti: [number, number, number, number, number][];
  satuan: string;
  /** label legenda (nilai yang ditulis di bawah pita warna) */
  label: number[];
}

export const SKALA: Record<"hujan" | "suhu" | "udara" | "fwi" | "banjir" | "penduduk", Skala> = {
  hujan: {
    satuan: "mm/3 jam",
    label: [1, 5, 10, 20, 40],
    henti: [
      [0, 96, 165, 250, 0],
      [0.3, 96, 165, 250, 0],
      [1, 96, 165, 250, 70],
      [5, 59, 130, 246, 150],
      [10, 34, 211, 238, 190],
      [20, 250, 204, 21, 205],
      [40, 249, 115, 22, 220],
      [80, 239, 68, 68, 230],
    ],
  },
  suhu: {
    satuan: "°C",
    label: [18, 22, 26, 30, 34],
    // suhu ada di mana-mana, jadi yang "biasa" (laut tropis 26-29 °C) nyaris bening: yang diwarnai
    // hanya yang menyimpang, sejuk di dataran tinggi dan panas di darat siang hari
    henti: [
      [14, 56, 189, 248, 165],
      [20, 45, 212, 191, 125],
      [24, 74, 222, 128, 60],
      [26.5, 250, 204, 21, 14],
      [29, 251, 146, 60, 22],
      [31, 251, 146, 60, 100],
      [33, 239, 68, 68, 150],
      [37, 190, 24, 93, 180],
    ],
  },
  udara: {
    satuan: "µg/m³ PM2.5",
    label: [15, 35, 55, 150, 250],
    // udara bersih (di bawah ~12) tidak diwarnai sama sekali: yang tampil hanya tempat yang kotor
    henti: [
      [0, 163, 230, 53, 0],
      [10, 163, 230, 53, 0],
      [15, 190, 210, 60, 70],
      [35, 250, 204, 21, 150],
      [55, 249, 115, 22, 185],
      [150, 239, 68, 68, 205],
      [250, 168, 85, 247, 220],
    ],
  },
  fwi: {
    satuan: "FWI",
    label: [1, 6, 13, 25],
    // kelas rendah cukup jadi rona tipis, supaya yang menyala hanya tempat yang memang berisiko
    henti: [
      [0, 74, 222, 128, 34],
      [1, 74, 222, 128, 62],
      [3.5, 250, 204, 21, 150],
      [6, 251, 146, 60, 185],
      [13, 239, 68, 68, 210],
      [25, 190, 24, 93, 225],
    ],
  },
  banjir: {
    satuan: "mm/hari (terbasah)",
    label: [20, 50, 100, 150],
    henti: [
      [0, 56, 189, 248, 0],
      [10, 56, 189, 248, 40],
      [20, 56, 189, 248, 110],
      [50, 253, 224, 71, 180],
      [100, 251, 146, 60, 205],
      [150, 239, 68, 68, 225],
    ],
  },
  penduduk: {
    satuan: "jiwa/km²",
    label: [10, 100, 1000, 5000],
    henti: [
      [0, 253, 230, 138, 0],
      [2, 253, 230, 138, 25],
      [10, 253, 230, 138, 80],
      [100, 251, 191, 36, 135],
      [1000, 249, 115, 22, 185],
      [5000, 239, 68, 68, 215],
      [20000, 255, 255, 255, 235],
    ],
  },
};

/** Warna pada nilai `v` (interpolasi linier antar titik henti); ditulis ke `keluar`. */
export function warnaSkala(skala: Skala, v: number, keluar: Rgba): Rgba {
  const h = skala.henti;
  if (!(v > h[0][0])) {
    keluar[0] = h[0][1];
    keluar[1] = h[0][2];
    keluar[2] = h[0][3];
    keluar[3] = Number.isNaN(v) ? 0 : h[0][4];
    return keluar;
  }
  for (let i = 1; i < h.length; i++) {
    if (v <= h[i][0]) {
      const a = h[i - 1];
      const b = h[i];
      const f = (v - a[0]) / (b[0] - a[0]);
      keluar[0] = a[1] + (b[1] - a[1]) * f;
      keluar[1] = a[2] + (b[2] - a[2]) * f;
      keluar[2] = a[3] + (b[3] - a[3]) * f;
      keluar[3] = a[4] + (b[4] - a[4]) * f;
      return keluar;
    }
  }
  const z = h[h.length - 1];
  keluar[0] = z[1];
  keluar[1] = z[2];
  keluar[2] = z[3];
  keluar[3] = z[4];
  return keluar;
}

/** Gradien CSS untuk pita legenda, sepanjang rentang label pertama..terakhir (skala akar supaya nilai kecil kelihatan). */
export function gradienLegenda(skala: Skala): string {
  const min = skala.henti[0][0];
  const maks = skala.henti[skala.henti.length - 1][0];
  const bagian: string[] = [];
  const c: Rgba = [0, 0, 0, 0];
  for (let i = 0; i <= 20; i++) {
    const f = i / 20;
    warnaSkala(skala, min + (maks - min) * f * f, c);
    bagian.push(`rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${Math.max(0.25, c[3] / 255).toFixed(2)}) ${Math.round(f * 100)}%`);
  }
  return `linear-gradient(90deg, ${bagian.join(", ")})`;
}

/** Posisi (0..1) sebuah nilai di pita legenda, kebalikan dari skala akar di atas. */
export function posisiLegenda(skala: Skala, v: number): number {
  const min = skala.henti[0][0];
  const maks = skala.henti[skala.henti.length - 1][0];
  return Math.sqrt(Math.min(1, Math.max(0, (v - min) / (maks - min))));
}

export const WARNA_LEVEL_GUNUNG = ["#8b95a7", "#4ade80", "#fde047", "#fb923c", "#ef4444"];

export const WARNA_JENIS_BENCANA: Record<string, string> = {
  banjir: "#38bdf8",
  longsor: "#d97706",
  cuaca: "#a78bfa",
  karhutla: "#ff5d2e",
  gempa: "#ffc857",
  kekeringan: "#fde68a",
  erupsi: "#f87171",
  gelombang: "#2dd4bf",
  lain: "#c084fc",
};

/** Kelompokkan nama kategori BNPB / PetaBencana ke kunci warna. */
export function kunciJenisBencana(jenis: string): keyof typeof WARNA_JENIS_BENCANA {
  const j = jenis.toLowerCase();
  if (/banjir|flood/.test(j)) return "banjir";
  if (/longsor|landslide/.test(j)) return "longsor";
  if (/cuaca|angin|puting|wind/.test(j)) return "cuaca";
  if (/kebakaran|karhutla|fire|haze|asap/.test(j)) return "karhutla";
  if (/gempa|earthquake/.test(j)) return "gempa";
  if (/kering|drought/.test(j)) return "kekeringan";
  if (/erupsi|gunung|volcano/.test(j)) return "erupsi";
  if (/gelombang|abrasi|tsunami/.test(j)) return "gelombang";
  return "lain";
}
