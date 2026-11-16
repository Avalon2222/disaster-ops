"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapLibre, RasterTileSource } from "maplibre-gl";
import { Pause, Play, Satellite, X } from "lucide-react";
import { terjemah, type Kunci, type Lang } from "@/lib/i18n";
import { pudarkanRaster, setData, setTerlihat, titik, urlCitra } from "@/lib/peta/pasang";
import { TONGGAK_2019 } from "@/lib/skenario";
import { muatKarhutla2019, type Karhutla2019 } from "@/lib/statis";
import { formatTanggalIso, tambahHari } from "@/lib/waktu";

interface Props {
  lang: Lang;
  map: MapLibre | null;
  onTutup: () => void;
}

/** hari yang masih ditampilkan di belakang hari berjalan (titik memudar) */
const EKOR = 3;
const HARI_AWAL = 62; // 1 Sep 2019: langsung ke bagian yang ramai

/** Fitur titik panas untuk hari `h` dan EKOR hari sebelumnya; `umur` = hari sejak terdeteksi. */
export function fiturHari(d: Karhutla2019, h: number): GeoJSON.Feature[] {
  const fitur: GeoJSON.Feature[] = [];
  const dari = Math.max(0, h - EKOR);
  for (let i = d.awalHari[dari]; i < d.awalHari[Math.min(d.meta.hari, h + 1)]; i++) {
    fitur.push(titik(d.lon[i], d.lat[i], { id: `r-${i}`, umur: h - d.hari[i], frp: Math.round(d.frp[i]) }));
  }
  return fitur;
}

export default function Replay2019({ lang, map, onTutup }: Props) {
  const t = (k: Kunci) => terjemah(lang, k);
  const [data, setIsi] = useState<Karhutla2019 | null>(null);
  const [galat, setGalat] = useState(false);
  const [hari, setHari] = useState(HARI_AWAL);
  const [main, setMain] = useState(true);
  const [citra, setCitra] = useState(false);
  const hariRef = useRef(hari);

  useEffect(() => {
    let hidup = true;
    muatKarhutla2019()
      .then((d) => hidup && setIsi(d))
      .catch(() => hidup && setGalat(true));
    return () => {
      hidup = false;
    };
  }, []);

  // lapisan live disembunyikan konsol; di sini hanya lapisan putar ulang
  useEffect(() => {
    if (!map) return;
    setTerlihat(map, "replay-titik", true);
    map.flyTo({ center: [108, -1], zoom: Math.min(map.getZoom(), 4.4), pitch: 0, bearing: 0, duration: 1800 });
    return () => {
      setTerlihat(map, "replay-titik", false);
      setData(map, "replay", []);
    };
  }, [map]);

  useEffect(() => {
    hariRef.current = hari;
    if (map && data) setData(map, "replay", fiturHari(data, hari));
  }, [map, data, hari]);

  // 4 hari per detik
  useEffect(() => {
    if (!main || !data) return;
    const id = setInterval(() => {
      const berikut = hariRef.current + 1;
      if (berikut >= data.meta.hari) setMain(false);
      else setHari(berikut);
    }, 250);
    return () => clearInterval(id);
  }, [main, data]);

  const tanggal = data ? tambahHari(data.meta.mulai, hari) : "2019-09-01";

  // citra harian mengikuti tanggal, tapi hanya diganti saat pemutar berhenti (supaya tidak membanjiri GIBS)
  useEffect(() => {
    if (!map) return;
    const s = map.getSource("citra") as RasterTileSource | undefined;
    if (citra && !main) s?.setTiles([urlCitra(tanggal)]);
    pudarkanRaster(map, "citra-raster", citra);
  }, [map, citra, main, tanggal]);

  const tonggak = useMemo(() => [...TONGGAK_2019].reverse().find((x) => x.tanggal <= tanggal) ?? TONGGAK_2019[0], [tanggal]);
  const maks = data ? Math.max(...data.meta.per_hari) : 1;
  const kumulatif = useMemo(() => {
    if (!data) return 0;
    let s = 0;
    for (let i = 0; i <= hari; i++) s += data.meta.per_hari[i];
    return s;
  }, [data, hari]);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[calc(34px+env(safe-area-inset-bottom))] z-30 flex justify-center px-2" data-testid="replay">
      <div className="glass-padat braket muncul pointer-events-auto w-full max-w-[920px] px-3 py-2.5" role="region" aria-label={t("tool_replay")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="label-kecil text-accent">{t("replay_label")}</div>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3">
              <span className="text-[18px] font-semibold tracking-[0.06em] text-gold tabular-nums" data-testid="tanggal-replay">
                {formatTanggalIso(tanggal, lang)}
              </span>
              {data && (
                <span className="text-[11px] text-muted tabular-nums">
                  {data.meta.per_hari[hari].toLocaleString("en-US")} {t("hotspots_that_day")} · {kumulatif.toLocaleString("en-US")} {t("cumulative")}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button className={`tombol-hud ${citra ? "aktif" : ""}`} onClick={() => setCitra((c) => !c)} aria-pressed={citra} title={t("replay_imagery_hint")}>
              <Satellite size={13} /> <span className="hidden sm:inline">{t("replay_imagery")}</span>
            </button>
            <button className="tombol-ikon" onClick={onTutup} aria-label={t("close")} title={`${t("close")} (Esc)`}>
              <X size={15} />
            </button>
          </div>
        </div>

        <p className="mt-1.5 min-h-[32px] text-[11.5px] leading-snug text-text/90" aria-live="polite">
          {tonggak[lang]}
        </p>

        {galat && <p className="text-[11.5px] text-warn">{t("load_failed")}</p>}
        {data && (
          <div className="mt-1 flex items-end gap-2.5">
            <button className={`tombol-ikon shrink-0 ${main ? "aktif" : ""}`} onClick={() => (hari >= data.meta.hari - 1 ? (setHari(0), setMain(true)) : setMain((m) => !m))} aria-label={t(main ? "pause" : "play")}>
              {main ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <div className="min-w-0 flex-1">
              {/* jumlah titik panas per hari; batang hari berjalan disorot */}
              <div className="flex h-[38px] items-end" aria-hidden="true">
                {data.meta.per_hari.map((n, i) => (
                  <div key={i} className="flex-1" style={{ height: `${Math.max(3, (n / maks) * 100)}%`, background: i === hari ? "#ffc857" : i < hari ? "rgba(255,93,46,0.75)" : "rgba(255,255,255,0.14)" }} />
                ))}
              </div>
              <input
                type="range"
                className="slider-waktu mt-1.5 block"
                min={0}
                max={data.meta.hari - 1}
                step={1}
                value={hari}
                onChange={(e) => {
                  setMain(false);
                  setHari(Number(e.target.value));
                }}
                aria-label={t("replay_date")}
                aria-valuetext={formatTanggalIso(tanggal, lang)}
              />
              <div className="mt-0.5 flex justify-between text-[9px] text-dim" aria-hidden="true">
                {["2019-07-01", "2019-08-01", "2019-09-01", "2019-10-01", "2019-11-01", "2019-11-30"].map((d) => (
                  <span key={d}>{formatTanggalIso(d, lang).slice(0, -5)}</span>
                ))}
              </div>
            </div>
          </div>
        )}
        <p className="mt-1.5 text-[9.5px] text-dim">{t("replay_note")}</p>
      </div>
    </div>
  );
}
