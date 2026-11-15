import KonsolKlien from "@/components/KonsolKlien";

export default function Halaman() {
  return (
    <>
      {/* judul + ringkasan ikut di HTML server, jadi mesin pencari dan pembaca layar tetap dapat isinya */}
      <h1 className="sr-only">Disaster Ops: war room bencana Indonesia</h1>
      <p className="sr-only">
        Peta live bencana Indonesia dari data publik: titik panas karhutla NASA FIRMS, gempa BMKG dan USGS, status gunung
        api PVMBG, kejadian bencana BNPB, peringatan dini cuaca, angin dan hujan, prakiraan risiko karhutla dan banjir 7
        hari, simulasi waktu tiba tsunami, skenario guncangan gempa, dan putar ulang karhutla 2019.
      </p>
      <KonsolKlien />
    </>
  );
}
