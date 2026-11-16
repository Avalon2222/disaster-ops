/**
 * Semua source dan layer MapLibre. Tiap lapisan di lib/lapisan.ts punya satu atau beberapa layer di sini;
 * LAYER_LAPISAN memetakan id lapisan ke id layer-nya (untuk menyalakan/mematikan), LAYER_INTERAKTIF
 * memetakan layer yang bisa diklik ke jenis objeknya.
 */

import type { GeoJSONSource, Map as MapLibre, StyleSpecification } from "maplibre-gl";
import type { IdLapisan, JenisInarisk } from "../lapisan";
import paletInarisk from "./palet_inarisk.json";
import { pasangIkon } from "./ikon";
import { FONT, FONT_TEBAL, idLayerAir, idLayerLabelPertama } from "./mapStyle";
import { GAMBAR_KOSONG, type Sudut } from "./medan";
import { WARNA_JENIS_BENCANA } from "./warna";

type Fitur = GeoJSON.Feature;
export const KOSONG: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export const LAYER_LAPISAN: Record<IdLapisan, string[]> = {
  hotspot: ["hotspot-bara", "hotspot-titik"],
  gempa: ["gempa-titik", "gempa-label"],
  gunung: ["gunung-ikon"],
  bencana: ["bencana-ikon"],
  laporan: ["laporan-ikon"],
  peringatan: ["peringatan-isi", "peringatan-garis"],
  angin: [],
  hujan: ["medan-atas", "medan-label"],
  suhu: ["medan-atas", "medan-label"],
  udara: ["medan-atas", "medan-label"],
  citra: ["citra-raster"],
  fwi: ["medan-darat", "medan-label"],
  asap: ["asap-garis", "asap-ujung"],
  banjir: ["medan-darat", "medan-label"],
  sungai: ["sungai-ikon"],
  sesar: ["historis-titik", "sesar-garis", "sesar-kena", "megathrust-pendar", "megathrust-garis", "megathrust-arus", "megathrust-gigi", "sesar-sorot", "sesar-sorot-arus"],
  inarisk: ["inarisk-raster"],
  penduduk: ["medan-darat"],
  rs: ["rs-titik", "rs-ikon"],
};

/**
 * Layer raster yang dinyalakan/dimatikan dengan memudar (opasitas), bukan langsung hilang.
 * Nilainya opasitas saat menyala.
 */
export const LAYER_PUDAR: Record<string, number> = {
  "medan-darat": 0.86,
  "medan-atas": 0.82,
  "inarisk-raster": 0.8,
  "citra-raster": 0.92,
};

/** layer yang bisa diklik -> jenis objek (dipakai panel detail) */
export const LAYER_INTERAKTIF: Record<string, string> = {
  "hotspot-titik": "hotspot",
  "gempa-titik": "gempa",
  "gunung-ikon": "gunung",
  "bencana-ikon": "bencana",
  "laporan-ikon": "laporan",
  "peringatan-isi": "peringatan",
  "sungai-ikon": "sungai",
  "historis-titik": "historis",
  "sesar-kena": "sesar",
  "rs-ikon": "rs",
  "rs-titik": "rs",
  "replay-titik": "replay",
};

/** Layer garis yang dasharray-nya dianimasikan ("arus" yang mengalir sepanjang garis). */
export const LAYER_ARUS = ["megathrust-arus", "sesar-sorot-arus"];

/** Kotak yang ditutup gambar peta bahaya InaRISK (lon/lat). */
export const KOTAK_INARISK = { lonMin: 94.5, lonMax: 141.5, latMin: -11.5, latMax: 6.5 };
export const SUDUT_INARISK: Sudut = [
  [KOTAK_INARISK.lonMin, KOTAK_INARISK.latMax],
  [KOTAK_INARISK.lonMax, KOTAK_INARISK.latMax],
  [KOTAK_INARISK.lonMax, KOTAK_INARISK.latMin],
  [KOTAK_INARISK.lonMin, KOTAK_INARISK.latMin],
];

export function urlInarisk(jenis: JenisInarisk): string {
  return `/data/inarisk/${jenis}.webp`;
}

/** Gradien CSS palet satu jenis peta bahaya (indeks 0..1), untuk legenda. */
export function gradienInarisk(jenis: JenisInarisk): string {
  const henti = (paletInarisk as Record<string, number[][]>)[jenis];
  return `linear-gradient(90deg, ${henti.map(([v, r, g, b, a]) => `rgba(${r},${g},${b},${Math.max(0.22, a / 255).toFixed(2)}) ${Math.round(v * 100)}%`).join(", ")})`;
}

/** Warna paling "khas" satu jenis peta bahaya (kelas sedang-tinggi), untuk titik di tombol pilihannya. */
export function warnaInarisk(jenis: JenisInarisk): string {
  const henti = (paletInarisk as Record<string, number[][]>)[jenis];
  const [, r, g, b] = henti[henti.length - 2];
  return `rgb(${r},${g},${b})`;
}

const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

/** Ubin warna asli VIIRS untuk satu tanggal. Suomi NPP untuk arsip lama, NOAA-20 untuk sekarang. */
export function urlCitra(tanggal: string): string {
  const lapisan = tanggal < "2020-01-01" ? "VIIRS_SNPP_CorrectedReflectance_TrueColor" : "VIIRS_NOAA20_CorrectedReflectance_TrueColor";
  return `${GIBS}/${lapisan}/default/${tanggal}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
}

function geojson(m: MapLibre, id: string, opsi: Record<string, unknown> = {}) {
  m.addSource(id, { type: "geojson", data: KOSONG, ...opsi });
}

const SUDUT_AWAL: Sudut = [
  [94, 8],
  [142, 8],
  [142, -12],
  [94, -12],
];

const PUDAR = { duration: 450, delay: 0 };

export function pasangSemuaLapisan(m: MapLibre, style: StyleSpecification, kanvasTsunami: HTMLCanvasElement): void {
  const bawahAir = idLayerAir(style);
  const bawahLabel = idLayerLabelPertama(style);
  pasangIkon(m);

  // --- raster: citra harian, peta bahaya InaRISK, medan prakiraan ---
  // semuanya selalu "visible" dan dinyalakan lewat opasitas, supaya muncul dan hilangnya memudar
  m.addSource("citra", { type: "raster", tiles: [urlCitra("2019-09-15")], tileSize: 256, maxzoom: 9, attribution: "NASA GIBS" });
  m.addLayer({ id: "citra-raster", type: "raster", source: "citra", layout: { visibility: "none" }, paint: { "raster-opacity": 0, "raster-opacity-transition": PUDAR, "raster-fade-duration": 250 } }, bawahLabel);

  m.addSource("inarisk", { type: "image", url: GAMBAR_KOSONG, coordinates: SUDUT_INARISK });
  m.addLayer({ id: "inarisk-raster", type: "raster", source: "inarisk", paint: { "raster-opacity": 0, "raster-opacity-transition": PUDAR, "raster-fade-duration": 0, "raster-resampling": "linear" } }, bawahAir);

  m.addSource("medan-darat", { type: "image", url: GAMBAR_KOSONG, coordinates: SUDUT_AWAL });
  m.addLayer({ id: "medan-darat", type: "raster", source: "medan-darat", paint: { "raster-opacity": 0, "raster-opacity-transition": PUDAR, "raster-fade-duration": 0, "raster-resampling": "linear" } }, bawahAir);

  m.addSource("medan-atas", { type: "image", url: GAMBAR_KOSONG, coordinates: SUDUT_AWAL });
  m.addLayer({ id: "medan-atas", type: "raster", source: "medan-atas", paint: { "raster-opacity": 0, "raster-opacity-transition": PUDAR, "raster-fade-duration": 0, "raster-resampling": "linear" } }, bawahLabel);

  m.addSource("tsunami", { type: "canvas", canvas: kanvasTsunami, coordinates: SUDUT_AWAL, animate: false });
  m.addLayer({ id: "tsunami-raster", type: "raster", source: "tsunami", layout: { visibility: "none" }, paint: { "raster-opacity": 0.85, "raster-fade-duration": 0, "raster-resampling": "linear" } }, bawahLabel);

  // --- peringatan dini cuaca (poligon) ---
  geojson(m, "peringatan");
  m.addLayer({ id: "peringatan-isi", type: "fill", source: "peringatan", paint: { "fill-color": "#fbbf24", "fill-opacity": 0.2 } });
  m.addLayer({ id: "peringatan-garis", type: "line", source: "peringatan", paint: { "line-color": "#fbbf24", "line-width": 1.2, "line-dasharray": [2, 1.5], "line-opacity": 0.9 } });

  // --- sesar, megathrust, gempa historis ---
  geojson(m, "historis");
  m.addLayer({
    id: "historis-titik",
    type: "circle",
    source: "historis",
    paint: {
      // di zoom jauh hanya jadi tekstur halus (supaya tidak dikira gempa baru); makin dekat makin jelas
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, ["interpolate", ["linear"], ["get", "mag"], 6, 0.7, 7.5, 1.6, 9, 4.5], 8, ["interpolate", ["linear"], ["get", "mag"], 6, 3.5, 9, 20]],
      "circle-color": "#e11d48",
      "circle-opacity": ["interpolate", ["linear"], ["zoom"], 3, ["interpolate", ["linear"], ["get", "mag"], 6, 0.14, 7.5, 0.3, 9, 0.55], 7, ["interpolate", ["linear"], ["get", "mag"], 6, 0.3, 7.5, 0.5, 9, 0.75]],
      "circle-stroke-color": "#fecdd3",
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 5, 0, 7, ["case", [">=", ["get", "mag"], 7.5], 0.8, 0]],
    },
  });
  // generateId: tiap garis dapat id angka, dipakai untuk menyorot garis yang diklik
  m.addSource("sesar", { type: "geojson", data: "/data/sesar.geojson", generateId: true });
  const hanyaSesar = ["==", ["get", "jenis"], "sesar"] as ["==", unknown, unknown];
  const hanyaMegathrust = ["==", ["get", "jenis"], "megathrust"] as ["==", unknown, unknown];
  const bulat = { "line-cap": "round", "line-join": "round" } as const;
  m.addLayer({ id: "sesar-garis", type: "line", source: "sesar", filter: hanyaSesar as never, layout: bulat, paint: { "line-color": "#fda4af", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.8, 8, 2.2], "line-opacity": 0.8 } });
  m.addLayer({ id: "megathrust-pendar", type: "line", source: "sesar", filter: hanyaMegathrust as never, layout: bulat, paint: { "line-color": "#f43f5e", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 7, 8, 16], "line-blur": 8, "line-opacity": 0.45 } });
  m.addLayer({ id: "megathrust-garis", type: "line", source: "sesar", filter: hanyaMegathrust as never, layout: bulat, paint: { "line-color": "#f43f5e", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1.8, 8, 3.6], "line-opacity": 0.95 } });
  m.addLayer({ id: "megathrust-arus", type: "line", source: "sesar", filter: hanyaMegathrust as never, paint: { "line-color": "#fff1f2", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1.2, 8, 2.4], "line-opacity": 0.75, "line-dasharray": [0, 4, 3] } });
  m.addLayer({
    id: "megathrust-gigi",
    type: "symbol",
    source: "sesar",
    filter: hanyaMegathrust as never,
    layout: {
      "symbol-placement": "line",
      "symbol-spacing": ["interpolate", ["linear"], ["zoom"], 3, 26, 8, 60],
      "icon-image": "gigi",
      "icon-size": ["interpolate", ["linear"], ["zoom"], 3, 0.55, 8, 1.1],
      "icon-offset": [0, -7],
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-rotation-alignment": "map",
    },
  });
  // garis tak terlihat yang lebih lebar: supaya garis tipis gampang diklik dan disorot kursor
  m.addLayer({ id: "sesar-kena", type: "line", source: "sesar", layout: bulat, paint: { "line-color": "#ffffff", "line-width": 14, "line-opacity": 0.001 } });
  // sorotan garis terpilih (filter diisi id garisnya saat diklik)
  const tanpa = ["==", ["id"], -1] as never;
  m.addLayer({ id: "sesar-sorot", type: "line", source: "sesar", filter: tanpa, layout: bulat, paint: { "line-color": "#ffc857", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 5, 8, 9], "line-blur": 2, "line-opacity": 0.9 } });
  m.addLayer({ id: "sesar-sorot-arus", type: "line", source: "sesar", filter: tanpa, paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1.6, 8, 3], "line-dasharray": [0, 4, 3] } });

  // --- rumah sakit: titik kecil untuk kerapatan, ikon palang untuk yang lolos uji tumpang-tindih ---
  geojson(m, "rs");
  m.addLayer({
    id: "rs-titik",
    type: "circle",
    source: "rs",
    minzoom: 3.5,
    maxzoom: 9,
    paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 3.5, 1.1, 8, 2.6], "circle-color": "#34d399", "circle-opacity": ["interpolate", ["linear"], ["zoom"], 3.5, 0.75, 8, 0.5, 9, 0] },
  });
  m.addLayer({
    id: "rs-ikon",
    type: "symbol",
    source: "rs",
    minzoom: 4.5,
    layout: {
      "icon-image": "rs",
      "icon-size": ["interpolate", ["linear"], ["zoom"], 4.5, 0.5, 8, 0.72, 12, 1],
      "icon-padding": 1,
      "text-field": ["step", ["zoom"], "", 9.5, ["get", "nama"]],
      "text-font": FONT,
      "text-size": 10,
      "text-offset": [0, 1.1],
      "text-anchor": "top",
      "text-optional": true,
    },
    paint: { "text-color": "#a7f3d0", "text-halo-color": "#05080f", "text-halo-width": 1.2 },
  });

  // --- asap: lintasan maju dari gugus titik panas ---
  geojson(m, "asap");
  m.addLayer({
    id: "asap-garis",
    type: "line",
    source: "asap",
    filter: ["==", ["geometry-type"], "LineString"],
    layout: bulat,
    paint: { "line-color": "#d6d3d1", "line-width": ["interpolate", ["linear"], ["get", "frp"], 0, 1.5, 2000, 7], "line-opacity": 0.4, "line-blur": 3 },
  });
  m.addLayer({ id: "asap-ujung", type: "circle", source: "asap", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 3, "circle-color": "#e7e5e4", "circle-stroke-color": "#05080f", "circle-stroke-width": 1 } });

  // --- titik panas: pendar di zoom jauh, titik di zoom dekat ---
  geojson(m, "hotspot");
  m.addLayer({
    id: "hotspot-bara",
    type: "heatmap",
    source: "hotspot",
    maxzoom: 8,
    paint: {
      "heatmap-weight": ["interpolate", ["linear"], ["get", "frp"], 0, 0.15, 60, 0.8],
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 2, 0.35, 7, 1.1],
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 2, 3, 5, 8, 8, 16],
      "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 4.5, 0.7, 7.5, 0],
      "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(255,93,46,0)", 0.15, "rgba(255,93,46,0.45)", 0.45, "rgba(255,140,40,0.75)", 0.75, "rgba(255,200,87,0.9)", 1, "rgba(255,245,220,1)"],
    },
  });
  m.addLayer({
    id: "hotspot-titik",
    type: "circle",
    source: "hotspot",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 1.3, 6, 2.6, 10, ["interpolate", ["linear"], ["get", "frp"], 0, 4, 100, 9]],
      "circle-color": ["interpolate", ["linear"], ["get", "frp"], 0, "#ff5d2e", 20, "#ff8c28", 60, "#ffc857", 150, "#fff5dc"],
      "circle-opacity": ["interpolate", ["linear"], ["get", "umur"], 0, 0.95, 24, 0.8, 168, 0.4],
      "circle-stroke-color": "#05080f",
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 5, 0, 8, 0.8],
    },
  });

  // --- putar ulang karhutla 2019 ---
  geojson(m, "replay");
  m.addLayer({
    id: "replay-titik",
    type: "circle",
    source: "replay",
    layout: { visibility: "none" },
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, ["interpolate", ["linear"], ["get", "umur"], 0, 2.2, 3, 1], 8, ["interpolate", ["linear"], ["get", "umur"], 0, 6, 3, 3]],
      "circle-color": ["interpolate", ["linear"], ["get", "umur"], 0, "#ffe9b0", 1, "#ffb347", 2, "#ff5d2e", 3, "#7f1d1d"],
      "circle-opacity": ["interpolate", ["linear"], ["get", "umur"], 0, 0.95, 3, 0.25],
    },
  });

  // --- angka prakiraan di kota-kota utama (mengikuti lapisan medan yang aktif) ---
  geojson(m, "medan-label");
  m.addLayer({
    id: "medan-label",
    type: "symbol",
    source: "medan-label",
    layout: { "text-field": ["get", "teks"], "text-font": FONT_TEBAL, "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10, 7, 12.5], "text-padding": 6, "symbol-sort-key": ["get", "urut"] },
    paint: { "text-color": ["get", "warna"], "text-halo-color": "#05080f", "text-halo-width": 1.6 },
  });

  // --- debit sungai ---
  geojson(m, "sungai");
  m.addLayer({
    id: "sungai-ikon",
    type: "symbol",
    source: "sungai",
    layout: {
      "icon-image": ["concat", "sungai-", ["to-string", ["get", "tingkat"]]],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 3, 0.62, 8, 0.95],
      "icon-allow-overlap": true,
      "symbol-sort-key": ["-", 0, ["get", "tingkat"]],
      "text-field": ["get", "nama"],
      "text-font": FONT,
      "text-size": 10.5,
      "text-offset": [0, 1.25],
      "text-anchor": "top",
      "text-optional": true,
    },
    paint: { "text-color": "#99f6e4", "text-halo-color": "#05080f", "text-halo-width": 1.3 },
  });

  // --- laporan warga ---
  geojson(m, "laporan");
  m.addLayer({
    id: "laporan-ikon",
    type: "symbol",
    source: "laporan",
    layout: { "icon-image": ["concat", "laporan-", ["get", "kunci"]], "icon-size": ["interpolate", ["linear"], ["zoom"], 3, 0.62, 9, 1], "icon-allow-overlap": true },
  });

  // --- kejadian BNPB ---
  geojson(m, "bencana");
  m.addLayer({
    id: "bencana-ikon",
    type: "symbol",
    source: "bencana",
    layout: {
      "icon-image": ["concat", "bencana-", ["get", "kunci"]],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 8, 0.95],
      "icon-allow-overlap": true,
      "text-field": ["step", ["zoom"], "", 5.5, ["get", "label"]],
      "text-font": FONT,
      "text-size": 10,
      "text-offset": [0, 1.5],
      "text-anchor": "top",
      "text-optional": true,
    },
    paint: { "text-color": ["get", "warna"], "text-halo-color": "#05080f", "text-halo-width": 1.3 },
  });

  // --- gunung api ---
  geojson(m, "gunung");
  m.addLayer({
    id: "gunung-ikon",
    type: "symbol",
    source: "gunung",
    layout: {
      "icon-image": ["concat", "gunung-", ["to-string", ["get", "level"]]],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 3, ["match", ["get", "level"], 4, 0.72, 3, 0.64, 2, 0.46, 0.34], 8, ["match", ["get", "level"], 4, 1.15, 3, 1.05, 2, 0.85, 0.68]],
      "icon-allow-overlap": true,
      "icon-anchor": "bottom",
      "symbol-sort-key": ["get", "level"],
      "text-field": ["step", ["zoom"], ["case", [">=", ["get", "level"], 3], ["get", "nama"], ""], 5.5, ["case", [">=", ["get", "level"], 2], ["get", "nama"], ""], 7, ["get", "nama"]],
      "text-font": FONT,
      "text-size": 10.5,
      "text-offset": [0, 0.2],
      "text-anchor": "top",
      "text-optional": true,
    },
    paint: { "text-color": "#fecaca", "text-halo-color": "#05080f", "text-halo-width": 1.3 },
  });

  // --- gempa ---
  geojson(m, "gempa");
  m.addLayer({
    id: "gempa-titik",
    type: "circle",
    source: "gempa",
    layout: { "circle-sort-key": ["get", "mag"] },
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, ["interpolate", ["exponential", 1.8], ["get", "mag"], 2, 1.5, 5, 5, 7, 13, 9, 26], 8, ["interpolate", ["exponential", 1.8], ["get", "mag"], 2, 4, 5, 11, 7, 26, 9, 48]],
      "circle-color": ["step", ["get", "dalam"], "#ff5d2e", 50, "#ffc857", 100, "#4ade80", 300, "#60a5fa"],
      "circle-opacity": ["interpolate", ["linear"], ["get", "umur"], 0, 0.75, 24, 0.5, 168, 0.18],
      "circle-stroke-color": ["case", ["get", "tsunami"], "#ef4444", "#fff7ed"],
      "circle-stroke-width": ["case", ["get", "tsunami"], 2.5, [">=", ["get", "mag"], 5], 1.2, 0.4],
      "circle-stroke-opacity": ["interpolate", ["linear"], ["get", "umur"], 0, 1, 168, 0.35],
    },
  });
  m.addLayer({
    id: "gempa-label",
    type: "symbol",
    source: "gempa",
    filter: [">=", ["get", "mag"], 5],
    layout: { "text-field": ["concat", "M", ["to-string", ["get", "mag"]]], "text-font": FONT_TEBAL, "text-size": 11, "text-offset": [0, -1.4], "text-optional": true },
    paint: { "text-color": "#ffe9b0", "text-halo-color": "#05080f", "text-halo-width": 1.4 },
  });

  // --- alat: skenario guncangan, rute evakuasi, waktu tiba tsunami ---
  geojson(m, "skenario");
  m.addLayer({ id: "skenario-isi", type: "fill", source: "skenario", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": ["get", "warna"], "fill-opacity": 0.13 } });
  m.addLayer({ id: "skenario-garis", type: "line", source: "skenario", filter: ["==", ["geometry-type"], "Polygon"], paint: { "line-color": ["get", "warna"], "line-width": 1.6, "line-opacity": 0.95 } });
  m.addLayer({
    id: "skenario-label",
    type: "symbol",
    source: "skenario",
    filter: ["==", ["geometry-type"], "Point"],
    layout: { "text-field": ["get", "label"], "text-font": FONT_TEBAL, "text-size": 11, "text-allow-overlap": true },
    paint: { "text-color": ["get", "warna"], "text-halo-color": "#05080f", "text-halo-width": 1.6 },
  });
  geojson(m, "rute");
  m.addLayer({ id: "rute-bayang", type: "line", source: "rute", layout: bulat, paint: { "line-color": "#05080f", "line-width": 7, "line-opacity": 0.8 } });
  m.addLayer({ id: "rute-garis", type: "line", source: "rute", layout: bulat, paint: { "line-color": "#34d399", "line-width": 3.5 } });
  geojson(m, "eta");
  m.addLayer({
    id: "eta-titik",
    type: "circle",
    source: "eta",
    paint: { "circle-radius": 4, "circle-color": ["get", "warna"], "circle-stroke-color": "#05080f", "circle-stroke-width": 1.5 },
  });
  m.addLayer({
    id: "eta-label",
    type: "symbol",
    source: "eta",
    layout: { "text-field": ["get", "label"], "text-font": FONT_TEBAL, "text-size": 10.5, "text-offset": [0, 0.9], "text-anchor": "top", "text-optional": true, "symbol-sort-key": ["get", "menit"] },
    paint: { "text-color": "#f8fafc", "text-halo-color": "#05080f", "text-halo-width": 1.5 },
  });
}

export function setData(m: MapLibre, id: string, fitur: Fitur[]): void {
  (m.getSource(id) as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: fitur });
}

export function setTerlihat(m: MapLibre, idLayer: string, on: boolean): void {
  if (m.getLayer(idLayer)) m.setLayoutProperty(idLayer, "visibility", on ? "visible" : "none");
}

/**
 * Samakan tampilan semua layer dengan himpunan lapisan aktif. Layer bersama (medan) nyala kalau salah
 * satu pemakainya aktif. Layer raster memudar lewat opasitas; sisanya lewat `visibility`.
 */
export function sinkronVisibilitas(m: MapLibre, aktif: Set<IdLapisan>): void {
  const nyala = new Map<string, boolean>();
  for (const [id, daftar] of Object.entries(LAYER_LAPISAN) as [IdLapisan, string[]][]) {
    for (const l of daftar) nyala.set(l, (nyala.get(l) ?? false) || aktif.has(id));
  }
  for (const [l, on] of nyala) {
    if (!m.getLayer(l)) continue;
    if (l in LAYER_PUDAR) {
      // peta bahaya dinyalakan pemanggilnya sendiri setelah gambarnya siap; di sini hanya dimatikan
      if (on && l === "inarisk-raster") continue;
      // ubin citra baru diminta setelah layernya "visible"; gambar medan/InaRISK selalu visible
      if (on && m.getLayoutProperty(l, "visibility") === "none") m.setLayoutProperty(l, "visibility", "visible");
      m.setPaintProperty(l, "raster-opacity", on ? LAYER_PUDAR[l] : 0);
    } else setTerlihat(m, l, on);
  }
}

/** Nyalakan/matikan satu layer raster dengan memudar (dipakai putar ulang untuk citra harian). */
export function pudarkanRaster(m: MapLibre, idLayer: string, on: boolean): void {
  if (!m.getLayer(idLayer)) return;
  if (on) m.setLayoutProperty(idLayer, "visibility", "visible");
  m.setPaintProperty(idLayer, "raster-opacity", on ? (LAYER_PUDAR[idLayer] ?? 1) : 0);
}

/** Sorot satu garis sesar/megathrust berdasarkan id fiturnya; null = lepas sorotan. */
export function sorotGaris(m: MapLibre, id: number | null): void {
  const filter = ["==", ["id"], id ?? -1] as never;
  for (const l of ["sesar-sorot", "sesar-sorot-arus"]) if (m.getLayer(l)) m.setFilter(l, filter);
}

// urutan dasharray yang membuat garis putus-putus tampak mengalir (teknik "ant path")
const URUTAN_ARUS: number[][] = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0],
  [0, 0.5, 3, 3.5],
  [0, 1, 3, 3],
  [0, 1.5, 3, 2.5],
  [0, 2, 3, 2],
  [0, 2.5, 3, 1.5],
  [0, 3, 3, 1],
  [0, 3.5, 3, 0.5],
];

/** Jalankan animasi "arus" di layer garis; kembalikan fungsi untuk menghentikannya. */
export function animasiArus(m: MapLibre, layer: string[] = LAYER_ARUS, selangMs = 90): () => void {
  // tiap langkah membuat peta digambar ulang, jadi dihormati kalau pengguna minta gerakan dikurangi
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => undefined;
  let langkah = 0;
  const id = setInterval(() => {
    if (document.hidden || m.isMoving()) return;
    langkah = (langkah + 1) % URUTAN_ARUS.length;
    for (const l of layer) if (m.getLayer(l) && m.getLayoutProperty(l, "visibility") !== "none") m.setPaintProperty(l, "line-dasharray", URUTAN_ARUS[langkah]);
  }, selangMs);
  return () => clearInterval(id);
}

export function titik(lon: number, lat: number, props: Record<string, unknown>): Fitur {
  return { type: "Feature", properties: props, geometry: { type: "Point", coordinates: [lon, lat] } };
}

export { WARNA_JENIS_BENCANA };
