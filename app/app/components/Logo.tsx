import Image from 'next/image';
import Link from 'next/link';

export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 select-none hover:opacity-90 transition-opacity"
    >
      {/* logo-mark.png is logo.png with the dark plate keyed out and cropped to
          the artwork, so the glyph fills its box instead of the ~52% it used to.
          No rounding: there is no plate left to round. */}
      <Image
        src="/logo-mark.png"
        alt="BitYield logo"
        width={22}
        height={22}
        priority
      />
      <span className="font-display font-bold text-xl tracking-tight">
        Bit<span className="text-bitcoin">Yield</span>
      </span>
    </Link>
  );
}
