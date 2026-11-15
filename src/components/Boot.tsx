"use client";

import { useEffect, useState } from "react";
import Logo from "./Logo";
import { terjemah, type Kunci } from "@/lib/i18n";

const LANGKAH: Kunci[] = ["boot_1", "boot_2", "boot_3", "boot_4"];

/** Layar pembuka: tampil selagi gaya peta dan data pertama dimuat. Selalu berbahasa Inggris (gaya konsol). */
export default function Boot({ onSelesai }: { onSelesai: () => void }) {
  const [langkah, setLangkah] = useState(0);
  const [progres, setProgres] = useState(0);
  const [pudar, setPudar] = useState(false);

  useEffect(() => {
    const mulai = performance.now();
    const total = 2600;
    let raf = 0;
    // bilah progres ikut frame, tapi selesainya pakai timer: di tab latar belakang frame berhenti
    const tik = () => {
      const t = Math.min(1, (performance.now() - mulai) / total);
      setProgres(t);
      setLangkah(Math.min(LANGKAH.length - 1, Math.floor(t * LANGKAH.length)));
      if (t < 1) raf = requestAnimationFrame(tik);
    };
    raf = requestAnimationFrame(tik);
    const pudarkan = setTimeout(() => setPudar(true), total);
    const selesai = setTimeout(onSelesai, total + 450);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(pudarkan);
      clearTimeout(selesai);
    };
  }, [onSelesai]);

  return (
    <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-bg transition-opacity duration-500 ${pudar ? "pointer-events-none opacity-0" : "opacity-100"}`}>
      <div className="pindai" />
      <div className="relative flex flex-col items-center gap-6 px-6">
        <Logo size={72} className="text-accent drop-shadow-[0_0_24px_rgba(255,93,46,0.45)]" />
        <div className="text-center">
          <div className="text-xl tracking-[0.5em] text-gold">DISASTER OPS</div>
          <div className="mt-2 max-w-[340px] text-[11px] uppercase leading-relaxed tracking-[0.2em] text-muted">{terjemah("en", "tagline")}</div>
        </div>
        <div className="w-[320px] max-w-[80vw]">
          <div className="h-[2px] w-full bg-white/10">
            <div className="h-full bg-accent transition-[width] duration-100" style={{ width: `${progres * 100}%` }} />
          </div>
          <ul className="mt-4 space-y-1 text-[11px] tracking-[0.15em]">
            {LANGKAH.map((k, i) => (
              <li key={k} className={i <= langkah ? "text-text" : "text-dim"}>
                <span className="text-accent">{i < langkah ? "[OK]" : i === langkah ? "[..]" : "[  ]"}</span> <span className={i === langkah ? "kursor" : ""}>{terjemah("en", k)}</span>
              </li>
            ))}
          </ul>
        </div>
        <button onClick={onSelesai} className="tombol-hud mt-2">
          {terjemah("en", "boot_skip")} <span className="kbd">Esc</span>
        </button>
      </div>
    </div>
  );
}
