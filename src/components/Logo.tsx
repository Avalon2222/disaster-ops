/** Lambang: segi enam dengan denyut seismograf di tengahnya, dibuat sendiri (bukan logo resmi mana pun). */
export default function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <path d="M32 4 L56 18 L56 46 L32 60 L8 46 L8 18 Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M32 11 L50 21.5 L50 42.5 L32 53 L14 42.5 L14 21.5 Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" opacity="0.45" />
      <path d="M12 33 H22 L26 24 L31 43 L36 17 L40 37 L43 33 H52" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
