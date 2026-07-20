import Image from 'next/image';
import Link from 'next/link';

export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 select-none hover:opacity-90 transition-opacity"
    >
      <Image
        src="/logo.png"
        alt="BitYield logo"
        width={28}
        height={28}
        className="rounded-md"
        priority
      />
      <span className="font-display font-bold text-xl tracking-tight">
        Bit<span className="text-bitcoin">Yield</span>
      </span>
    </Link>
  );
}
