import Link from 'next/link';

export function Logo() {
  return (
    <Link
      href="/"
      className="font-display font-bold text-xl tracking-tight select-none hover:opacity-90 transition-opacity"
    >
      Bit<span className="text-bitcoin">Yield</span>
    </Link>
  );
}
