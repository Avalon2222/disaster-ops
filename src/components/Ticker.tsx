"use client";

import { terjemah, type Lang } from "@/lib/i18n";

/** Pita berita di dasar layar: kejadian terbaru dari semua sumber. Berhenti saat disorot. */
export default function Ticker({ lang, butir }: { lang: Lang; butir: string[] }) {
  if (butir.length === 0) return null;
  return (
    <div className="glass pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex h-[30px] items-center overflow-hidden border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] text-[11px]" role="marquee" aria-label={terjemah(lang, "ticker")}>
      <span className="z-10 flex h-full shrink-0 items-center gap-2 border-r border-white/10 bg-[#0a0f1c] px-3 text-[10px] tracking-[0.2em] text-accent">
        <span className="denyut" /> LIVE
      </span>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="ticker-jalur text-muted">
          {butir.map((b, i) => (
            <span key={i} className="mr-10">
              <span className="mr-2 text-accent">▸</span>
              {b}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
