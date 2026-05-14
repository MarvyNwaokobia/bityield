export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <div className="max-w-xl w-full text-center space-y-8">

        <div className="space-y-2">
          <p className="text-sm text-orange-400 font-mono uppercase tracking-widest">
            Built on Stacks · Bitcoin L2
          </p>
          <h1 className="text-5xl font-bold tracking-tight">
            BitYield
          </h1>
          <p className="text-xl text-zinc-400">
            Your Bitcoin earns 0% right now.
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-4">
          <p className="text-zinc-300 text-lg leading-relaxed">
            BitYield connects passive Bitcoin holders to live yield
            on Stacks — Zest Protocol, Hermetica, Dual Stacking —
            in under two minutes. No DeFi knowledge required.
          </p>
          <p className="text-zinc-500 text-sm">
            Currently in validation. Building after signal confirmed.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-zinc-900 rounded-xl p-4">
            <p className="text-2xl font-bold text-orange-400">$545M</p>
            <p className="text-xs text-zinc-500 mt-1">sBTC TVL on Stacks</p>
          </div>
          <div className="bg-zinc-900 rounded-xl p-4">
            <p className="text-2xl font-bold text-orange-400">$500M+</p>
            <p className="text-xs text-zinc-500 mt-1">BTC yield paid out</p>
          </div>
          <div className="bg-zinc-900 rounded-xl p-4">
            <p className="text-2xl font-bold text-orange-400">10%</p>
            <p className="text-xs text-zinc-500 mt-1">APY available today</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            className="w-full bg-orange-500 hover:bg-orange-400 text-black font-semibold py-4 px-8 rounded-xl text-lg transition-colors cursor-not-allowed opacity-75"
            disabled
          >
            Connect Wallet — Coming Soon
          </button>
          <p className="text-xs text-zinc-600">
            Validation in progress · May–June 2026 ·
            Stacks Foundry: Validate cohort
          </p>
        </div>

      </div>
    </main>
  );
}
