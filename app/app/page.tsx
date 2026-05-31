import WaitlistForm from './components/WaitlistForm';

const PROBLEM_CARDS = [
  '"$1.3 trillion in Bitcoin is sitting completely idle right now."',
  '"73% of Bitcoin holders want yield. 77% have never tried."',
  '"The infrastructure exists. The simple front door does not. Until now."',
];

const HOW_STEPS = [
  { n: '01', title: 'Connect your Bitcoin wallet' },
  { n: '02', title: 'See your balance and your yield rate' },
  { n: '03', title: 'Press one button. Your Bitcoin goes to work.' },
];

const STATS = [
  { value: '$545M', label: 'Bitcoin already deployed on Stacks' },
  { value: '$100M+', label: 'Capital earning yield through Dual Stacking' },
  { value: '$70M+', label: 'Deposits on Zest Protocol' },
  { value: '5% APY', label: 'Paid in Bitcoin, not tokens' },
];

export default function Home() {
  return (
    <div className="bg-[#0a0a0a] text-white min-h-screen">

      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between border-b border-zinc-800/50 bg-[#0a0a0a]/90 backdrop-blur-sm">
        <span className="font-bold text-xl tracking-tight select-none">
          Bit<span className="text-[#F7931A]">Yield</span>
        </span>
        <a
          href="#waitlist"
          className="bg-[#F7931A] text-black font-semibold px-5 py-2 rounded-lg text-sm hover:bg-[#e8841a] transition-colors"
        >
          Join the Waitlist
        </a>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-36 pb-24 px-6 text-center max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
          Hold Bitcoin.{' '}
          <span className="text-[#F7931A]">Earn Bitcoin.</span>
        </h1>
        <p className="text-xl md:text-2xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Your idle Bitcoin earns up to 5% APY — paid in Bitcoin, not tokens. One tap.
        </p>
        <a
          href="#waitlist"
          className="inline-block bg-[#F7931A] text-black font-bold px-10 py-5 rounded-xl text-lg hover:bg-[#e8841a] transition-colors mb-5"
        >
          Join the Waitlist
        </a>
        <p className="text-sm text-zinc-500">
          Live yield infrastructure. Real Bitcoin returns. No DeFi knowledge required.
        </p>
      </section>

      {/* ── Problem ── */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PROBLEM_CARDS.map((text, i) => (
            <div
              key={i}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8"
            >
              <p className="text-zinc-300 text-lg leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <p className="text-[#F7931A] font-mono text-sm uppercase tracking-widest text-center mb-14">
          Simple as it gets.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {HOW_STEPS.map(({ n, title }) => (
            <div key={n} className="flex flex-col gap-4">
              <span className="text-6xl font-bold text-[#F7931A] opacity-30 leading-none">
                {n}
              </span>
              <p className="text-xl text-white font-medium leading-snug">{title}</p>
            </div>
          ))}
        </div>
        <p className="text-zinc-500 text-center mt-14 text-base">
          No wrapping. No bridges. No DeFi terminology. Just Bitcoin earning Bitcoin.
        </p>
      </section>

      {/* ── Proof ── */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <p className="text-[#F7931A] font-mono text-sm uppercase tracking-widest text-center mb-14">
          The infrastructure is real.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {STATS.map(({ value, label }) => (
            <div
              key={value}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center"
            >
              <p className="text-3xl md:text-4xl font-bold text-[#F7931A] leading-tight">
                {value}
              </p>
              <p className="text-zinc-500 text-sm mt-3 leading-snug">{label}</p>
            </div>
          ))}
        </div>
        <p className="text-zinc-600 text-center text-sm mt-8">
          Yield rates are live today. BitYield is the interface that makes them accessible.
        </p>
      </section>

      {/* ── Who It&apos;s For ── */}
      <section className="py-20 px-6 max-w-3xl mx-auto text-center">
        <p className="text-xl md:text-2xl text-zinc-300 leading-relaxed">
          BitYield is built for Bitcoin holders who want their Bitcoin to work harder.
        </p>
      </section>

      {/* ── Waitlist CTA ── */}
      <section id="waitlist" className="py-24 px-6 bg-zinc-950">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Be first.</h2>
          <p className="text-xl text-zinc-400 mb-10 leading-relaxed">
            BitYield is in active development. Join the waitlist and be among the first
            Bitcoin holders to put their BTC to work.
          </p>
          <WaitlistForm />
          <p className="text-sm text-zinc-600 mt-5">
            One email when it is ready.
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-800 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
          <span className="font-bold text-xl tracking-tight select-none">
            Bit<span className="text-[#F7931A]">Yield</span>
          </span>
          <p className="text-zinc-500">Built on Stacks. Secured by Bitcoin.</p>
          <a
            href="https://github.com/MarvyNwaokobia/bityield"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-white transition-colors"
          >
            github.com/MarvyNwaokobia/bityield
          </a>
        </div>
      </footer>

    </div>
  );
}
