"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapLibre } from "maplibre-gl";
import { Activity, CloudRain, Copy, Download, Flame, LocateFixed, Mountain, Play, Square } from "lucide-react";
import Panel from "./Panel";
import { terjemah, type Kunci, type Lang } from "@/lib/i18n";
import { NAMA_TINGKAT, WARNA_TINGKAT } from "@/lib/model/banjir";
import { sitrepKeMarkdown, type ButirSitrep, type KunciBagian, type Sitrep } from "@/lib/model/sitrep";
import { formatWib } from "@/lib/waktu";

interface Props {
  lang: Lang;
  map: MapLibre | null;
  sitrep: Sitrep;
  /** jumlah sumber yang sedang gagal dimuat */
  sumberGagal: number;
  onTutup: () => void;
  /** dipanggil saat briefing mulai/berhenti: konsol menyembunyikan panel lain selama tur */
  onBriefing: (aktif: boolean) => void;
  onToast: (pesan: string) => void;
}

const IKON: Record<KunciBagian, typeof Flame> = { karhutla: Flame, gempa: Activity, gunung: Mountain, hidromet: CloudRain };
const DURASI_BUTIR = 7000;

/** Butir briefing yang punya lokasi, urut menurut bagian: jadi perhentian tur kamera. */
export function perhentian(s: Sitrep): { bagian: KunciBagian; butir: ButirSitrep }[] {
  const hasil: { bagian: KunciBagian; butir: ButirSitrep }[] = [];
  for (const b of s.bagian) for (const x of b.butir) if (x.fokus) hasil.push({ bagian: b.kunci, butir: x });
  return hasil;
}

export default function WarRoom({ lang, map, sitrep, sumberGagal, onTutup, onBriefing, onToast }: Props) {
  const t = (k: Kunci) => terjemah(lang, k);
  const tur = useMemo(() => perhentian(sitrep), [sitrep]);
  const [langkah, setLangkah] = useState<number | null>(null);
  const turRef = useRef(tur);
  useEffect(() => {
    turRef.current = tur;
  }, [tur]);

  // tur kamera: terbang ke tiap perhentian, berhenti sendiri di akhir
  useEffect(() => {
    if (langkah == null || !map) return;
    const p = turRef.current[langkah];
    if (!p?.butir.fokus) return;
    const f = p.butir.fokus;
    map.flyTo({ center: [f.lon, f.lat], zoom: f.zoom, pitch: 45, bearing: (langkah % 2 ? -1 : 1) * 12, duration: 3200, essential: true });
    const id = setTimeout(() => setLangkah((l) => (l == null ? null : l + 1 < turRef.current.length ? l + 1 : null)), DURASI_BUTIR);
    return () => clearTimeout(id);
  }, [langkah, map]);

  const aktif = langkah != null;
  useEffect(() => {
    onBriefing(aktif);
  }, [aktif, onBriefing]);
  useEffect(() => () => onBriefing(false), [onBriefing]);

  // geser peta saat briefing = berhenti
  useEffect(() => {
    if (!map || !aktif) return;
    const henti = () => setLangkah(null);
    map.on("dragstart", henti);
    map.on("wheel", henti);
    return () => {
      map.off("dragstart", henti);
      map.off("wheel", henti);
    };
  }, [map, aktif]);

  const waktuTeks = formatWib(sitrep.waktu, lang);
  const salin = async () => {
    try {
      await navigator.clipboard.writeText(sitrepKeMarkdown(sitrep, lang, waktuTeks));
      onToast(t("copied"));
    } catch {
      onToast(t("copy_failed"));
    }
  };
  const unduh = () => {
    const url = URL.createObjectURL(new Blob([sitrepKeMarkdown(sitrep, lang, waktuTeks)], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `disaster-ops-sitrep-${new Date(sitrep.waktu).toISOString().slice(0, 10)}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // saat briefing jalan, panel menyusut jadi kartu narasi di bawah layar
  if (aktif && langkah != null) {
    const p = tur[langkah];
    const Ikon = IKON[p.bagian];
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-[calc(44px+env(safe-area-inset-bottom))] z-40 flex justify-center px-2" data-testid="narasi-briefing">
        <div className="glass-padat braket muncul pointer-events-auto w-full max-w-[640px] px-4 py-3" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <span className="label-kecil flex items-center gap-2 text-accent">
              <Ikon size={12} /> {t("briefing")} · {langkah + 1}/{tur.length}
            </span>
            <button className="tombol-hud aktif" onClick={() => setLangkah(null)}>
              <Square size={12} /> {t("stop")}
            </button>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-text">{p.butir[lang]}</p>
          <div className="mt-2 h-[2px] w-full bg-white/10">
            <div key={langkah} className="h-full bg-accent" style={{ animation: `isi-bilah ${DURASI_BUTIR}ms linear both` }} />
          </div>
        </div>
        <style>{`@keyframes isi-bilah { from { width: 0 } to { width: 100% } }`}</style>
      </div>
    );
  }

  return (
    <Panel
      lang={lang}
      modal
      lebar="sm:w-[760px]"
      label={`${t("sitrep_label")} · ${waktuTeks}`}
      warna={WARNA_TINGKAT[sitrep.tingkat]}
      judul={t("warroom")}
      onTutup={onTutup}
      uji="warroom"
      kaki={
        <div className="flex flex-wrap items-center gap-2">
          <button className="tombol-hud aktif" onClick={() => setLangkah(0)} disabled={tur.length === 0} data-testid="mulai-briefing">
            <Play size={13} /> {t("briefing_start")}
          </button>
          <button className="tombol-hud" onClick={() => void salin()}>
            <Copy size={13} /> {t("copy_md")}
          </button>
          <button className="tombol-hud" onClick={unduh}>
            <Download size={13} /> {t("download_md")}
          </button>
          {sumberGagal > 0 && <span className="text-[10.5px] text-warn">{t("sources_down").replace("{n}", String(sumberGagal))}</span>}
        </div>
      }
    >
      <div className="px-3 py-3">
        <div className="flex items-center gap-3 border px-3 py-2.5" style={{ borderColor: WARNA_TINGKAT[sitrep.tingkat], background: `${WARNA_TINGKAT[sitrep.tingkat]}14` }}>
          <div className="text-center">
            <div className="label-kecil">{t("status")}</div>
            <div className="text-[20px] font-bold tracking-[0.15em]" style={{ color: WARNA_TINGKAT[sitrep.tingkat] }} data-testid="tingkat-nasional">
              {NAMA_TINGKAT[sitrep.tingkat][lang].toUpperCase()}
            </div>
          </div>
          <p className="flex-1 text-[12.5px] leading-relaxed text-text">{sitrep.ringkas[lang]}</p>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {sitrep.bagian.map((b) => {
            const Ikon = IKON[b.kunci];
            return (
              <section key={b.kunci} className="border border-white/10 bg-white/[0.02] p-2.5" aria-label={b.judul[lang]}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-text">
                    <Ikon size={14} style={{ color: WARNA_TINGKAT[b.tingkat] }} /> {b.judul[lang]}
                  </h3>
                  <span className="border px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.15em]" style={{ color: WARNA_TINGKAT[b.tingkat], borderColor: WARNA_TINGKAT[b.tingkat] }}>
                    {NAMA_TINGKAT[b.tingkat][lang]}
                  </span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {b.butir.length === 0 && <li className="text-[11.5px] text-dim">{t("no_data")}</li>}
                  {b.butir.map((x, i) => (
                    <li key={i} className="flex gap-2 text-[11.5px] leading-relaxed text-text/90">
                      <span className="mt-[2px] text-accent">▸</span>
                      <span className="flex-1">{x[lang]}</span>
                      {x.fokus && map && (
                        <button
                          className="tombol-ikon !h-6 !w-6 shrink-0"
                          aria-label={t("fly_there")}
                          title={t("fly_there")}
                          onClick={() => {
                            map.flyTo({ center: [x.fokus!.lon, x.fokus!.lat], zoom: x.fokus!.zoom, duration: 2200 });
                            onTutup();
                          }}
                        >
                          <LocateFixed size={12} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
        <p className="mt-3 text-[10.5px] leading-relaxed text-muted">{t("sitrep_note")}</p>
      </div>
    </Panel>
  );
}
