import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '../components/Logo';

export const metadata: Metadata = {
  title: 'Privacy · BitYield',
  description: 'What BitYield stores in your browser, what it records during the closed beta, and who else sees your data.',
};

export default function PrivacyPage() {
  return (
    <div className="bg-[#0a0a0a] text-white min-h-screen flex flex-col">
      <nav className="px-6 py-4 flex items-center justify-between border-b border-zinc-800/50">
        <Logo />
        <Link href="/" className="text-sm text-zinc-500 hover:text-white transition-colors">
          ← Back to home
        </Link>
      </nav>

      <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-16 space-y-8 text-zinc-400 leading-relaxed">
        <header>
          <p className="text-bitcoin text-xs uppercase tracking-widest font-mono mb-3">Privacy</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-white mb-3">
            What BitYield records
          </h1>
          <p>
            BitYield is in a closed beta. To understand how people find and use it, the app records
            some activity. This page lists exactly what, in plain language.
          </p>
        </header>

        <section className="space-y-2">
          <h2 className="font-semibold text-white">Never collected</h2>
          <p>
            Your seed phrase or private keys. BitYield never asks for them, and connecting a wallet only
            lets the app read your balance and prepare transactions for you to sign.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-white">Stored in your browser</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>An invite code, if you arrived through a personal invite link (<code className="text-zinc-300">?ref=</code>).</li>
            <li>
              An anonymous visitor id: a random value that is not derived from anything about you. It lets
              us tell a returning visitor from a new one.
            </li>
            <li>Where you first came from (the referring site and any campaign tags in the link) and how many sessions you have had.</li>
            <li>Your connected wallet address, kept by your wallet connection so you stay connected.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-white">Recorded on our side</h2>
          <p>
            When you visit, connect a wallet, or deposit or withdraw, the app sends us an event. Each event
            can include your visitor id, invite code, where you came from, the page, and a timestamp. Events
            for connecting a wallet and for deposits and withdrawals include your wallet address, the
            amount, the route and the transaction id. This is how a visitor id gets linked to a wallet
            address once you connect.
          </p>
          <p>
            Our server also notes your browser type and your country (coarse, from the hosting platform). It
            does not store your IP address. Events are kept in a spreadsheet that only the BitYield team can
            open.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-white">Already public</h2>
          <p>
            Deposits and withdrawals are transactions on the Stacks blockchain. Your wallet address, the
            amounts and the transaction ids are public on-chain, whether or not BitYield records them.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-white">Email</h2>
          <p>
            If you join the waitlist, your email address is stored with our email provider (Resend) so we can
            write to you about the launch.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-white">Other services that see some data</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Hiro, the Stacks API. Your browser reads balances and positions from it, so Hiro can see your IP address, as with any website you use.</li>
            <li>Vercel, which hosts the site and keeps standard server logs.</li>
            <li>Google, which hosts the spreadsheet our event log is kept in.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold text-white">Opting out</h2>
          <p>
            You can clear BitYield&apos;s site data in your browser settings at any time, which resets your
            visitor id. To ask about or remove data tied to your wallet address or email, reply to the
            message that invited you.
          </p>
        </section>
      </main>
    </div>
  );
}
