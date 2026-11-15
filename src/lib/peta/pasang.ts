/**
 * Semua source dan layer MapLibre. Tiap lapisan di lib/lapisan.ts punya satu atau beberapa layer di sini;
 * LAYER_LAPISAN memetakan id lapisan ke id layer-nya (untuk menyalakan/mematikan), LAYER_INTERAKTIF
 * memetakan layer yang bisa diklik ke jenis objeknya.
 */

import type { GeoJSONSource, Map as MapLibre, StyleSpecification } from "maplibre-gl";
import type { IdLapisan, JenisInarisk } from "../lapisan";
import { FONT, FONT_TEBAL, idLayerAir, idLayerLabelPertama } from "./mapStyle";
import { WARNA_JENIS_BENCANA, WARNA_LEVEL_GUNUNG } from "./warna";

type Fitur = GeoJSON.Feature;
export const KOSONG: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export const LAYER_LAPISAN: Record<IdLapisan, string[]> = {
  hotspot: ["hotspot-bara", "hotspot-titik"],
  gempa: ["gempa-titik", "gempa-label"],
  gunung: ["gunung-ikon"],
  bencana: ["bencana-titik", "bencana-label"],
  laporan: ["laporan-titik"],
  peringatan: ["peringatan-isi", "peringatan-garis"],
  angin: [],
  hujan: ["medan-atas"],
  suhu: ["medan-atas"],
  udara: ["medan-atas"],
  citra: ["citra-raster"],
  fwi: ["medan-darat"],
  asap: ["asap-garis", "asap-ujung"],
  banjir: ["medan-darat"],
  sungai: ["sungai-titik", "sungai-label"],
  sesar: ["historis-titik", "sesar-garis", "megathrust-garis"],
  inarisk: ["inarisk-raster"],
  penduduk: ["medan-darat"],
  rs: ["rs-titik", "rs-label"],
};

/** layer yang bisa diklik -> jenis objek (dipakai panel detail) */
export const LAYER_INTERAKTIF: Record<string, string> = {
  "hotspot-titik": "hotspot",
  "gempa-titik": "gempa",
  "gunung-ikon": "gunung",
  "bencana-titik": "bencana",
  "laporan-titik": "laporan",
  "peringatan-isi": "peringatan",
  "sungai-titik": "sungai",
  "historis-titik": "historis",
  "sesar-garis": "sesar",
  "megathrust-garis": "sesar",
  "rs-titik": "rs",
  "replay-titik": "replay",
};

export function urlInarisk(jenis: JenisInarisk): string {
  return `/api/inarisk/${jenis}?bbox={bbox-epsg-3857}`;
}

const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

/** Ubin warna asli VIIRS untuk satu tanggal. Suomi NPP untuk arsip lama, NOAA-20 untuk sekarang. */
export function urlCitra(tanggal: string): string {
  const lapisan = tanggal < "2020-01-01" ? "VIIRS_SNPP_CorrectedReflectance_TrueColor" : "VIIRS_NOAA20_CorrectedReflectance_TrueColor";
  return `${GIBS}/${lapisan}/default/${tanggal}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
}

/** Segitiga putih (SDF) untuk gunung api, diwarnai lewat icon-color. */
function gambarSegitiga(ukuran = 48): { width: number; height: number; data: Uint8Array } {
  const data = new Uint8Array(ukuran * ukuran * 4);
  const tepi = ukuran * 0.14;
  for (let y = 0; y < ukuran; y++)
    for (let x = 0; x < ukuran; x++) {
      // jarak bertanda ke segitiga sama kaki (puncak di atas)
      const px = Math.abs(x + 0.5 - ukuran / 2);
      const py = y + 0.5;
      const alas = ukuran - tepi;
      const miring = (py - tepi) * (ukuran / 2 - tepi) / (alas - tepi) - px;
      const d = Math.min(miring * 0.87, alas - py);
      const alfa = Math.max(0, Math.min(1, 0.75 + d / 6));
      const i = (y * ukuran + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(alfa * 255);
    }
  return { width: ukuran, height: ukuran, data };
}

function geojson(m: MapLibre, id: string, opsi: Record<string, unknown> = {}) {
  m.addSource(id, { type: "geojson", data: KOSONG, ...opsi });
}

export interface KanvasMedan {
  darat: HTMLCanvasElement;
  atas: HTMLCanvasElement;
  tsunami: HTMLCanvasElement;
}

const SUDUT_AWAL: [[number, number], [number, number], [number, number], [number, number]] = [
  [94, 8],
  [142, 8],
  [142, -12],
  [94, -12],
];

export function pasangSemuaLapisan(m: MapLibre, style: StyleSpecification, kanvas: KanvasMedan): void {
  const bawahAir = idLayerAir(style);
  const bawahLabel = idLayerLabelPertama(style);
  if (!m.hasImage("segitiga")) m.addImage("segitiga", gambarSegitiga(), { sdf: true });

  // --- raster: citra harian, peta bahaya InaRISK, medan (kanvas) ---
  m.addSource("citra", { type: "raster", tiles: [urlCitra("2019-09-15")], tileSize: 256, maxzoom: 9, attribution: "NASA GIBS" });
  m.addLayer({ id: "citra-raster", type: "raster", source: "citra", paint: { "raster-opacity": 0.92, "raster-fade-duration": 150 } }, bawahLabel);

  m.addSource("inarisk", { type: "raster", tiles: [urlInarisk("gempa")], tileSize: 256, minzoom: 3, maxzoom: 12, attribution: "InaRISK BNPB" });
  m.addLayer({ id: "inarisk-raster", type: "raster", source: "inarisk", paint: { "raster-opacity": 0.55, "raster-saturation": -0.15 } }, bawahAir);

  m.addSource("medan-darat", { type: "canvas", canvas: kanvas.darat, coordinates: SUDUT_AWAL, animate: false });
  m.addLayer({ id: "medan-darat", type: "raster", source: "medan-darat", paint: { "raster-opacity": 0.85, "raster-fade-duration": 0, "raster-resampling": "linear" } }, bawahAir);

  m.addSource("medan-atas", { type: "canvas", canvas: kanvas.atas, coordinates: SUDUT_AWAL, animate: false });
  m.addLayer({ id: "medan-atas", type: "raster", source: "medan-atas", paint: { "raster-opacity": 0.8, "raster-fade-duration": 0, "raster-resampling": "linear" } }, bawahLabel);

  m.addSource("tsunami", { type: "canvas", canvas: kanvas.tsunami, coordinates: SUDUT_AWAL, animate: false });
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
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, ["interpolate", ["linear"], ["get", "mag"], 6, 1, 7.5, 2.4, 9, 7], 8, ["interpolate", ["linear"], ["get", "mag"], 6, 3.5, 9, 22]],
      "circle-color": "#f43f5e",
      "circle-opacity": ["interpolate", ["linear"], ["get", "mag"], 6, 0.22, 7.5, 0.5, 9, 0.75],
      "circle-stroke-color": "#fecdd3",
      "circle-stroke-width": ["case", [">=", ["get", "mag"], 7.5], 0.8, 0],
    },
  });
  m.addSource("sesar", { type: "geojson", data: "/data/sesar.geojson" });
  m.addLayer({ id: "sesar-garis", type: "line", source: "sesar", filter: ["==", ["get", "jenis"], "sesar"], paint: { "line-color": "#fb7185", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.7, 8, 2], "line-opacity": 0.85 } });
  m.addLayer({
    id: "megathrust-garis",
    type: "line",
    source: "sesar",
    filter: ["==", ["get", "jenis"], "megathrust"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#f43f5e", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 2.2, 8, 5], "line-blur": 1, "line-opacity": 0.95 },
  });

  // --- rumah sakit ---
  geojson(m, "rs");
  m.addLayer({
    id: "rs-titik",
    type: "circle",
    source: "rs",
    minzoom: 4.5,
    paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 4.5, 1.6, 9, 4.5, 13, 7], "circle-color": "#34d399", "circle-opacity": 0.85, "circle-stroke-color": "#05080f", "circle-stroke-width": 0.8 },
  });
  m.addLayer({
    id: "rs-label",
    type: "symbol",
    source: "rs",
    minzoom: 10,
    layout: { "text-field": ["get", "nama"], "text-font": FONT, "text-size": 10, "text-offset": [0, 0.9], "text-anchor": "top", "text-optional": true },
    paint: { "text-color": "#a7f3d0", "text-halo-color": "#05080f", "text-halo-width": 1.2 },
  });

  // --- asap: lintasan maju dari gugus titik panas ---
  geojson(m, "asap");
  m.addLayer({
    id: "asap-garis",
    type: "line",
    source: "asap",
    filter: ["==", ["geometry-type"], "LineString"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#d6d3d1", "line-width": ["interpolate", ["linear"], ["get", "frp"], 0, 1.5, 2000, 7], "line-opacity": 0.55, "line-blur": 2 },
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

  // --- debit sungai ---
  geojson(m, "sungai");
  m.addLayer({
    id: "sungai-titik",
    type: "circle",
    source: "sungai",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["get", "tingkat"], 0, 5, 3, 10],
      "circle-color": ["match", ["get", "tingkat"], 0, "#2dd4bf", 1, "#fde047", 2, "#fb923c", 3, "#ef4444", "#2dd4bf"],
      "circle-opacity": 0.9,
      "circle-stroke-color": "#05080f",
      "circle-stroke-width": 1.5,
    },
  });
  m.addLayer({
    id: "sungai-label",
    type: "symbol",
    source: "sungai",
    layout: { "text-field": ["get", "nama"], "text-font": FONT, "text-size": 10.5, "text-offset": [0, 1], "text-anchor": "top", "text-optional": true },
    paint: { "text-color": "#99f6e4", "text-halo-color": "#05080f", "text-halo-width": 1.3 },
  });

  // --- laporan warga ---
  geojson(m, "laporan");
  m.addLayer({
    id: "laporan-titik",
    type: "circle",
    source: "laporan",
    paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 3, 9, 6.5], "circle-color": ["get", "warna"], "circle-opacity": 0.9, "circle-stroke-color": "#e5e7eb", "circle-stroke-width": 1 },
  });

  // --- kejadian BNPB ---
  geojson(m, "bencana");
  m.addLayer({
    id: "bencana-titik",
    type: "circle",
    source: "bencana",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 4.5, 8, 9],
      "circle-color": ["get", "warna"],
      "circle-opacity": 0.3,
      "circle-stroke-color": ["get", "warna"],
      "circle-stroke-width": 2,
    },
  });
  m.addLayer({
    id: "bencana-label",
    type: "symbol",
    source: "bencana",
    minzoom: 5.5,
    layout: { "text-field": ["get", "label"], "text-font": FONT, "text-size": 10, "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true },
    paint: { "text-color": "#e9d5ff", "text-halo-color": "#05080f", "text-halo-width": 1.3 },
  });

  // --- gunung api ---
  geojson(m, "gunung");
  m.addLayer({
    id: "gunung-ikon",
    type: "symbol",
    source: "gunung",
    layout: {
      "icon-image": "segitiga",
      "icon-size": ["interpolate", ["linear"], ["zoom"], 3, ["match", ["get", "level"], 4, 0.42, 3, 0.36, 2, 0.26, 0.17], 8, ["match", ["get", "level"], 4, 0.7, 3, 0.62, 2, 0.5, 0.36]],
      "icon-allow-overlap": true,
      "symbol-sort-key": ["get", "level"],
      "text-field": ["step", ["zoom"], ["case", [">=", ["get", "level"], 3], ["get", "nama"], ""], 5.5, ["case", [">=", ["get", "level"], 2], ["get", "nama"], ""], 7, ["get", "nama"]],
      "text-font": FONT,
      "text-size": 10.5,
      "text-offset": [0, 0.9],
      "text-anchor": "top",
      "text-optional": true,
    },
    paint: {
      "icon-color": ["match", ["get", "level"], 1, WARNA_LEVEL_GUNUNG[1], 2, WARNA_LEVEL_GUNUNG[2], 3, WARNA_LEVEL_GUNUNG[3], 4, WARNA_LEVEL_GUNUNG[4], WARNA_LEVEL_GUNUNG[0]],
      "icon-halo-color": "#05080f",
      "icon-halo-width": 1.5,
      "text-color": "#fecaca",
      "text-halo-color": "#05080f",
      "text-halo-width": 1.3,
    },
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

  // --- alat: skenario guncangan, rute evakuasi, waktu tiba tsunami, sorotan pilihan ---
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
  m.addLayer({ id: "rute-bayang", type: "line", source: "rute", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#05080f", "line-width": 7, "line-opacity": 0.8 } });
  m.addLayer({ id: "rute-garis", type: "line", source: "rute", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#34d399", "line-width": 3.5 } });
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
  geojson(m, "pilih");
  m.addLayer({ id: "pilih-cincin", type: "circle", source: "pilih", paint: { "circle-radius": 15, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2, "circle-stroke-opacity": 0.95 } });
}

export function setData(m: MapLibre, id: string, fitur: Fitur[]): void {
  (m.getSource(id) as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: fitur });
}

export function setTerlihat(m: MapLibre, idLayer: string, on: boolean): void {
  if (m.getLayer(idLayer)) m.setLayoutProperty(idLayer, "visibility", on ? "visible" : "none");
}

/** Samakan visibilitas semua layer dengan himpunan lapisan aktif. Layer bersama (medan) nyala kalau salah satu pemakainya aktif. */
export function sinkronVisibilitas(m: MapLibre, aktif: Set<IdLapisan>): void {
  const nyala = new Map<string, boolean>();
  for (const [id, daftar] of Object.entries(LAYER_LAPISAN) as [IdLapisan, string[]][]) {
    for (const l of daftar) nyala.set(l, (nyala.get(l) ?? false) || aktif.has(id));
  }
  for (const [l, on] of nyala) setTerlihat(m, l, on);
}

export function titik(lon: number, lat: number, props: Record<string, unknown>): Fitur {
  return { type: "Feature", properties: props, geometry: { type: "Point", coordinates: [lon, lat] } };
}

export { WARNA_JENIS_BENCANA };
