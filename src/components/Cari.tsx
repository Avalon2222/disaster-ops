"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, MapPinned, Mountain, Search, Waves } from "lucide-react";
import { terjemah, type Lang } from "@/lib/i18n";
import { cariEntitas, type Entitas } from "@/lib/cari";
import { useFokusPanel } from "@/lib/useFokusPanel";

interface Props {
  lang: Lang;
  entitas: Entitas[];
  onPilih: (e: Entitas) => void;
  onTutup: () => void;
}

const IKON = { kota: Building2, gunung: Mountain, provinsi: MapPinned, sungai: Waves };

/** Palet pencarian (Ctrl+K): kota, gunung api, provinsi, sungai. Panah atas/bawah + Enter. */
export default function Cari({ lang, entitas, onPilih, onTutup }: Props) {
  const [q, setQ] = useState("");
  const [aktif, setAktif] = useState(0);
  const ref = useFokusPanel<HTMLDivElement>({ jebak: true });
  const masukan = useRef<HTMLInputElement>(null);
  const hasil = useMemo(() => cariEntitas(entitas, q, 12), [entitas, q]);

  useEffect(() => {
    masukan.current?.focus();
  }, []);

  const tekan = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAktif((a) => Math.min(hasil.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAktif((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && hasil[aktif]) {
      e.preventDefault();
      onPilih(hasil[aktif]);
    }
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-start justify-center bg-black/55 sm:pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && onTutup()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={terjemah(lang, "search")} className="glass-padat braket lembar-hp muncul flex w-full flex-col outline-none sm:max-h-[70vh] sm:w-[520px]" onKeyDown={tekan}>
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          <Search size={15} className="shrink-0 text-muted" />
          <input
            ref={masukan}
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setAktif(0);
            }}
            placeholder={terjemah(lang, "search_hint")}
            aria-label={terjemah(lang, "search")}
            aria-controls="hasil-cari"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-[13px] text-text outline-none placeholder:text-dim"
            autoComplete="off"
            spellCheck={false}
          />
          <button className="tombol-hud" onClick={onTutup}>
            Esc
          </button>
        </div>
        <ul id="hasil-cari" role="listbox" aria-label={terjemah(lang, "search")} className="gulir min-h-0 flex-1 overflow-y-auto py-1">
          {hasil.length === 0 && <li className="px-3 py-3 text-[12px] text-dim">{terjemah(lang, q ? "no_result" : "search_empty")}</li>}
          {hasil.map((e, i) => {
            const Ikon = IKON[e.jenis];
            return (
              <li key={`${e.jenis}-${e.nama}-${i}`} role="option" aria-selected={i === aktif}>
                <button className={`sentuh flex w-full items-center gap-3 px-3 py-2 text-left text-[12.5px] ${i === aktif ? "bg-white/[0.07] text-text" : "text-text/90 hover:bg-white/[0.04]"}`} onMouseEnter={() => setAktif(i)} onClick={() => onPilih(e)}>
                  <Ikon size={14} className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate">{e.nama}</span>
                  <span className="shrink-0 truncate text-[10.5px] text-dim">{e.ket}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
