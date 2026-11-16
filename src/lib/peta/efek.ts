/**
 * Kanvas 2D di atas peta untuk semua yang bergerak tiap frame:
 * - partikel angin (ala earth.nullschool) dengan jejak
 * - rintik hujan yang jatuh di tempat prakiraan hujannya
 * - kabut PM2.5 yang hanyut bersama angin
 * - kepulan asap dari gugus titik panas, mengikuti angin 850 hPa
 * - riak gempa baru dan denyut objek terpilih
 *
 * Semua partikel hidup di koordinat lon/lat dan diproyeksikan ulang tiap frame, jadi tidak ada yang
 * "tertinggal" atau hilang waktu peta digeser, di-zoom, atau diputar. Kanvas dibersihkan tiap frame;
 * jejak angin disimpan sebagai riwayat posisi, bukan sebagai sisa gambar di kanvas.
 */

import type { Map as MapLibre } from "maplibre-gl";
import type { DefGrid } from "../jenis";
import { anginDi, type GugusApi, type MedanAngin } from "../model/asap";
import { sampel } from "../model/grid";
import { buatProyektor, proyeksi, titikKosong, type Proyektor } from "./proyeksi";

/** panjang jejak angin: jumlah posisi yang diingat, dicatat tiap SELANG_JEJAK_MS (kepala selalu posisi terkini) */
const JEJAK = 10;
const SELANG_JEJAK_MS = 48;
/** satu "langkah" = satu frame di layar 60 Hz; semua gerak dikali langkah supaya lajunya sama di 30, 60, maupun 120 Hz */
const MS_PER_LANGKAH = 1000 / 60;
/** warna jejak per kelas kecepatan: < 3, 3-6, 6-10, > 10 m/s */
const WARNA_LAJU = ["125,211,252", "186,230,253", "255,255,255", "255,200,87"];
const ALFA_LAJU = [0.42, 0.6, 0.8, 0.95];
/** menit simulasi per frame untuk asap: 48 jam ditempuh dalam ~10 detik */
const MENIT_PER_FRAME = 5;
const UMUR_ASAP = (48 * 60) / MENIT_PER_FRAME;

function halus(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Seberapa "di dalam" sebuah titik terhadap grid: 1 di tengah, turun mulus ke 0 di tepi, dengan sudut
 * membulat (superelips). Dipakai supaya medan angin dan hujan memudar seperti vinyet, bukan terpotong kotak.
 */
export function pudarTepi(g: DefGrid, lon: number, lat: number, mulai = 0.7): number {
  const hx = ((g.nx - 1) * g.dx) / 2;
  const hy = ((g.ny - 1) * g.dy) / 2;
  const x = Math.abs((lon - (g.lon0 + hx)) / hx);
  const y = Math.abs((lat - (g.lat0 + hy)) / hy);
  const r = Math.cbrt(x * x * x + y * y * y);
  return 1 - halus(mulai, 0.99, r);
}

interface Butir {
  lon: number;
  lat: number;
  umur: number;
  maks: number;
}

interface ButirAngin extends Butir {
  /** riwayat posisi: lon, lat berselang-seling; indeks 0 = paling lama */
  jejak: Float32Array;
  n: number;
  kelas: number;
}

interface Rintik extends Butir {
  kuat: number;
}

interface Kepul extends Butir {
  sumber: number;
}

export interface Riak {
  lon: number;
  lat: number;
  mag: number;
}

/** Kuas lembut (gradien radial) untuk asap dan kabut, digambar sekali lalu dicap berulang. */
function kuas(rgb: string, ukuran = 48): HTMLCanvasElement {
  const k = document.createElement("canvas");
  k.width = k.height = ukuran;
  const c = k.getContext("2d")!;
  const g = c.createRadialGradient(ukuran / 2, ukuran / 2, 0, ukuran / 2, ukuran / 2, ukuran / 2);
  g.addColorStop(0, `rgba(${rgb},0.9)`);
  g.addColorStop(0.45, `rgba(${rgb},0.35)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g;
  c.fillRect(0, 0, ukuran, ukuran);
  return k;
}

export class KanvasEfek {
  private kanvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private angin: ButirAngin[] = [];
  private rintik: Rintik[] = [];
  private kabut: Butir[] = [];
  private asap: Kepul[] = [];
  private raf = 0;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private kotor = false;
  private pengamat: ResizeObserver;
  private kuasAsap = kuas("214,211,209");
  private kuasKabut = kuas("196,160,110");
  private layarX = new Float32Array(0);
  private layarY = new Float32Array(0);
  private a = titikKosong();
  private b = titikKosong();

  /** grid medan atmosfer dan nilainya pada waktu lini masa */
  grid: DefGrid | null = null;
  /** angin 10 m, m/s x10 */
  u: ArrayLike<number> | null = null;
  v: ArrayLike<number> | null = null;
  /** hujan mm per langkah x10 */
  hujan: ArrayLike<number> | null = null;
  /** PM2.5 ug/m3 */
  pm25: ArrayLike<number> | null = null;
  anginAktif = false;
  hujanAktif = false;
  kabutAktif = false;

  /** sumber asap + medan 850 hPa sepanjang waktu */
  medanAsap: MedanAngin | null = null;
  gugus: GugusApi[] = [];
  waktuAsap = 0;
  asapAktif = false;

  /** gempa baru yang diberi riak, dan objek terpilih yang diberi denyut */
  riak: Riak[] = [];
  pilih: { lon: number; lat: number } | null = null;
  /** semua efek dihentikan sementara (alat lain sedang tampil) */
  jeda = false;

  constructor(
    private map: MapLibre,
    wadah: HTMLElement,
    private hemat = false,
  ) {
    this.kanvas = document.createElement("canvas");
    this.kanvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;";
    this.kanvas.setAttribute("aria-hidden", "true");
    this.kanvas.dataset.testid = "kanvas-efek";
    wadah.appendChild(this.kanvas);
    this.ctx = this.kanvas.getContext("2d")!;
    this.ukur();
    this.pengamat = new ResizeObserver(() => this.ukur());
    this.pengamat.observe(wadah);
    this.raf = requestAnimationFrame(this.frame);
  }

  private ukur() {
    const wadah = this.kanvas.parentElement;
    if (!wadah) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = wadah.clientWidth;
    this.h = wadah.clientHeight;
    this.kanvas.width = Math.round(this.w * this.dpr);
    this.kanvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const luas = this.w * this.h;
    this.atur(this.angin, Math.min(this.hemat ? 1000 : 2800, Math.round(luas / (this.hemat ? 520 : 400))), () => ({ lon: 0, lat: 0, umur: 0, maks: -1, jejak: new Float32Array(JEJAK * 2), n: 0, kelas: 0 }));
    this.atur(this.rintik, Math.min(this.hemat ? 380 : 900, Math.round(luas / (this.hemat ? 1300 : 1100))), () => ({ lon: 0, lat: 0, umur: 0, maks: -1, kuat: 0 }));
    this.atur(this.kabut, Math.min(this.hemat ? 220 : 520, Math.round(luas / 2300)), () => ({ lon: 0, lat: 0, umur: 0, maks: -1 }));
    const n = this.angin.length * JEJAK;
    if (this.layarX.length < n) {
      this.layarX = new Float32Array(n);
      this.layarY = new Float32Array(n);
    }
  }

  private atur<T>(daftar: T[], jumlah: number, buat: () => T) {
    while (daftar.length < jumlah) daftar.push(buat());
    daftar.length = jumlah;
  }

  /** Kotak tempat partikel dilahirkan: irisan tampilan peta dengan grid; seluruh grid kalau tampilannya tidak wajar (globe jauh). */
  private kotakLahir(): [number, number, number, number] | null {
    const g = this.grid;
    if (!g) return null;
    const gx1 = g.lon0 + (g.nx - 1) * g.dx;
    const gy1 = g.lat0 + (g.ny - 1) * g.dy;
    let x0 = g.lon0;
    let y0 = g.lat0;
    let x1 = gx1;
    let y1 = gy1;
    if (this.map.getZoom() >= 3.2) {
      const b = this.map.getBounds();
      const w = b.getWest();
      const e = b.getEast();
      const s = b.getSouth();
      const n = b.getNorth();
      if ([w, e, s, n].every(Number.isFinite) && e > w && n > s && e - w < 200) {
        // sedikit lebih lebar dari layar supaya jejak sudah "jadi" waktu masuk layar
        const mx = (e - w) * 0.08;
        const my = (n - s) * 0.08;
        x0 = Math.max(g.lon0, w - mx);
        x1 = Math.min(gx1, e + mx);
        y0 = Math.max(g.lat0, s - my);
        y1 = Math.min(gy1, n + my);
      }
    }
    if (x1 <= x0 || y1 <= y0) return null;
    return [x0, y0, x1, y1];
  }

  setGugus(gugus: GugusApi[]) {
    this.gugus = gugus.slice(0, 60);
    this.asap = [];
    const total = this.gugus.reduce((s, g) => s + Math.sqrt(g.frp + 5), 0) || 1;
    const jumlah = this.hemat ? 450 : 1200;
    this.gugus.forEach((g, i) => {
      const n = Math.max(3, Math.round((jumlah * Math.sqrt(g.frp + 5)) / total));
      for (let k = 0; k < n; k++) this.asap.push({ lon: g.lon, lat: g.lat, umur: Math.random() * UMUR_ASAP, maks: UMUR_ASAP, sumber: i });
    });
  }

  private kiniLalu = 0;
  /** langkah frame ini (1 = 16,7 ms), dibatasi supaya jeda panjang tidak melempar partikel jauh-jauh */
  private langkah = 1;
  private catat = false;
  private sejakCatat = 0;
  /** rata-rata selang antar frame (ms) dan porsi partikel yang digambar: turun sendiri kalau perangkatnya keteteran */
  private selangRata = MS_PER_LANGKAH;
  private mutu = 1;
  private frameSejakAtur = 0;

  private aturMutu(dt: number) {
    this.selangRata += (dt - this.selangRata) * 0.08;
    if (++this.frameSejakAtur < 40) return;
    this.frameSejakAtur = 0;
    if (this.selangRata > 40 && this.mutu > 0.2) this.mutu = Math.max(0.2, this.mutu * 0.7);
    else if (this.selangRata < 22 && this.mutu < 1) this.mutu = Math.min(1, this.mutu * 1.2);
  }

  private frame = (kini: number) => {
    this.raf = requestAnimationFrame(this.frame);
    if (document.hidden) return;
    const dt = this.kiniLalu ? kini - this.kiniLalu : MS_PER_LANGKAH;
    this.kiniLalu = kini;
    // jeda lebih dari sedetik = tab baru kembali atau peta baru selesai memuat: bukan ukuran kemampuan perangkat
    if (dt < 1000) this.aturMutu(dt);
    this.langkah = Math.min(3, Math.max(0.25, dt / MS_PER_LANGKAH));
    this.sejakCatat += dt;
    this.catat = this.sejakCatat >= SELANG_JEJAK_MS;
    if (this.catat) this.sejakCatat = 0;
    const g = this.grid;
    const adaAngin = !this.jeda && this.anginAktif && g && this.u && this.v;
    const adaHujan = !this.jeda && this.hujanAktif && g && this.hujan;
    const adaKabut = !this.jeda && this.kabutAktif && g && this.pm25 && this.u && this.v;
    const adaAsap = !this.jeda && this.asapAktif && this.medanAsap && this.asap.length > 0;
    const adaRiak = !this.jeda && this.riak.length > 0;
    const adaPilih = Boolean(this.pilih);
    if (!adaAngin && !adaHujan && !adaKabut && !adaAsap && !adaRiak && !adaPilih) {
      if (this.kotor) {
        this.ctx.clearRect(0, 0, this.w, this.h);
        this.kotor = false;
      }
      return;
    }
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    this.kotor = true;
    const pr = buatProyektor(this.map, this.w, this.h);
    const kotak = this.kotakLahir();
    if (adaKabut && kotak) this.gambarKabut(pr, kotak);
    if (adaAsap) this.gambarAsap(pr);
    if (adaAngin && kotak) this.gambarAngin(pr, kotak);
    if (adaHujan && kotak) this.gambarHujan(pr, kotak);
    if (adaRiak) this.gambarRiak(pr, kini);
    if (adaPilih) this.gambarPilih(pr, kini);
  };

  // ---------------------------------------------------------------- angin

  private lahirAngin(p: ButirAngin, kotak: [number, number, number, number]) {
    const g = this.grid!;
    // coba beberapa kali: makin dekat tepi grid makin kecil peluang lahir, jadi kerapatannya memudar mulus
    for (let coba = 0; coba < 4; coba++) {
      p.lon = kotak[0] + Math.random() * (kotak[2] - kotak[0]);
      p.lat = kotak[1] + Math.random() * (kotak[3] - kotak[1]);
      if (Math.random() < pudarTepi(g, p.lon, p.lat)) break;
    }
    p.umur = 0;
    p.maks = 70 + Math.random() * 90;
    p.n = 0;
  }

  private kotakAcuan: [number, number, number, number] | null = null;

  /**
   * Kalau tampilan melebar atau melompat (zoom keluar, terbang ke tempat lain), sebagian partikel langsung
   * disebar ke kotak baru. Tanpa ini mereka masih bergerombol di kotak lama sampai umurnya habis.
   */
  private sebarUlang(kotak: [number, number, number, number]) {
    const lama = this.kotakAcuan;
    const luas = (kotak[2] - kotak[0]) * (kotak[3] - kotak[1]);
    if (!lama) {
      this.kotakAcuan = kotak;
      return;
    }
    const iris = Math.max(0, Math.min(lama[2], kotak[2]) - Math.max(lama[0], kotak[0])) * Math.max(0, Math.min(lama[3], kotak[3]) - Math.max(lama[1], kotak[1]));
    const tetap = iris / luas;
    if (tetap < 0.8) {
      for (const p of this.angin) {
        const diLama = p.lon >= lama[0] && p.lon <= lama[2] && p.lat >= lama[1] && p.lat <= lama[3];
        if (!diLama || Math.random() > tetap) {
          this.lahirAngin(p, kotak);
          p.umur = Math.random() * p.maks * 0.7;
        }
      }
      this.kotakAcuan = kotak;
    } else if (luas < (lama[2] - lama[0]) * (lama[3] - lama[1]) * 0.9) this.kotakAcuan = kotak;
  }

  private gambarAngin(pr: Proyektor, kotak: [number, number, number, number]) {
    const ctx = this.ctx;
    const g = this.grid!;
    const langkah = this.langkah;
    const jumlah = Math.max(1, Math.round(this.angin.length * this.mutu));
    // kecepatan layar tidak bergantung zoom, dan dimampatkan supaya angin tenang pun kelihatan mengalir:
    // 1 m/s ~ 0,45 piksel per frame, 10 m/s ~ 1,5
    const pikselPerDerajat = (512 * 2 ** this.map.getZoom()) / 360;
    this.sebarUlang(kotak);
    const X = this.layarX;
    const Y = this.layarY;
    for (let i = 0; i < jumlah; i++) {
      const p = this.angin[i];
      const u = sampel(g, this.u!, p.lon, p.lat) / 10;
      const v = sampel(g, this.v!, p.lon, p.lat) / 10;
      const diLuar = p.lon < kotak[0] || p.lon > kotak[2] || p.lat < kotak[1] || p.lat > kotak[3];
      p.umur += langkah;
      // kira-kira tiap 9 langkah: partikel di dekat tepi grid berpeluang mati, supaya kerapatannya memudar ke tepi
      const ujiTepi = Math.random() < langkah / 9 && Math.random() > pudarTepi(g, p.lon, p.lat) + 0.15;
      if (p.maks < 0 || p.umur > p.maks || Number.isNaN(u) || diLuar || ujiTepi) {
        this.lahirAngin(p, kotak);
        // umur awal diacak supaya partikel tidak lahir dan mati serempak
        if (p.maks > 0 && p.umur === 0) p.umur = Math.random() * 20;
      } else {
        const laju = Math.hypot(u, v);
        const k = ((0.34 + 0.116 * laju) * langkah) / (Math.max(0.3, laju) * pikselPerDerajat);
        p.lon += (u * k) / Math.max(0.2, Math.cos((p.lat * Math.PI) / 180));
        p.lat += v * k;
        p.kelas = laju < 3 ? 0 : laju < 6 ? 1 : laju < 10 ? 2 : 3;
      }
      // riwayat posisi: entri terakhir = kepala (selalu posisi terkini); entri baru ditambah tiap SELANG_JEJAK_MS
      const j = p.jejak;
      if (p.n === 0 || this.catat) {
        if (p.n === JEJAK) {
          j.copyWithin(0, 2);
          p.n--;
        }
        p.n++;
      }
      j[(p.n - 1) * 2] = p.lon;
      j[(p.n - 1) * 2 + 1] = p.lat;
      // proyeksikan seluruh riwayat untuk frame ini
      const dasar = i * JEJAK;
      for (let s = 0; s < p.n; s++) {
        if (proyeksi(pr, j[s * 2], j[s * 2 + 1], 0, this.a) && this.a.terlihat) {
          X[dasar + s] = this.a.x;
          Y[dasar + s] = this.a.y;
        } else X[dasar + s] = NaN;
      }
    }
    // satu path per (kelas kecepatan x tingkat umur jejak): jauh lebih murah daripada stroke per partikel
    ctx.lineCap = "round";
    ctx.globalCompositeOperation = "lighter";
    for (let tingkat = 0; tingkat < 3; tingkat++) {
      for (let kelas = 0; kelas < 4; kelas++) {
        ctx.beginPath();
        let ada = false;
        for (let i = 0; i < jumlah; i++) {
          const p = this.angin[i];
          if (p.kelas !== kelas || p.n < 2) continue;
          const dasar = i * JEJAK;
          // segmen s menghubungkan posisi s-1 dan s; dibagi tiga tingkat umur dihitung dari kepala
          const dariKepala0 = tingkat === 0 ? 6 : tingkat === 1 ? 3 : 0;
          const dariKepala1 = tingkat === 0 ? JEJAK : tingkat === 1 ? 6 : 3;
          for (let s = Math.max(1, p.n - dariKepala1); s < p.n - dariKepala0; s++) {
            const x0 = X[dasar + s - 1];
            const x1 = X[dasar + s];
            if (Number.isNaN(x0) || Number.isNaN(x1) || Math.abs(x1 - x0) > 60) continue;
            ctx.moveTo(x0, Y[dasar + s - 1]);
            ctx.lineTo(x1, Y[dasar + s]);
            ada = true;
          }
        }
        if (!ada) continue;
        ctx.strokeStyle = `rgba(${WARNA_LAJU[kelas]},${(ALFA_LAJU[kelas] * (tingkat === 0 ? 0.2 : tingkat === 1 ? 0.5 : 1)).toFixed(3)})`;
        ctx.lineWidth = tingkat === 2 ? 1.35 : 1.05;
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  // ---------------------------------------------------------------- hujan

  private gambarHujan(pr: Proyektor, kotak: [number, number, number, number]) {
    const ctx = this.ctx;
    const g = this.grid!;
    ctx.lineCap = "round";
    const ringan: number[] = [];
    const deras: number[] = [];
    const jumlahRintik = Math.max(1, Math.round(this.rintik.length * this.mutu));
    for (let ke = 0; ke < jumlahRintik; ke++) {
      const r = this.rintik[ke];
      r.umur += this.langkah;
      if (r.maks < 0 || r.umur > r.maks) {
        // lahir di tempat yang memang hujan: makin deras makin besar peluangnya
        r.maks = -1;
        for (let coba = 0; coba < 3; coba++) {
          const lon = kotak[0] + Math.random() * (kotak[2] - kotak[0]);
          const lat = kotak[1] + Math.random() * (kotak[3] - kotak[1]);
          const mm = (sampel(g, this.hujan!, lon, lat) / 10) * pudarTepi(g, lon, lat);
          if (mm > 0.25 && Math.random() < 0.12 + mm / 7) {
            r.lon = lon;
            r.lat = lat;
            r.kuat = Math.min(1, mm / 12);
            r.umur = 0;
            r.maks = 16 + Math.random() * 10;
            break;
          }
        }
        if (r.maks < 0) continue;
      }
      if (!proyeksi(pr, r.lon, r.lat, 0, this.a) || !this.a.terlihat) continue;
      const f = Math.min(1, r.umur / r.maks);
      const daftar = r.kuat > 0.45 ? deras : ringan;
      if (f < 0.8) {
        // rintik jatuh miring dari atas menuju titiknya
        const sisa = 1 - f / 0.8;
        const y = this.a.y - sisa * 26;
        const x = this.a.x + sisa * 9;
        const panjang = 7 + r.kuat * 9;
        daftar.push(x, y, x + panjang * 0.33, y - panjang);
      } else {
        // percikan kecil saat menyentuh tanah
        const t = (f - 0.8) / 0.2;
        ctx.strokeStyle = `rgba(186,230,253,${(0.5 * (1 - t)).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(this.a.x, this.a.y, 2 + t * (4 + r.kuat * 4), 1 + t * (1.6 + r.kuat * 1.4), 0, 0, 6.2832);
        ctx.stroke();
      }
    }
    for (const [daftar, warna, lebar] of [
      [ringan, "rgba(147,197,253,0.55)", 1.1],
      [deras, "rgba(224,242,254,0.85)", 1.5],
    ] as const) {
      if (daftar.length === 0) continue;
      ctx.strokeStyle = warna;
      ctx.lineWidth = lebar;
      ctx.beginPath();
      for (let i = 0; i < daftar.length; i += 4) {
        ctx.moveTo(daftar[i], daftar[i + 1]);
        ctx.lineTo(daftar[i + 2], daftar[i + 3]);
      }
      ctx.stroke();
    }
  }

  // ---------------------------------------------------------------- kabut PM2.5

  private gambarKabut(pr: Proyektor, kotak: [number, number, number, number]) {
    const ctx = this.ctx;
    const g = this.grid!;
    const pikselPerDerajat = (512 * 2 ** this.map.getZoom()) / 360;
    const k = (0.05 * this.langkah) / pikselPerDerajat;
    const jumlahKabut = Math.max(1, Math.round(this.kabut.length * this.mutu));
    for (let ke = 0; ke < jumlahKabut; ke++) {
      const p = this.kabut[ke];
      p.umur += this.langkah;
      if (p.maks < 0 || p.umur > p.maks) {
        p.maks = -1;
        for (let coba = 0; coba < 3; coba++) {
          const lon = kotak[0] + Math.random() * (kotak[2] - kotak[0]);
          const lat = kotak[1] + Math.random() * (kotak[3] - kotak[1]);
          const pm = sampel(g, this.pm25!, lon, lat) * pudarTepi(g, lon, lat);
          if (pm > 12 && Math.random() < (pm - 8) / 70) {
            p.lon = lon;
            p.lat = lat;
            p.umur = 0;
            p.maks = 150 + Math.random() * 150;
            break;
          }
        }
        if (p.maks < 0) continue;
      }
      const u = sampel(g, this.u!, p.lon, p.lat) / 10;
      const v = sampel(g, this.v!, p.lon, p.lat) / 10;
      if (Number.isNaN(u)) {
        p.maks = -1;
        continue;
      }
      p.lon += (u * k) / Math.max(0.2, Math.cos((p.lat * Math.PI) / 180));
      p.lat += v * k;
      if (!proyeksi(pr, p.lon, p.lat, 0, this.a) || !this.a.terlihat) continue;
      const f = Math.min(1, p.umur / p.maks);
      const pm = sampel(g, this.pm25!, p.lon, p.lat);
      // muncul pelan, hilang pelan; makin kotor udaranya makin pekat
      ctx.globalAlpha = Math.sin(Math.PI * f) * Math.min(0.24, 0.05 + pm / 480);
      const ukuran = 26 + Math.min(40, pm * 0.35);
      ctx.drawImage(this.kuasKabut, this.a.x - ukuran / 2, this.a.y - ukuran / 2, ukuran, ukuran);
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- asap

  private gambarAsap(pr: Proyektor) {
    const ctx = this.ctx;
    const m = this.medanAsap!;
    const dt = MENIT_PER_FRAME * 60 * this.langkah;
    // asap tersusun per sumber, jadi tidak dipangkas mutu: memotong ujungnya berarti menghapus sumber terakhir
    for (let ke = 0; ke < this.asap.length; ke++) {
      const p = this.asap[ke];
      const sumber = this.gugus[p.sumber];
      if (!sumber) continue;
      p.umur += this.langkah;
      if (p.umur > p.maks) {
        p.lon = sumber.lon + (Math.random() - 0.5) * 0.25;
        p.lat = sumber.lat + (Math.random() - 0.5) * 0.25;
        p.umur = 0;
        continue;
      }
      const [u, v] = anginDi(m, p.lon, p.lat, this.waktuAsap + p.umur * MENIT_PER_FRAME * 60_000);
      if (Number.isNaN(u) || Number.isNaN(v)) {
        p.umur = p.maks + 1;
        continue;
      }
      // sedikit acak supaya kepulan melebar seiring waktu (difusi)
      p.lon += (u * dt) / (111_195 * Math.max(0.2, Math.cos((p.lat * Math.PI) / 180))) + (Math.random() - 0.5) * 0.012;
      p.lat += (v * dt) / 111_195 + (Math.random() - 0.5) * 0.012;
      if (!proyeksi(pr, p.lon, p.lat, 0, this.a) || !this.a.terlihat) continue;
      const f = Math.min(1, p.umur / p.maks);
      ctx.globalAlpha = 0.3 * (1 - f) + 0.03;
      const ukuran = 9 + f * 30;
      ctx.drawImage(this.kuasAsap, this.a.x - ukuran / 2, this.a.y - ukuran / 2, ukuran, ukuran);
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- riak gempa & denyut pilihan

  private gambarRiak(pr: Proyektor, kini: number) {
    const ctx = this.ctx;
    ctx.lineWidth = 1.6;
    this.riak.forEach((r, i) => {
      if (!proyeksi(pr, r.lon, r.lat, 0, this.a) || !this.a.terlihat) return;
      const jangkau = 14 + (r.mag - 4) * 13;
      for (let cincin = 0; cincin < 2; cincin++) {
        const t = (kini / 2200 + i * 0.37 + cincin * 0.5) % 1;
        ctx.strokeStyle = `rgba(255,200,87,${(0.85 * (1 - t) ** 1.5).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(this.a.x, this.a.y, 5 + t * jangkau, 0, 6.2832);
        ctx.stroke();
      }
    });
  }

  private gambarPilih(pr: Proyektor, kini: number) {
    const p = this.pilih!;
    if (!proyeksi(pr, p.lon, p.lat, 0, this.a) || !this.a.terlihat) return;
    const ctx = this.ctx;
    const t = (kini / 1400) % 1;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(this.a.x, this.a.y, 15 + Math.sin(kini / 260) * 1.5, 0, 6.2832);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = `rgba(255,255,255,${(0.6 * (1 - t)).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(this.a.x, this.a.y, 16 + t * 20, 0, 6.2832);
    ctx.stroke();
    // empat tanda sudut ala bidikan
    ctx.strokeStyle = "rgba(255,93,46,0.95)";
    ctx.lineWidth = 2;
    for (let q = 0; q < 4; q++) {
      const s = (q * Math.PI) / 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(this.a.x + Math.cos(s) * 20, this.a.y + Math.sin(s) * 20);
      ctx.lineTo(this.a.x + Math.cos(s) * 26, this.a.y + Math.sin(s) * 26);
      ctx.stroke();
    }
  }

  hancurkan() {
    cancelAnimationFrame(this.raf);
    this.pengamat.disconnect();
    this.kanvas.remove();
  }
}
