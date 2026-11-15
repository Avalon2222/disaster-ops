/**
 * Kanvas 2D di atas peta untuk dua hal yang bergerak tiap frame:
 * - partikel angin (ala earth.nullschool): ribuan titik dihanyutkan medan angin 10 m, meninggalkan jejak
 * - partikel asap: dilepas dari gugus titik panas, dihanyutkan angin 850 hPa mengikuti prakiraan
 *
 * Partikel hidup di koordinat lon/lat dan diproyeksikan ke layar tiap frame (termasuk di globe).
 */

import type { Map as MapLibre } from "maplibre-gl";
import type { DefGrid } from "../jenis";
import { anginDi, type GugusApi, type MedanAngin } from "../model/asap";
import { sampel } from "../model/grid";
import { buatProyektor, proyeksi, titikKosong } from "./proyeksi";

interface Partikel {
  lon: number;
  lat: number;
  lonLama: number;
  latLama: number;
  umur: number;
  maks: number;
}

/** warna jejak per kelas kecepatan: < 3, 3-6, 6-10, > 10 m/s */
const WARNA_LAJU = ["rgba(125,211,252,0.35)", "rgba(186,230,253,0.55)", "rgba(255,255,255,0.75)", "rgba(255,200,87,0.9)"];

interface PartikelAsap extends Partikel {
  sumber: number;
}

/** lebar pita pudar di tepi grid angin (derajat) */
const TEPI_PUDAR = 4;
/** menit simulasi per frame untuk asap: 48 jam ditempuh dalam ~10 detik */
const MENIT_PER_FRAME = 5;
const UMUR_ASAP = (48 * 60) / MENIT_PER_FRAME;

export class KanvasAngin {
  private kanvas: HTMLCanvasElement;
  private kanvasAsap: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ctxAsap: CanvasRenderingContext2D;
  private partikel: Partikel[] = [];
  private asap: PartikelAsap[] = [];
  private raf = 0;
  private bergerak = false;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private pengamat: ResizeObserver;

  /** medan angin 10 m pada waktu lini masa (m/s x10) */
  grid: DefGrid | null = null;
  u: ArrayLike<number> | null = null;
  v: ArrayLike<number> | null = null;
  anginAktif = false;

  /** sumber asap + medan 850 hPa sepanjang waktu */
  medanAsap: MedanAngin | null = null;
  gugus: GugusApi[] = [];
  waktuAsap = 0;
  asapAktif = false;
  /** animasi dihentikan sementara (alat lain sedang tampil, tab tersembunyi) */
  jeda = false;

  constructor(
    private map: MapLibre,
    wadah: HTMLElement,
    private hemat = false,
  ) {
    const buat = () => {
      const k = document.createElement("canvas");
      k.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;";
      k.setAttribute("aria-hidden", "true");
      wadah.appendChild(k);
      return k;
    };
    this.kanvas = buat();
    this.kanvasAsap = buat();
    this.ctx = this.kanvas.getContext("2d")!;
    this.ctxAsap = this.kanvasAsap.getContext("2d")!;
    this.ukur();
    this.pengamat = new ResizeObserver(() => this.ukur());
    this.pengamat.observe(wadah);
    map.on("movestart", this.mulaiGerak);
    map.on("moveend", this.selesaiGerak);
    this.raf = requestAnimationFrame(this.frame);
  }

  private mulaiGerak = () => {
    this.bergerak = true;
    this.bersihkan();
  };

  private selesaiGerak = () => {
    this.bergerak = false;
    this.bersihkan();
    // sebar ulang supaya kerapatan mengikuti tampilan baru
    for (const p of this.partikel) this.lahir(p);
  };

  private ukur() {
    const wadah = this.kanvas.parentElement;
    if (!wadah) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = wadah.clientWidth;
    this.h = wadah.clientHeight;
    for (const k of [this.kanvas, this.kanvasAsap]) {
      k.width = Math.round(this.w * this.dpr);
      k.height = Math.round(this.h * this.dpr);
    }
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctxAsap.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const target = Math.min(this.hemat ? 1400 : 3800, Math.round((this.w * this.h) / (this.hemat ? 520 : 330)));
    while (this.partikel.length < target) this.partikel.push(this.lahir({ lon: 0, lat: 0, lonLama: 0, latLama: 0, umur: 0, maks: 0 }));
    this.partikel.length = target;
  }

  bersihkan() {
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.ctxAsap.clearRect(0, 0, this.w, this.h);
  }

  /** Kotak tempat partikel dilahirkan: irisan tampilan peta dengan grid angin. */
  private kotakLahir(): [number, number, number, number] | null {
    const g = this.grid;
    if (!g) return null;
    const b = this.map.getBounds();
    const x0 = Math.max(g.lon0, b.getWest());
    const x1 = Math.min(g.lon0 + (g.nx - 1) * g.dx, b.getEast());
    const y0 = Math.max(g.lat0, b.getSouth());
    const y1 = Math.min(g.lat0 + (g.ny - 1) * g.dy, b.getNorth());
    if (x1 <= x0 || y1 <= y0) return null;
    return [x0, y0, x1, y1];
  }

  private lahir(p: Partikel): Partikel {
    const k = this.kotakLahir();
    if (k) {
      p.lon = k[0] + Math.random() * (k[2] - k[0]);
      p.lat = k[1] + Math.random() * (k[3] - k[1]);
    }
    p.umur = 0;
    p.maks = 40 + Math.random() * 70;
    return p;
  }

  setGugus(gugus: GugusApi[]) {
    this.gugus = gugus.slice(0, 60);
    this.asap = [];
    const total = this.gugus.reduce((s, g) => s + Math.sqrt(g.frp + 5), 0) || 1;
    const jumlah = this.hemat ? 500 : 1400;
    this.gugus.forEach((g, i) => {
      const n = Math.max(3, Math.round((jumlah * Math.sqrt(g.frp + 5)) / total));
      for (let k = 0; k < n; k++) this.asap.push({ lon: g.lon, lat: g.lat, lonLama: g.lon, latLama: g.lat, umur: Math.random() * UMUR_ASAP, maks: UMUR_ASAP, sumber: i });
    });
    this.ctxAsap.clearRect(0, 0, this.w, this.h);
  }

  private frame = () => {
    this.raf = requestAnimationFrame(this.frame);
    if (this.jeda || this.bergerak || document.hidden) return;
    const adaAngin = this.anginAktif && this.grid && this.u && this.v;
    const adaAsap = this.asapAktif && this.medanAsap && this.asap.length > 0;
    if (!adaAngin && !adaAsap) return;
    const pr = buatProyektor(this.map, this.w, this.h);
    if (adaAngin) this.gambarAngin(pr);
    if (adaAsap) this.gambarAsap(pr);
  };

  private a = titikKosong();
  private b = titikKosong();

  private gambarAngin(pr: ReturnType<typeof buatProyektor>) {
    const ctx = this.ctx;
    const g = this.grid!;
    // jejak lama memudar
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = "rgba(0,0,0,0.925)";
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = 1.1;
    ctx.lineCap = "round";

    // kecepatan layar tidak bergantung zoom: 10 m/s ~ 1,3 piksel per frame
    const pikselPerDerajat = (512 * 2 ** this.map.getZoom()) / 360;
    const k = 0.13 / pikselPerDerajat;
    const ember: Partikel[][] = [[], [], [], []];
    const lonMaks = g.lon0 + (g.nx - 1) * g.dx;
    const latMaks = g.lat0 + (g.ny - 1) * g.dy;
    for (const p of this.partikel) {
      const u = sampel(g, this.u!, p.lon, p.lat) / 10;
      const v = sampel(g, this.v!, p.lon, p.lat) / 10;
      if (p.umur++ > p.maks || Number.isNaN(u) || Number.isNaN(v)) {
        this.lahir(p);
        continue;
      }
      p.lonLama = p.lon;
      p.latLama = p.lat;
      p.lon += (u * k) / Math.max(0.2, Math.cos((p.lat * Math.PI) / 180));
      p.lat += v * k;
      // menjelang tepi grid partikel makin jarang digambar, supaya medan angin tidak terpotong tajam
      const tepi = Math.min(p.lon - g.lon0, lonMaks - p.lon, p.lat - g.lat0, latMaks - p.lat) / TEPI_PUDAR;
      if (tepi < 1 && (p.umur * 0.37 + p.maks) % 1 > tepi) continue;
      const laju = Math.hypot(u, v);
      ember[laju < 3 ? 0 : laju < 6 ? 1 : laju < 10 ? 2 : 3].push(p);
    }
    // satu path per kelas kecepatan: jauh lebih murah daripada stroke per partikel
    for (let e = 0; e < ember.length; e++) {
      if (ember[e].length === 0) continue;
      ctx.strokeStyle = WARNA_LAJU[e];
      ctx.beginPath();
      for (const p of ember[e]) {
        if (!proyeksi(pr, p.lonLama, p.latLama, 0, this.a) || !this.a.terlihat) continue;
        if (!proyeksi(pr, p.lon, p.lat, 0, this.b) || !this.b.terlihat) continue;
        if (Math.abs(this.b.x - this.a.x) > 40 || Math.abs(this.b.y - this.a.y) > 40) continue;
        ctx.moveTo(this.a.x, this.a.y);
        ctx.lineTo(this.b.x, this.b.y);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  private gambarAsap(pr: ReturnType<typeof buatProyektor>) {
    const ctx = this.ctxAsap;
    const m = this.medanAsap!;
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.globalCompositeOperation = "source-over";
    const dt = MENIT_PER_FRAME * 60;
    for (const p of this.asap) {
      const sumber = this.gugus[p.sumber];
      if (!sumber) continue;
      if (p.umur++ > p.maks) {
        p.lon = sumber.lon + (Math.random() - 0.5) * 0.25;
        p.lat = sumber.lat + (Math.random() - 0.5) * 0.25;
        p.umur = 0;
        continue;
      }
      const [u, v] = anginDi(m, p.lon, p.lat, this.waktuAsap + p.umur * dt * 1000);
      if (Number.isNaN(u) || Number.isNaN(v)) {
        p.umur = p.maks + 1;
        continue;
      }
      // sedikit acak supaya kepulan melebar seiring waktu (difusi)
      p.lon += (u * dt) / (111_195 * Math.max(0.2, Math.cos((p.lat * Math.PI) / 180))) + (Math.random() - 0.5) * 0.012;
      p.lat += (v * dt) / 111_195 + (Math.random() - 0.5) * 0.012;
      if (!proyeksi(pr, p.lon, p.lat, 0, this.a) || !this.a.terlihat) continue;
      const f = p.umur / p.maks;
      ctx.fillStyle = `rgba(214,211,209,${(0.3 * (1 - f) + 0.04).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(this.a.x, this.a.y, 1.6 + f * 4.5, 0, 6.2832);
      ctx.fill();
    }
  }

  hancurkan() {
    cancelAnimationFrame(this.raf);
    this.pengamat.disconnect();
    this.map.off("movestart", this.mulaiGerak);
    this.map.off("moveend", this.selesaiGerak);
    this.kanvas.remove();
    this.kanvasAsap.remove();
  }
}
