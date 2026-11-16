/**
 * Ikon peta, digambar sendiri di kanvas saat peta dimuat (tanpa berkas sprite): lencana berbentuk
 * dengan glif di tengahnya. Dibuat pada 2x supaya tajam di layar retina.
 */

import type { Map as MapLibre } from "maplibre-gl";
import { WARNA_JENIS_BENCANA, WARNA_LEVEL_GUNUNG } from "./warna";

const PX = 2; // rasio piksel ikon
const GELAP = "#070b14";

/** Glif 24x24 sebagai path SVG (digambar dengan garis, ujung membulat). */
export const GLIF: Record<string, string[]> = {
  banjir: ["M12 3.2 6.9 10.4a6.3 6.3 0 1 0 10.2 0z", "M9.2 14.6a3 3 0 0 0 2.8 2.6"],
  longsor: ["m3 19 6-11 3.5 5 2.5-3.5L21 19z", "M14.5 5.5h.01", "M18 8h.01", "M17 4h.01"],
  cuaca: ["M21 5H3", "M18 9H6", "M19 13H9", "M16 17h-6", "M11 21H9"],
  karhutla: ["M12 3c.6 3.2 4.6 5.2 4.6 9.6a4.6 4.6 0 0 1-9.2 0c0-1.9.9-3.2 1.9-4.3.2 1.6.9 2.6 1.9 3 .2-3-.6-5.4.8-8.3z"],
  gempa: ["M2 12h4l2.5-7 4 14 3-9 1.5 2H22"],
  kekeringan: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M12 2v2", "M12 20v2", "m4.9 4.9 1.4 1.4", "m17.7 17.7 1.4 1.4", "M2 12h2", "M20 12h2", "m6.3 17.7-1.4 1.4", "m19.1 4.9-1.4 1.4"],
  erupsi: ["M3 20 9.5 9h5L21 20z", "M12 6V3", "M9 6.2 7.8 4", "m15 6.2 1.2-2.2"],
  gelombang: ["M2 8c1.6-1.6 3.4-1.6 5 0s3.4 1.6 5 0 3.4-1.6 5 0 3.4 1.6 5 0", "M2 13c1.6-1.6 3.4-1.6 5 0s3.4 1.6 5 0 3.4-1.6 5 0 3.4 1.6 5 0", "M2 18c1.6-1.6 3.4-1.6 5 0s3.4 1.6 5 0 3.4-1.6 5 0 3.4 1.6 5 0"],
  lain: ["M12 4 21 19.5H3z", "M12 10v4.5", "M12 17.2h.01"],
  palang: ["M12 5v14", "M5 12h14"],
};

function kanvas(ukuran: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const k = document.createElement("canvas");
  k.width = k.height = ukuran * PX;
  const c = k.getContext("2d")!;
  c.scale(PX, PX);
  c.lineCap = "round";
  c.lineJoin = "round";
  return [k, c];
}

function glif(c: CanvasRenderingContext2D, nama: string, pusat: number, ukuran: number, warna: string, tebal = 2) {
  c.save();
  c.translate(pusat - ukuran / 2, pusat - ukuran / 2);
  c.scale(ukuran / 24, ukuran / 24);
  c.strokeStyle = warna;
  c.lineWidth = tebal;
  for (const d of GLIF[nama] ?? GLIF.lain) c.stroke(new Path2D(d));
  c.restore();
}

function kotakBulat(c: CanvasRenderingContext2D, x: number, y: number, s: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + s, y, x + s, y + s, r);
  c.arcTo(x + s, y + s, x, y + s, r);
  c.arcTo(x, y + s, x, y, r);
  c.arcTo(x, y, x + s, y, r);
  c.closePath();
}

function simpan(m: MapLibre, nama: string, k: HTMLCanvasElement) {
  if (m.hasImage(nama)) return;
  const data = k.getContext("2d")!.getImageData(0, 0, k.width, k.height);
  m.addImage(nama, { width: k.width, height: k.height, data: new Uint8Array(data.data.buffer) }, { pixelRatio: PX });
}

/** Rumah sakit: palang putih di kotak hijau membulat. */
function ikonRs(): HTMLCanvasElement {
  const [k, c] = kanvas(26);
  c.shadowColor = "rgba(0,0,0,0.6)";
  c.shadowBlur = 3;
  kotakBulat(c, 3, 3, 20, 5);
  c.fillStyle = "#10b981";
  c.fill();
  c.shadowBlur = 0;
  c.strokeStyle = "#ecfdf5";
  c.lineWidth = 1.2;
  c.stroke();
  glif(c, "palang", 13, 15, "#ffffff", 4.2);
  return k;
}

/** Kejadian BNPB: belah ketupat gelap bertepi warna jenis bencananya. */
function ikonBencana(kunci: string, warna: string): HTMLCanvasElement {
  const [k, c] = kanvas(34);
  c.shadowColor = warna;
  c.shadowBlur = 5;
  c.save();
  c.translate(17, 17);
  c.rotate(Math.PI / 4);
  kotakBulat(c, -10.5, -10.5, 21, 4);
  c.restore();
  c.fillStyle = GELAP;
  c.fill();
  c.shadowBlur = 0;
  c.strokeStyle = warna;
  c.lineWidth = 1.8;
  c.stroke();
  glif(c, kunci, 17, 14.5, warna, 2.1);
  return k;
}

/** Laporan warga: lingkaran berisi warna jenisnya, glif gelap. */
function ikonLaporan(kunci: string, warna: string): HTMLCanvasElement {
  const [k, c] = kanvas(24);
  c.shadowColor = "rgba(0,0,0,0.6)";
  c.shadowBlur = 3;
  c.beginPath();
  c.arc(12, 12, 9, 0, 6.2832);
  c.fillStyle = warna;
  c.fill();
  c.shadowBlur = 0;
  c.strokeStyle = "rgba(255,255,255,0.85)";
  c.lineWidth = 1.1;
  c.stroke();
  glif(c, kunci, 12, 11.5, GELAP, 2.3);
  return k;
}

const WARNA_SUNGAI = ["#2dd4bf", "#fde047", "#fb923c", "#ef4444"];

/** Titik sungai: kotak membulat berisi gelombang, warnanya mengikuti status debit. */
function ikonSungai(tingkat: number): HTMLCanvasElement {
  const [k, c] = kanvas(28);
  const warna = WARNA_SUNGAI[tingkat];
  c.shadowColor = tingkat > 0 ? warna : "rgba(0,0,0,0.6)";
  c.shadowBlur = tingkat > 0 ? 6 : 3;
  kotakBulat(c, 4, 4, 20, 6);
  c.fillStyle = GELAP;
  c.fill();
  c.shadowBlur = 0;
  c.strokeStyle = warna;
  c.lineWidth = 1.7;
  c.stroke();
  glif(c, "gelombang", 14, 14, warna, 2.2);
  return k;
}

/** Gunung api: siluet kerucut dengan kawah; Siaga dan Awas diberi kepulan dan pendar. */
function ikonGunung(level: number): HTMLCanvasElement {
  const [k, c] = kanvas(34);
  const warna = WARNA_LEVEL_GUNUNG[level];
  if (level >= 3) {
    c.shadowColor = warna;
    c.shadowBlur = 8;
  } else {
    c.shadowColor = "rgba(0,0,0,0.7)";
    c.shadowBlur = 3;
  }
  c.beginPath();
  c.moveTo(4, 28);
  c.lineTo(13.2, 12.5);
  c.lineTo(15.4, 15);
  c.lineTo(17, 13.2);
  c.lineTo(18.6, 15);
  c.lineTo(20.8, 12.5);
  c.lineTo(30, 28);
  c.closePath();
  c.fillStyle = warna;
  c.fill();
  c.shadowBlur = 0;
  c.strokeStyle = GELAP;
  c.lineWidth = 1.4;
  c.stroke();
  if (level >= 3) {
    // kepulan erupsi
    c.strokeStyle = warna;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(17, 10);
    c.lineTo(17, 4.5);
    c.moveTo(13.5, 9.5);
    c.lineTo(11.5, 6);
    c.moveTo(20.5, 9.5);
    c.lineTo(22.5, 6);
    c.stroke();
  }
  return k;
}

/** Gigi megathrust: segitiga kecil yang menunjuk ke lempeng yang menumpang. */
function ikonGigi(warna: string): HTMLCanvasElement {
  const [k, c] = kanvas(16);
  c.beginPath();
  c.moveTo(2.5, 12);
  c.lineTo(8, 3);
  c.lineTo(13.5, 12);
  c.closePath();
  c.fillStyle = warna;
  c.fill();
  return k;
}

export const KUNCI_BENCANA = Object.keys(WARNA_JENIS_BENCANA);

/** Daftarkan semua ikon ke peta. Nama: rs, bencana-<kunci>, laporan-<kunci>, sungai-<0..3>, gunung-<0..4>, gigi. */
export function pasangIkon(m: MapLibre): void {
  simpan(m, "rs", ikonRs());
  for (const kunci of KUNCI_BENCANA) {
    simpan(m, `bencana-${kunci}`, ikonBencana(kunci, WARNA_JENIS_BENCANA[kunci]));
    simpan(m, `laporan-${kunci}`, ikonLaporan(kunci, WARNA_JENIS_BENCANA[kunci]));
  }
  for (let t = 0; t < 4; t++) simpan(m, `sungai-${t}`, ikonSungai(t));
  for (let l = 0; l < 5; l++) simpan(m, `gunung-${l}`, ikonGunung(l));
  simpan(m, "gigi", ikonGigi("#fb7185"));
}
