/** Fungsi geometri kecil (tanpa pustaka): jarak, lingkaran geodesik, titik-dalam-poligon. */

export const R_BUMI_KM = 6371.0088;
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export function jarakKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R_BUMI_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Arah (derajat dari utara, searah jarum jam) dari titik 1 ke titik 2. */
export function arahDerajat(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const la1 = lat1 * RAD;
  const la2 = lat2 * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const y = Math.sin(dLon) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
  return (Math.atan2(y, x) * DEG + 360) % 360;
}

const MATA_ANGIN_ID = ["utara", "timur laut", "timur", "tenggara", "selatan", "barat daya", "barat", "barat laut"];
const MATA_ANGIN_EN = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];

export function mataAngin(derajat: number, lang: "id" | "en" = "id"): string {
  const i = Math.round((((derajat % 360) + 360) % 360) / 45) % 8;
  return (lang === "id" ? MATA_ANGIN_ID : MATA_ANGIN_EN)[i];
}

/** Titik tujuan dari (lon, lat) dengan arah `bearingDeg` sejauh `jarak` km. */
export function titikTujuan(lon: number, lat: number, bearingDeg: number, jarak: number): [number, number] {
  const d = jarak / R_BUMI_KM;
  const b = bearingDeg * RAD;
  const la1 = lat * RAD;
  const lo1 = lon * RAD;
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b));
  const lo2 = lo1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  let lonOut = lo2 * DEG;
  if (lonOut > 180) lonOut -= 360;
  if (lonOut < -180) lonOut += 360;
  return [lonOut, la2 * DEG];
}

/** Poligon lingkaran geodesik (ring GeoJSON) berjari-jari `radiusKm`. */
export function lingkaran(lon: number, lat: number, radiusKm: number, n = 72): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i <= n; i++) ring.push(titikTujuan(lon, lat, (360 * i) / n, radiusKm));
  return ring;
}

export function formatKoordinat(lon: number, lat: number): string {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return "-";
  const ns = lat >= 0 ? "LU" : "LS";
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lon).toFixed(2)}° BT`;
}

type Ring = number[][];

function dalamRing(lon: number, lat: number, ring: Ring): boolean {
  let dalam = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dalam = !dalam;
  }
  return dalam;
}

export interface PoligonBerkotak {
  nama: string;
  kotak: [number, number, number, number];
  poligon: Ring[][];
}

/** Siapkan poligon (Polygon/MultiPolygon GeoJSON) dengan kotak pembatas supaya uji titik cepat. */
export function siapkanPoligon(nama: string, geometri: { type: string; coordinates: unknown }): PoligonBerkotak {
  const poligon = (geometri.type === "Polygon" ? [geometri.coordinates] : geometri.coordinates) as Ring[][];
  let x0 = 180;
  let y0 = 90;
  let x1 = -180;
  let y1 = -90;
  for (const p of poligon)
    for (const [x, y] of p[0]) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  return { nama, kotak: [x0, y0, x1, y1], poligon };
}

export function titikDalamPoligon(lon: number, lat: number, p: PoligonBerkotak): boolean {
  if (lon < p.kotak[0] || lon > p.kotak[2] || lat < p.kotak[1] || lat > p.kotak[3]) return false;
  for (const pol of p.poligon) {
    if (!dalamRing(lon, lat, pol[0])) continue;
    let lubang = false;
    for (let i = 1; i < pol.length; i++) if (dalamRing(lon, lat, pol[i])) lubang = true;
    if (!lubang) return true;
  }
  return false;
}

/** Indeks poligon pertama yang memuat titik, atau -1 (laut / luar negeri). */
export function cariPoligon(lon: number, lat: number, daftar: PoligonBerkotak[]): number {
  for (let i = 0; i < daftar.length; i++) if (titikDalamPoligon(lon, lat, daftar[i])) return i;
  return -1;
}

const GESER = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
];

/**
 * Seperti cariPoligon, tapi titik yang jatuh sedikit di luar garis pantai (batas provinsi disederhanakan)
 * masih dicocokkan ke provinsi terdekat dalam `toleransiDerajat`.
 */
export function cariPoligonDekat(lon: number, lat: number, daftar: PoligonBerkotak[], toleransiDerajat = 0.08): number {
  const tepat = cariPoligon(lon, lat, daftar);
  if (tepat >= 0 || toleransiDerajat <= 0) return tepat;
  for (const [dx, dy] of GESER) {
    const i = cariPoligon(lon + dx * toleransiDerajat, lat + dy * toleransiDerajat, daftar);
    if (i >= 0) return i;
  }
  return -1;
}
