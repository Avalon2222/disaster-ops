"use client";

import { Pause, Play } from "lucide-react";
import { terjemah, type Lang } from "@/lib/i18n";
import { JENIS_INARISK, type JenisInarisk } from "@/lib/lapisan";
import { gradienLegenda, posisiLegenda, type Skala } from "@/lib/peta/warna";

export interface Legenda {
  judul: string;
  skala: Skala;
}

interface Props {
  lang: Lang;
  /** null = tidak ada lapisan berwaktu yang nyala: penggeser disembunyikan */
  mode: "jam" | "hari" | null;
  posisi: number;
  jumlah: number;
  /** teks waktu untuk posisi sekarang, mis. "Sen 16 Nov 14.00 WIB" dan "+27 jam" */
  label: string;
  selisih: string;
  main: boolean;
  onMain: () => void;
  onPosisi: (i: number) => void;
  legenda: Legenda | null;
  /** rentang titik panas (hanya tampil kalau lapisannya nyala) */
  rentang: 24 | 168 | null;
  onRentang: (jam: 24 | 168) => void;
  inarisk: JenisInarisk | null;
  onInarisk: (j: JenisInarisk) => void;
  /** umur snapshot prakiraan, mis. "prakiraan 3 jam lalu" */
  catatan?: string;
}

const NAMA_INARISK: Record<JenisInarisk, { id: string; en: string }> = {
  gempa: { id: "Gempa", en: "Quake" },
  tsunami: { id: "Tsunami", en: "Tsunami" },
  banjir: { id: "Banjir", en: "Flood" },
  longsor: { id: "Longsor", en: "Landslide" },
  karhutla: { id: "Karhutla", en: "Wildfire" },
  gunungapi: { id: "Gunung api", en: "Volcano" },
};

export default function LiniMasa(p: Props) {
  const adaIsi = p.mode || p.legenda || p.rentang || p.inarisk;
  if (!adaIsi) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 flex justify-center px-2 sm:bottom-[38px] sm:pl-[272px] sm:pr-3" data-testid="lini-masa">
      <div className="glass pointer-events-auto flex w-full max-w-[980px] flex-col gap-1.5 px-2.5 py-2 sm:flex-row sm:items-center sm:gap-4">
        {p.mode && (
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <button className={`tombol-ikon shrink-0 ${p.main ? "aktif" : ""}`} onClick={p.onMain} aria-label={terjemah(p.lang, p.main ? "pause" : "play")} title={`${terjemah(p.lang, p.main ? "pause" : "play")} (Space)`}>
              {p.main ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="label-kecil">{terjemah(p.lang, p.mode === "jam" ? "timeline_hours" : "timeline_days")}</span>
                <span className="truncate text-[11px] tabular-nums text-text" data-testid="waktu-lini-masa">
                  {p.label} <span className="text-gold">{p.selisih}</span>
                </span>
              </div>
              <input
                type="range"
                className="slider-waktu mt-1.5 block"
                min={0}
                max={Math.max(1, p.jumlah - 1)}
                step={1}
                value={p.posisi}
                onChange={(e) => p.onPosisi(Number(e.target.value))}
                aria-label={terjemah(p.lang, p.mode === "jam" ? "timeline_hours" : "timeline_days")}
                aria-valuetext={`${p.label} ${p.selisih}`}
              />
            </div>
          </div>
        )}
        {p.legenda && (
          <div className="w-full shrink-0 sm:w-[210px]" data-testid="legenda">
            <div className="flex items-baseline justify-between gap-2">
              <span className="label-kecil truncate">{p.legenda.judul}</span>
              <span className="text-[9.5px] text-dim">{p.legenda.skala.satuan}</span>
            </div>
            <div className="mt-1 h-2 w-full" style={{ background: gradienLegenda(p.legenda.skala) }} />
            <div className="relative mt-0.5 h-3 text-[9px] tabular-nums text-muted">
              {p.legenda.skala.label.map((v) => (
                <span key={v} className="absolute -translate-x-1/2" style={{ left: `${Math.min(96, Math.max(4, posisiLegenda(p.legenda!.skala, v) * 100))}%` }}>
                  {v}
                </span>
              ))}
            </div>
          </div>
        )}
        {p.rentang && (
          <div className="flex shrink-0 items-center gap-1" role="group" aria-label={terjemah(p.lang, "hotspot_range")}>
            <span className="label-kecil mr-1 hidden 2xl:inline">{terjemah(p.lang, "hotspot_range")}</span>
            {([24, 168] as const).map((j) => (
              <button key={j} className={`tombol-hud ${p.rentang === j ? "aktif" : ""}`} onClick={() => p.onRentang(j)} aria-pressed={p.rentang === j}>
                {j === 24 ? terjemah(p.lang, "range_24h") : terjemah(p.lang, "range_7d")}
              </button>
            ))}
          </div>
        )}
        {p.inarisk && (
          <label className="flex shrink-0 items-center gap-2 text-[11px] text-muted">
            <span className="label-kecil">InaRISK</span>
            <select className="sentuh border border-white/15 bg-[#0a0f1c] px-2 py-1 text-[12px] text-text" value={p.inarisk} onChange={(e) => p.onInarisk(e.target.value as JenisInarisk)} aria-label={terjemah(p.lang, "inarisk_pick")}>
              {JENIS_INARISK.map((j) => (
                <option key={j} value={j}>
                  {NAMA_INARISK[j][p.lang]}
                </option>
              ))}
            </select>
          </label>
        )}
        {p.catatan && p.mode && <span className="hidden shrink-0 text-[9.5px] text-dim 2xl:inline">{p.catatan}</span>}
      </div>
    </div>
  );
}
