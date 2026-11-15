"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CanvasSource, Map as MapLibre } from "maplibre-gl";
import { Crosshair, Pause, Play, Route, RotateCcw } from "lucide-react";
import Panel, { Baris, Catatan } from "./Panel";
import type { SkenarioGempa } from "./AlatGempa";
import { terjemah, type Kunci, type Lang } from "@/lib/i18n";
import { formatKoordinat } from "@/lib/geo";
import { hitungTsunami, radiusSumberKm, type TibaKota } from "@/lib/model/skenarioTsunami";
import { berpotensiTsunami, type Batimetri } from "@/lib/model/tsunami";
import { latDariMercY, mercY, type Sudut } from "@/lib/peta/medan";
import { setData, setTerlihat, titik } from "@/lib/peta/pasang";
import { cariRute, dataranTinggiTerdekat, type Rute } from "@/lib/rute";
import { PRASET_TSUNAMI } from "@/lib/skenario";
import { muatBatimetri, muatKota } from "@/lib/statis";
import { durasi } from "@/lib/waktu";

interface Props {
  lang: Lang;
  map: MapLibre | null;
  kanvas: HTMLCanvasElement | null;
  skenario: SkenarioGempa | null;
  onUbah: (s: SkenarioGempa | null) => void;
  onTutup: () => void;
}

interface Hasil {
  untuk: string;
  /** menit tiba per piksel kanvas */
  piksel: Float32Array;
  lebar: number;
  tinggi: number;
  sudut: Sudut;
  kota: TibaKota[];
  maks: number;
  selSumber: number;
  batimetri: Batimetri;
}

export const MAG_TSUNAMI_AWAL = 8.5;
/** pita warna waktu tiba: [batas menit, r, g, b] */
const PITA: [number, number, number, number][] = [
  [15, 239, 68, 68],
  [30, 251, 146, 60],
  [60, 253, 224, 71],
  [120, 74, 222, 128],
  [240, 56, 189, 248],
  [Infinity, 99, 102, 241],
];

export function warnaTiba(menit: number): string {
  for (const [batas, r, g, b] of PITA) if (menit < batas) return `rgb(${r},${g},${b})`;
  return "rgb(99,102,241)";
}

/** Petakan grid waktu tempuh ke piksel kanvas (baris kanvas mengikuti Mercator). */
function pikselDariGrid(b: Batimetri, menit: Float32Array): { piksel: Float32Array; lebar: number; tinggi: number; sudut: Sudut } {
  const lebar = b.nx;
  const lat1 = b.lat0 + (b.ny - 1) * b.dx;
  const yAtas = mercY(lat1);
  const yBawah = mercY(b.lat0);
  const tinggi = Math.round((lebar * (yAtas - yBawah)) / (((b.nx - 1) * b.dx * Math.PI) / 180));
  const piksel = new Float32Array(lebar * tinggi);
  for (let r = 0; r < tinggi; r++) {
    const lat = latDariMercY(yAtas + ((yBawah - yAtas) * r) / (tinggi - 1));
    const j = Math.min(b.ny - 1, Math.max(0, Math.round((lat - b.lat0) / b.dx)));
    for (let k = 0; k < lebar; k++) piksel[r * lebar + k] = menit[j * b.nx + k];
  }
  const lon1 = b.lon0 + (b.nx - 1) * b.dx;
  return {
    piksel,
    lebar,
    tinggi,
    sudut: [
      [b.lon0, lat1],
      [lon1, lat1],
      [lon1, b.lat0],
      [b.lon0, b.lat0],
    ],
  };
}

function gambar(kanvas: HTMLCanvasElement, h: Hasil, t: number) {
  if (kanvas.width !== h.lebar) kanvas.width = h.lebar;
  if (kanvas.height !== h.tinggi) kanvas.height = h.tinggi;
  const ctx = kanvas.getContext("2d");
  if (!ctx) return;
  const img = ctx.createImageData(h.lebar, h.tinggi);
  const px = img.data;
  const p = h.piksel;
  for (let i = 0; i < p.length; i++) {
    const m = p[i];
    if (!(m <= t)) continue;
    const o = i * 4;
    if (t - m < 4 && t < h.maks + 4) {
      // muka gelombang
      px[o] = 255;
      px[o + 1] = 255;
      px[o + 2] = 255;
      px[o + 3] = 235;
      continue;
    }
    let c = PITA[PITA.length - 1];
    for (const pita of PITA)
      if (m < pita[0]) {
        c = pita;
        break;
      }
    px[o] = c[1];
    px[o + 1] = c[2];
    px[o + 2] = c[3];
    px[o + 3] = 120;
  }
  ctx.putImageData(img, 0, 0);
}

export default function AlatTsunami({ lang, map, kanvas, skenario, onUbah, onTutup }: Props) {
  const t = (k: Kunci) => terjemah(lang, k);
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [galat, setGalat] = useState(false);
  const [waktu, setWaktu] = useState(0);
  const [main, setMain] = useState(false);
  const [rute, setRute] = useState<{ untuk: string; kota: string; rute: Rute; tinggi: number } | null>(null);
  const waktuRef = useRef(0);
  const kunci = skenario ? `${skenario.lon},${skenario.lat},${skenario.mag},${skenario.dalam}` : "";

  // hitung waktu tempuh saat skenario berubah
  useEffect(() => {
    if (!skenario) return;
    let hidup = true;
    const id = setTimeout(() => {
      Promise.all([muatBatimetri(), muatKota()])
        .then(([b, kota]) => {
          if (!hidup) return;
          const h = hitungTsunami(b, kota, skenario);
          setHasil({ untuk: kunci, ...pikselDariGrid(b, h.menit), kota: h.kota, maks: h.maks, selSumber: h.selSumber, batimetri: b });
          setGalat(false);
          waktuRef.current = 0;
          setWaktu(0);
          setMain(h.selSumber > 0);
        })
        .catch(() => hidup && setGalat(true));
    }, 60);
    return () => {
      hidup = false;
      clearTimeout(id);
    };
  }, [skenario, kunci]);

  const hasilKini = hasil?.untuk === kunci ? hasil : null;

  // lapisan peta nyala selama alat terbuka
  useEffect(() => {
    if (!map) return;
    setTerlihat(map, "tsunami-raster", true);
    return () => {
      setTerlihat(map, "tsunami-raster", false);
      setData(map, "eta", []);
      setData(map, "rute", []);
      setData(map, "skenario", []);
      (map.getSource("tsunami") as CanvasSource | undefined)?.pause();
    };
  }, [map]);

  // label waktu tiba di peta + tanda sumber
  useEffect(() => {
    if (!map) return;
    if (!hasilKini || !skenario) {
      setData(map, "eta", []);
      setData(map, "skenario", skenario ? [titik(skenario.lon, skenario.lat, { warna: "#ffffff", label: `✕ M${skenario.mag.toFixed(1)}` })] : []);
      return;
    }
    const berlabel = hasilKini.kota.filter((k) => k.utama).slice(0, 40);
    setData(map, "eta", berlabel.map((k) => titik(k.lon, k.lat, { label: `${k.nama} · ${durasi(k.menit, lang)}`, warna: warnaTiba(k.menit), menit: k.menit })));
    setData(map, "skenario", [titik(skenario.lon, skenario.lat, { warna: "#ffffff", label: `✕ M${skenario.mag.toFixed(1)}` })]);
    (map.getSource("tsunami") as CanvasSource | undefined)?.setCoordinates(hasilKini.sudut);
  }, [map, hasilKini, skenario, lang]);

  // gambar kanvas pada waktu `w`
  const lukis = useCallback(
    (w: number) => {
      if (!kanvas || !map || !hasilKini) return;
      gambar(kanvas, hasilKini, w);
      const s = map.getSource("tsunami") as CanvasSource | undefined;
      s?.play();
      map.triggerRepaint();
    },
    [kanvas, map, hasilKini],
  );

  // animasi: 1 jam simulasi ~ 2,4 detik
  useEffect(() => {
    if (!hasilKini) {
      if (kanvas) kanvas.getContext("2d")?.clearRect(0, 0, kanvas.width, kanvas.height);
      return;
    }
    if (!main) {
      lukis(waktuRef.current);
      const s = map?.getSource("tsunami") as CanvasSource | undefined;
      const id = requestAnimationFrame(() => requestAnimationFrame(() => s?.pause()));
      return () => cancelAnimationFrame(id);
    }
    let raf = 0;
    let lalu = performance.now();
    let tampil = 0;
    const tik = (kini: number) => {
      const dt = Math.min(100, kini - lalu);
      lalu = kini;
      waktuRef.current = Math.min(hasilKini.maks + 5, waktuRef.current + dt * 0.025);
      lukis(waktuRef.current);
      // state React cukup diperbarui ~8 kali per detik
      if (kini - tampil > 120) {
        tampil = kini;
        setWaktu(waktuRef.current);
      }
      if (waktuRef.current >= hasilKini.maks + 5) {
        setWaktu(waktuRef.current);
        setMain(false);
        return;
      }
      raf = requestAnimationFrame(tik);
    };
    raf = requestAnimationFrame(tik);
    return () => cancelAnimationFrame(raf);
  }, [main, hasilKini, lukis, kanvas, map]);

  const ulang = () => {
    waktuRef.current = 0;
    setWaktu(0);
    setMain(true);
  };

  const ruteKe = async (k: TibaKota) => {
    if (!map || !hasilKini) return;
    const tujuan = dataranTinggiTerdekat(hasilKini.batimetri, k.lon, k.lat);
    if (!tujuan) return;
    const r = await cariRute([k.lon, k.lat], [tujuan.lon, tujuan.lat]);
    setRute({ untuk: kunci, kota: k.nama, rute: r, tinggi: tujuan.tinggi });
    setData(map, "rute", [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: r.garis } }]);
    map.flyTo({ center: [k.lon, k.lat], zoom: Math.max(map.getZoom(), 9.5), duration: 1200 });
  };

  const ruteKini = rute?.untuk === kunci ? rute : null;
  useEffect(() => {
    if (map && !ruteKini) setData(map, "rute", []);
  }, [map, ruteKini]);

  const potensi = skenario && hasilKini ? berpotensiTsunami(skenario.mag, skenario.dalam, hasilKini.selSumber) : true;
  const terancam = hasilKini ? hasilKini.kota.filter((k) => k.menit < 60) : [];

  return (
    <Panel lang={lang} label={t("tool_tsunami_label")} warna="#38bdf8" judul={t("tool_tsunami")} onTutup={onTutup} uji="alat-tsunami">
      <div className="px-3 py-2">
        <p className="text-[11.5px] leading-relaxed text-muted">{t("tsunami_intro")}</p>
        <label className="mt-2 block text-[11px] text-muted">
          <span className="label-kecil">{t("scenario_pick")}</span>
          <select
            className="sentuh mt-1 block w-full border border-white/15 bg-[#0a0f1c] px-2 py-1.5 text-[12px] text-text"
            value={PRASET_TSUNAMI.find((p) => skenario && p.lon === skenario.lon && p.lat === skenario.lat && p.mag === skenario.mag)?.id ?? ""}
            onChange={(e) => {
              const p = PRASET_TSUNAMI.find((x) => x.id === e.target.value);
              if (!p) return;
              onUbah({ lon: p.lon, lat: p.lat, mag: p.mag, dalam: p.dalam });
              map?.flyTo({ center: [p.lon, p.lat], zoom: 4.6, pitch: 0, bearing: 0, duration: 1800 });
            }}
            data-testid="praset-tsunami"
          >
            <option value="">{t("scenario_custom")}</option>
            <optgroup label={t("scenario_real")}>
              {PRASET_TSUNAMI.filter((p) => p.nyata).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama[lang]} · M{p.mag}
                </option>
              ))}
            </optgroup>
            <optgroup label={t("scenario_hypo")}>
              {PRASET_TSUNAMI.filter((p) => !p.nyata).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama[lang]} · M{p.mag}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        {!skenario ? (
          <div className="mt-3 flex items-center gap-2 border border-dashed border-info/50 px-3 py-3 text-[12px] text-info" data-testid="petunjuk-klik">
            <Crosshair size={16} className="shrink-0" /> {t("click_map_source")}
          </div>
        ) : (
          <>
            {(() => {
              const praset = PRASET_TSUNAMI.find((p) => p.lon === skenario.lon && p.lat === skenario.lat && p.mag === skenario.mag);
              return praset ? <p className="mt-2 text-[11px] leading-relaxed text-gold">{praset.catatan[lang]}</p> : null;
            })()}
            <label className="mt-3 block">
              <span className="flex justify-between text-[11px] text-muted">
                <span>{t("magnitude")}</span>
                <span className="text-[13px] font-semibold text-gold tabular-nums">M {skenario.mag.toFixed(1)}</span>
              </span>
              <input type="range" className="slider-waktu mt-1.5 block" min={6.5} max={9.3} step={0.1} value={skenario.mag} onChange={(e) => onUbah({ ...skenario, mag: Number(e.target.value) })} aria-label={t("magnitude")} />
            </label>
            <div className="mt-2">
              <Baris label={t("source")}>{formatKoordinat(skenario.lon, skenario.lat)}</Baris>
              <Baris label={t("source_size")}>~{Math.round(radiusSumberKm(skenario.mag) * 2)} km</Baris>
              <Baris label={t("cities_under_1h")}>{hasilKini ? <span className={terancam.length ? "font-semibold text-bahaya" : ""}>{terancam.length}</span> : galat ? "-" : "…"}</Baris>
            </div>

            {galat && <p className="mt-2 text-[11.5px] text-warn">{t("load_failed")}</p>}
            {hasilKini && hasilKini.selSumber === 0 && <p className="mt-2 border border-warn/50 px-2 py-1.5 text-[11.5px] text-warn">{t("tsunami_on_land")}</p>}
            {hasilKini && hasilKini.selSumber > 0 && !potensi && <p className="mt-2 border border-white/15 px-2 py-1.5 text-[11.5px] text-muted">{t("tsunami_unlikely")}</p>}

            {hasilKini && hasilKini.selSumber > 0 && (
              <>
                <div className="mt-3 flex items-center gap-2">
                  <button className={`tombol-ikon ${main ? "aktif" : ""}`} onClick={() => (waktu >= hasilKini.maks ? ulang() : setMain((m) => !m))} aria-label={t(main ? "pause" : "play")}>
                    {main ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button className="tombol-ikon" onClick={ulang} aria-label={t("restart")} title={t("restart")}>
                    <RotateCcw size={14} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="label-kecil">{t("since_quake")}</span>
                      <span className="tabular-nums text-text" data-testid="waktu-tsunami">
                        T+{durasi(Math.min(waktu, hasilKini.maks), lang)}
                      </span>
                    </div>
                    <input
                      type="range"
                      className="slider-waktu mt-1.5 block"
                      min={0}
                      max={Math.ceil(hasilKini.maks)}
                      step={1}
                      value={Math.min(waktu, hasilKini.maks)}
                      onChange={(e) => {
                        setMain(false);
                        waktuRef.current = Number(e.target.value);
                        setWaktu(waktuRef.current);
                        lukis(waktuRef.current);
                      }}
                      aria-label={t("since_quake")}
                    />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9.5px] text-muted" aria-hidden="true">
                  {[
                    ["< 15", PITA[0]],
                    ["15-30", PITA[1]],
                    ["30-60", PITA[2]],
                    ["1-2 j", PITA[3]],
                    ["2-4 j", PITA[4]],
                    ["> 4 j", PITA[5]],
                  ].map(([label, c]) => (
                    <span key={label as string} className="flex items-center gap-1">
                      <span className="inline-block h-2 w-3" style={{ background: `rgb(${(c as number[])[1]},${(c as number[])[2]},${(c as number[])[3]})` }} />
                      {label as string}
                    </span>
                  ))}
                </div>

                <table className="mt-3 w-full text-[11.5px]" data-testid="tabel-tiba">
                  <thead>
                    <tr className="label-kecil text-left">
                      <th className="pb-1 font-normal">{t("coastal_city")}</th>
                      <th className="pb-1 text-right font-normal">{t("arrival")}</th>
                      <th className="pb-1 text-right font-normal">{t("est_height")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hasilKini.kota.slice(0, 18).map((k) => (
                      <tr key={k.nama} className={`cursor-pointer border-t border-white/5 hover:bg-white/[0.05] ${waktu >= k.menit ? "" : "opacity-60"}`} onClick={() => void ruteKe(k)} title={t("route_high_ground")}>
                        <td className="py-1 pr-2 text-text">
                          <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: warnaTiba(k.menit) }} />
                          {k.nama}
                        </td>
                        <td className="py-1 text-right tabular-nums" style={{ color: warnaTiba(k.menit) }}>
                          {durasi(k.menit, lang)}
                        </td>
                        <td className="py-1 text-right tabular-nums text-muted">{potensi ? `~${k.tinggi >= 10 ? Math.round(k.tinggi) : k.tinggi.toFixed(1)} m` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-dim">
                  <Route size={11} /> {t("tap_city_route")}
                </p>
                {ruteKini && (
                  <p className="mt-1.5 text-[11px] text-ok" data-testid="hasil-rute">
                    {ruteKini.kota}: {ruteKini.rute.jalan ? t("route_road") : t("route_straight")} {t("to_high_ground").replace("{n}", String(ruteKini.tinggi))}, {ruteKini.rute.jarakKm.toFixed(1)} km{ruteKini.rute.jalan ? `, ~${durasi(ruteKini.rute.menit, lang)}` : ""}
                  </p>
                )}
              </>
            )}
            <div className="mt-3">
              <button className="tombol-hud" onClick={() => onUbah(null)}>
                <Crosshair size={13} /> {t("pick_again")}
              </button>
            </div>
          </>
        )}
        <Catatan>{t("note_tsunami")}</Catatan>
      </div>
    </Panel>
  );
}
