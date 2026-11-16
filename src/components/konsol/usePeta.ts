"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Map as MapLibre, setWorkerUrl, type MapMouseEvent } from "maplibre-gl";
import { KanvasEfek } from "@/lib/peta/efek";
import { bangunStyle, ID_LAYER_SAT, layerBasemapTersembunyiSaatSat } from "@/lib/peta/mapStyle";
import { pasangSemuaLapisan } from "@/lib/peta/pasang";
import type { Tampilan } from "@/lib/urlState";
import { workerPetaSekali } from "@/lib/workerPeta";

/** toleransi klik (px) untuk titik kecil: jari di HP butuh lebih lebar daripada kursor */
export const TOLERANSI_KLIK = { mouse: 6, sentuh: 14 };

export interface PenanganPeta {
  saatKlik(m: MapLibre, e: MapMouseEvent): void;
  saatMoveEnd(m: MapLibre): void;
  /** kursor bergerak di atas peta: kembalikan true kalau ada objek di bawahnya (kursor jadi tangan) */
  saatHover(m: MapLibre, e: MapMouseEvent): boolean;
  saatKeluar(): void;
}

interface Opsi {
  tampilan: Tampilan;
  satAwal: boolean;
  datarAwal: boolean;
  penanganRef: RefObject<PenanganPeta>;
}

/**
 * Membuat peta MapLibre (globe) sekali, memasang semua layer dan kanvas, lalu meneruskan event ke konsol.
 * `map` dan `kanvasTsunami` baru terisi setelah style dan layer siap, jadi efek di konsol cukup bergantung padanya.
 */
/** Apakah WebGL peta dirender CPU (SwiftShader, llvmpipe, dsb.), bukan GPU. */
function rendererPerangkatLunak(m: MapLibre): boolean {
  try {
    const kanvas = m.getCanvas();
    const gl = (kanvas.getContext("webgl2") ?? kanvas.getContext("webgl")) as WebGLRenderingContext | null;
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    const nama = gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
    return /swiftshader|llvmpipe|software|basic render/i.test(nama);
  } catch {
    return false;
  }
}

export function usePeta({ tampilan, satAwal, datarAwal, penanganRef }: Opsi) {
  const wadahRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibre | null>(null);
  const [online, setOnline] = useState(true);
  const [kanvasTsunami, setKanvasTsunami] = useState<HTMLCanvasElement | null>(null);
  const efekRef = useRef<KanvasEfek | null>(null);
  const layerSat = useRef<string[]>([]);
  const awal = useRef({ tampilan, satAwal, datarAwal });

  const terapkanSat = useCallback((m: MapLibre, on: boolean) => {
    if (!m.getLayer(ID_LAYER_SAT)) return;
    m.setLayoutProperty(ID_LAYER_SAT, "visibility", on ? "visible" : "none");
    for (const id of layerSat.current) if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", on ? "none" : "visible");
  }, []);

  useEffect(() => {
    if (!wadahRef.current) return;
    let dibatalkan = false;
    let peta: MapLibre | null = null;
    (async () => {
      // worker diambil barengan dengan style, jadi tidak menambah waktu tunggu
      const [style, urlWorker] = await Promise.all([bangunStyle().catch(() => null), workerPetaSekali()]);
      if (dibatalkan || !wadahRef.current) return;
      if (!style) {
        setOnline(false);
        return;
      }
      layerSat.current = layerBasemapTersembunyiSaatSat(style);
      setWorkerUrl(urlWorker);
      const t = awal.current.tampilan;
      const m = new MapLibre({
        container: wadahRef.current,
        style,
        center: [t.lon, t.lat],
        zoom: t.zoom,
        bearing: t.bearing,
        pitch: t.pitch,
        attributionControl: { compact: true },
        maxPitch: 70,
        minZoom: 1.5,
        fadeDuration: 150,
        canvasContextAttributes: { antialias: true },
      });
      peta = m;
      // rel lapisan menutupi ~260 px di kiri layar lebar; di HP chip dan pita berita menutupi bagian bawah
      m.setPadding(window.innerWidth >= 640 ? { left: 250, top: 40, right: 0, bottom: 40 } : { top: 40, bottom: 110, left: 0, right: 0 });
      (window as unknown as { __dops?: MapLibre }).__dops = m;
      // sprite OpenFreeMap tidak punya "circle-11" (titik kota); buat sendiri supaya tidak ada warning di console
      m.setMissingStyleImageResolver((id) => {
        if (m.hasImage(id)) return;
        const n = id === "circle-11" ? 11 : 1;
        const data = new Uint8Array(n * n * 4);
        if (n > 1) {
          const c = (n - 1) / 2;
          for (let y = 0; y < n; y++)
            for (let x = 0; x < n; x++) {
              const d = Math.hypot(x - c, y - c);
              const i = (y * n + x) * 4;
              data[i] = 0x8b;
              data[i + 1] = 0x95;
              data[i + 2] = 0xa7;
              data[i + 3] = d <= c - 1.5 ? 230 : d <= c ? 120 : 0;
            }
        }
        m.addImage(id, { width: n, height: n, data });
      });
      // cukup menunggu style, bukan semua ubin: lapisan data langsung tampil walau peta dasar masih mengunduh
      m.once("style.load", () => {
        if (dibatalkan) return;
        const tsunami = document.createElement("canvas");
        tsunami.width = 2;
        tsunami.height = 2;
        pasangSemuaLapisan(m, style, tsunami);
        setKanvasTsunami(tsunami);
        if (awal.current.satAwal) terapkanSat(m, true);
        if (awal.current.datarAwal) m.setProjection({ type: "mercator" });
        const induk = wadahRef.current?.parentElement;
        if (induk) {
          const lemah = rendererPerangkatLunak(m);
          efekRef.current = new KanvasEfek(m, induk, lemah || window.matchMedia("(max-width: 640px), (pointer: coarse)").matches, lemah);
        }
        setMap(m);
      });
      m.on("moveend", () => penanganRef.current.saatMoveEnd(m));
      m.on("click", (e: MapMouseEvent) => penanganRef.current.saatKlik(m, e));
      m.on("mousemove", (e: MapMouseEvent) => {
        m.getCanvas().style.cursor = penanganRef.current.saatHover(m, e) ? "pointer" : "";
      });
      m.on("mouseout", () => penanganRef.current.saatKeluar());
      m.on("movestart", () => penanganRef.current.saatKeluar());
      m.on("error", (e) => {
        const pesan = String((e as { error?: { message?: string } }).error?.message ?? "");
        if (/tiles\.openfreemap|fonts/.test(pesan)) setOnline(false);
      });
    })();
    return () => {
      dibatalkan = true;
      efekRef.current?.hancurkan();
      efekRef.current = null;
      peta?.remove();
      setMap(null);
      setKanvasTsunami(null);
    };
  }, [penanganRef, terapkanSat]);

  return { wadahRef, map, online, kanvasTsunami, efekRef, terapkanSat };
}

/** true di layar sempit (ponsel): panel samping jadi lembar bawah dan menutupi lini masa. */
export function useSempit(): boolean {
  const [sempit, setSempit] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const ubah = () => setSempit(mq.matches);
    ubah();
    mq.addEventListener("change", ubah);
    return () => mq.removeEventListener("change", ubah);
  }, []);
  return sempit;
}
