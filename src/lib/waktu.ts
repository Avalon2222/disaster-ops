/** Waktu: Indonesia punya tiga zona, konsol memakai WIB (UTC+7) sebagai acuan dan UTC untuk data. */

const BULAN_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BULAN_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HARI_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const HARI_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WIB_MS = 7 * 3600_000;

function dua(n: number): string {
  return n.toString().padStart(2, "0");
}

/** "15 Nov 08.30 WIB" */
export function formatWib(ms: number, lang: "id" | "en" = "id", denganTanggal = true): string {
  if (!Number.isFinite(ms)) return "-";
  const t = new Date(ms + WIB_MS);
  const jam = `${dua(t.getUTCHours())}${lang === "id" ? "." : ":"}${dua(t.getUTCMinutes())} WIB`;
  if (!denganTanggal) return jam;
  return `${t.getUTCDate()} ${(lang === "id" ? BULAN_ID : BULAN_EN)[t.getUTCMonth()]} ${jam}`;
}

/** "Sen 16 Nov" (tanggal menurut WIB) */
export function formatHariWib(ms: number, lang: "id" | "en" = "id"): string {
  if (!Number.isFinite(ms)) return "-";
  const t = new Date(ms + WIB_MS);
  return `${(lang === "id" ? HARI_ID : HARI_EN)[t.getUTCDay()]} ${t.getUTCDate()} ${(lang === "id" ? BULAN_ID : BULAN_EN)[t.getUTCMonth()]}`;
}

/** "15 Nov 2019" dari tanggal ISO (tanpa geser zona) */
export function formatTanggalIso(iso: string, lang: "id" | "en" = "id"): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${(lang === "id" ? BULAN_ID : BULAN_EN)[m - 1]} ${y}`;
}

/** "2026-11-15" menurut WIB */
export function tanggalWib(ms: number): string {
  const t = new Date(ms + WIB_MS);
  return `${t.getUTCFullYear()}-${dua(t.getUTCMonth() + 1)}-${dua(t.getUTCDate())}`;
}

/** Tambah `n` hari ke tanggal ISO. */
export function tambahHari(iso: string, n: number): string {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** "12 mnt lalu", "3 jam lalu", "2 hari lalu" */
export function umur(ms: number, sekarang: number, lang: "id" | "en" = "id"): string {
  if (!Number.isFinite(ms) || !Number.isFinite(sekarang)) return "-";
  const menit = Math.max(0, Math.round((sekarang - ms) / 60_000));
  if (menit < 1) return lang === "id" ? "baru saja" : "just now";
  if (menit < 60) return lang === "id" ? `${menit} mnt lalu` : `${menit} min ago`;
  const jam = Math.round(menit / 60);
  if (jam < 48) return lang === "id" ? `${jam} jam lalu` : `${jam} h ago`;
  const hari = Math.round(jam / 24);
  return lang === "id" ? `${hari} hari lalu` : `${hari} d ago`;
}

/** "1 j 25 mnt" untuk durasi (waktu tiba tsunami, dsb.) */
export function durasi(menit: number, lang: "id" | "en" = "id"): string {
  if (!Number.isFinite(menit)) return "-";
  const m = Math.max(0, Math.round(menit));
  if (m < 60) return lang === "id" ? `${m} mnt` : `${m} min`;
  const j = Math.floor(m / 60);
  const s = m % 60;
  return lang === "id" ? `${j} j ${dua(s)} mnt` : `${j} h ${dua(s)} min`;
}
