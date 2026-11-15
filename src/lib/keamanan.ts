/**
 * Header keamanan untuk semua halaman (dipasang lewat next.config.ts).
 * Kalau browser perlu mengambil sesuatu dari host baru (ubin peta, data, gambar), tambahkan host-nya
 * di SUMBER_LUAR; kalau tidak, permintaan itu diblokir Content-Security-Policy.
 */

export const SUMBER_LUAR = {
  /** fetch/XHR dari browser */
  sambung: [
    "https://tiles.openfreemap.org", // gaya dan ubin peta dasar
    "https://server.arcgisonline.com", // citra satelit Esri
    "https://gibs.earthdata.nasa.gov", // citra harian NASA GIBS
    "https://raw.githubusercontent.com", // snapshot prakiraan di cabang `data`
    "https://router.project-osrm.org", // rute evakuasi
  ],
  gambar: [
    "https://tiles.openfreemap.org",
    "https://server.arcgisonline.com",
    "https://gibs.earthdata.nasa.gov",
    "https://bmkg-content-inatews.storage.googleapis.com", // shakemap BMKG
    "https://nowcasting.bmkg.go.id", // infografis peringatan dini
    "https://images.petabencana.id", // foto laporan warga
  ],
  // font dimuat lewat next/font dari domain sendiri, jadi tidak ada host font di sini
  gaya: [] as string[],
  font: [] as string[],
};

export function kebijakanKonten(dev = false): string {
  const aturan: [string, string[]][] = [
    ["default-src", ["'self'"]],
    // Next menyisipkan skrip inline untuk hidrasi; mode dev butuh eval untuk hot reload
    ["script-src", ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])]],
    ["style-src", ["'self'", "'unsafe-inline'", ...SUMBER_LUAR.gaya]],
    ["img-src", ["'self'", "data:", "blob:", ...SUMBER_LUAR.gambar]],
    ["font-src", ["'self'", "data:", ...SUMBER_LUAR.font]],
    ["connect-src", ["'self'", "data:", "blob:", ...SUMBER_LUAR.sambung, ...(dev ? ["ws:"] : [])]],
    // worker MapLibre dan penghitung waktu tempuh tsunami
    ["worker-src", ["'self'", "blob:"]],
    ["child-src", ["'self'", "blob:"]],
    ["media-src", ["'self'", "blob:"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'self'"]],
  ];
  return aturan.map(([nama, nilai]) => `${nama} ${nilai.join(" ")}`).join("; ");
}

export function headerKeamanan(dev = false): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: kebijakanKonten(dev) },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=(), fullscreen=(self)" },
  ];
}
