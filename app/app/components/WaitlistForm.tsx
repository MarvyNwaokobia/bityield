'use client';

import { useState } from 'react';

export default function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    const existing: string[] = JSON.parse(localStorage.getItem('bityield_waitlist') || '[]');
    if (!existing.includes(email)) {
      existing.push(email);
      localStorage.setItem('bityield_waitlist', JSON.stringify(existing));
    }
    setSubmitted(true);
    setError('');
  }

  if (submitted) {
    return (
      <div className="bg-zinc-900 border border-[#F7931A]/40 rounded-2xl p-8 text-center">
        <p className="text-[#F7931A] font-semibold text-xl mb-2">You are on the list.</p>
        <p className="text-zinc-400">We will be in touch when BitYield is ready.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(''); }}
          placeholder="your@email.com"
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-5 py-4 text-white placeholder-zinc-600 focus:outline-none focus:border-[#F7931A] transition-colors text-base"
        />
        <button
          type="submit"
          className="bg-[#F7931A] text-black font-bold px-8 py-4 rounded-xl text-base hover:bg-[#e8841a] transition-colors whitespace-nowrap cursor-pointer"
        >
          Join the Waitlist
        </button>
      </div>
      {error && <p className="text-red-400 text-sm text-left">{error}</p>}
    </form>
  );
}
