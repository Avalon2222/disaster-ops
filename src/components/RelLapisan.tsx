"use client";

import { useState, type ComponentType } from "react";
import { Flame, Activity, Mountain, Siren, MessageSquareWarning, CloudLightning, Wind, CloudRain, Thermometer, Haze, Orbit, Gauge, CloudFog, Droplets, Waves, Slash, ShieldAlert, Users, Cross, ChevronLeft, Layers } from "lucide-react";
import { LAPISAN, GRUP_URUT, type IdLapisan, type Grup } from "@/lib/lapisan";
import { terjemah, type Kunci, type Lang } from "@/lib/i18n";

const IKON: Record<IdLapisan, ComponentType<{ size?: number; className?: string }>> = {
  hotspot: Flame,
  gempa: Activity,
  gunung: Mountain,
  bencana: Siren,
  laporan: MessageSquareWarning,
  peringatan: CloudLightning,
  angin: Wind,
  hujan: CloudRain,
  suhu: Thermometer,
  udara: Haze,
  citra: Orbit,
  fwi: Gauge,
  asap: CloudFog,
  banjir: Droplets,
  sungai: Waves,
  sesar: Slash,
  inarisk: ShieldAlert,
  penduduk: Users,
  rs: Cross,
};

const KUNCI_GRUP: Record<Grup, Kunci> = { live: "group_live", atmosfer: "group_atmo", prakiraan: "group_forecast", bahaya: "group_hazard" };

interface Props {
  lang: Lang;
  aktif: Set<IdLapisan>;
  jumlah: Partial<Record<IdLapisan, number>>;
  /** lapisan yang datanya gagal dimuat */
  galat: Set<IdLapisan>;
  onToggle: (id: IdLapisan) => void;
}

export default function RelLapisan({ lang, aktif, jumlah, galat, onToggle }: Props) {
  const [terbuka, setTerbuka] = useState(true);

  return (
    <aside className={`pointer-events-auto absolute left-2 top-[72px] z-20 hidden max-h-[calc(100%-200px)] flex-col sm:left-3 sm:top-[84px] sm:flex ${terbuka ? "w-[252px]" : "w-[46px]"} transition-[width] duration-200`} aria-label={terjemah(lang, "layers")}>
      <div className="glass braket flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-2 py-1.5">
          {terbuka && (
            <span className="label-kecil flex items-center gap-2 pl-1">
              <Layers size={12} /> {terjemah(lang, "layers")}
            </span>
          )}
          <button className="tombol-ikon !h-7 !w-7 !border-0" onClick={() => setTerbuka(!terbuka)} title={terjemah(lang, "layers")} aria-label={terjemah(lang, terbuka ? "layers_collapse" : "layers_expand")} aria-expanded={terbuka}>
            {terbuka ? <ChevronLeft size={14} /> : <Layers size={14} />}
          </button>
        </div>
        <div className="gulir min-h-0 flex-1 overflow-y-auto py-1">
          {GRUP_URUT.map((g) => (
            <div key={g} className="mb-1">
              {terbuka && <div className="label-kecil px-3 pb-1 pt-2 text-[9px]">{terjemah(lang, KUNCI_GRUP[g])}</div>}
              {LAPISAN.filter((l) => l.grup === g).map((l) => {
                const Ikon = IKON[l.id];
                const on = aktif.has(l.id);
                const gagal = galat.has(l.id);
                return (
                  <button
                    key={l.id}
                    onClick={() => onToggle(l.id)}
                    title={`${l.nama[lang]} [${l.tombol}]`}
                    aria-label={l.nama[lang]}
                    aria-pressed={on}
                    data-lapisan={l.id}
                    className={`group flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors ${on ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"}`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center border" style={{ borderColor: on ? l.warna : "rgba(255,255,255,0.1)", color: on ? l.warna : "#5b6475", background: on ? `${l.warna}1a` : "transparent" }}>
                      <Ikon size={14} />
                    </span>
                    {terbuka && (
                      <>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-[11.5px] ${on ? "text-text" : "text-muted"}`}>{l.nama[lang]}</span>
                          <span className="block truncate text-[9.5px] text-dim">{gagal ? terjemah(lang, "source_down") : l.deskripsi[lang]}</span>
                        </span>
                        <span className="flex flex-col items-end gap-0.5">
                          <span className={`text-[10px] tabular-nums ${on ? "text-text" : "text-dim"}`}>{jumlah[l.id] != null ? jumlah[l.id]!.toLocaleString("en-US") : ""}</span>
                          {l.jenis === "live" && <span className={`text-[8px] tracking-[0.2em] ${gagal ? "text-warn" : on ? "text-accent" : "text-dim"}`}>{gagal ? "DOWN" : "LIVE"}</span>}
                          {l.jenis === "prakiraan" && <span className={`text-[8px] tracking-[0.2em] ${on ? "text-info" : "text-dim"}`}>FCST</span>}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

/** Baris chip untuk layar kecil (ponsel). */
export function ChipLapisan({ lang, aktif, onToggle, bawah }: Pick<Props, "lang" | "aktif" | "onToggle"> & { bawah: number }) {
  return (
    <div className="pointer-events-auto absolute inset-x-0 z-20 flex gap-1.5 overflow-x-auto px-2 pb-1 sm:hidden [scrollbar-width:none]" style={{ bottom: bawah }} role="group" aria-label={terjemah(lang, "layers")}>
      {LAPISAN.map((l) => {
        const Ikon = IKON[l.id];
        const on = aktif.has(l.id);
        return (
          <button key={l.id} onClick={() => onToggle(l.id)} aria-pressed={on} data-lapisan={l.id} className="glass sentuh flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-[11px]" style={{ borderColor: on ? l.warna : undefined, color: on ? l.warna : "#8b95a7" }}>
            <Ikon size={13} /> {l.nama[lang]}
          </button>
        );
      })}
    </div>
  );
}
