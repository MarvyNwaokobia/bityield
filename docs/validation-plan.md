# BitYield — Validation Plan

## Program
Stacks Foundry: Validate, May 18 to June 19 2026
Operated by: Stacks Endowment and Stacks Labs

## Core assumption

The barrier to Bitcoin yield on Stacks is primarily a UX and communication
problem, not a trust or risk problem.

If this is true, a simple interface with honest framing will convert passive
BTC holders into active sBTC depositors.

If this is false, the hesitation runs deeper — custody concerns, fundamental
risk aversion, or protocol trust — and a different approach is needed before
building.

---

## Target participant profile

Qualifies:
- Owns at least 0.05 BTC
- Holds on an exchange like Coinbase, Kraken, or Binance, or on a hardware
  wallet like Ledger or Trezor
- Has not used Stacks, sBTC, or any DeFi protocol before
- Aware that crypto yield exists but has not pursued it

Does not qualify:
- Existing Stacks or DeFi users — already converted, gives wrong signal
- People who have never bought Bitcoin — a different problem entirely
- Anyone who works in crypto professionally

---

## Research rounds

Round 1: Discovery interviews, Week 1 to 2
Goal: understand the real hesitation, not the stated hesitation
Method: 30-minute video calls with 10 to 15 participants
Format: unstructured conversation starting from the participant's own story

Key questions:
1. Walk me through the last time you thought about doing something with
   your Bitcoin and decided not to.
2. What would have to be true for you to feel comfortable putting some
   of it to work?
3. When I say your Bitcoin earns yield while staying on Bitcoin L1 under
   your own keys, what is your first reaction?
4. What would make you trust a new interface with your Bitcoin?
5. If a friend recommended a Bitcoin yield product, what would you look
   for before trying it?

What we are listening for:
- Is the hesitation about complexity? Solvable with better UX.
- Is it about risk? Solvable with trust signals and education.
- Is it about custody? Solvable with sBTC's unique on-chain guarantee.
- Is it about awareness? Solvable with distribution.
- Is it something else entirely? Means the assumption is wrong.

---

Round 2: Concept test, Week 3
Goal: does the framing convert? Does the interface make immediate sense?
Method: show a static Figma mockup to 10 to 15 participants
Key screen: a dashboard showing the participant's BTC balance alongside
the message Your Bitcoin is earning 0% right now. Start earning 6.2%
in Bitcoin with a single button.

Observe:
- Do they click Start Earning without being asked?
- What questions do they ask before clicking?
- What stops them if they hesitate?
- Does the phrase your Bitcoin stays on Bitcoin L1 change their decision?

Success signal: more than 40% click without prompting

---

Round 3: Prototype test, Week 4
Goal: does the actual deposit flow complete?
Method: interactive prototype running on Stacks testnet
Flow tested: Connect wallet → Enter amount → Confirm → See position

Measure drop-off at each step:
1. Wallet connection — expected high completion, low friction step
2. Amount entry — expected some drop-off, first commitment point
3. Strategy selection — expected some confusion, needs testing
4. Confirmation — expected highest drop-off, last chance to abandon
5. Position view — reaching this screen equals success

Success signal: more than 25% full completion rate

---

## Success criteria summary

| Signal                                    | Threshold | Interpretation              |
|-------------------------------------------|-----------|-----------------------------|
| Clicks Start Earning in concept test      | > 40%     | Framing works               |
| Completes full deposit on testnet         | > 25%     | Flow works                  |
| Cites too complicated as main objection   | < 20%     | Complexity is solved        |
| Would recommend to another BTC holder     | > 50%     | Core value is real          |

---

## What would prove the assumption wrong

Scenario 1: Users complete the flow but say they would not use real money.
This is a trust problem, not a UX problem. Requires a different approach.

Scenario 2: Users cite BTC leaving L1 as a dealbreaker even after the
sBTC guarantee is explained clearly.
This is a perception problem too deep to solve with interface design alone.

Scenario 3: Fewer than 10% of participants complete the prototype deposit.
Either the wrong target user or the wrong flow. Needs fundamental rethink.

Scenario 4: Most participants who complete everything are already Stacks
users who want a better interface.
Wrong target user. Need tighter definition and different recruitment.

---

## Recruitment plan

Sources for finding qualified participants:
- Bitcoin-focused Twitter and X accounts discussing yield hesitation
- Reddit communities like r/Bitcoin for users asking what to do with BTC
- Hardware wallet user communities on Ledger and Trezor forums
- Personal network contacts who hold BTC passively
- Stacks community referrals used only as a contrast group

Target: 30 qualified participants across all three rounds

---

## Decision framework for Week 5

Build: signal shows more than 25% prototype completion and positive
framing response. Action: begin v0.1 development with YieldRouter
contract and deposit flow.

Pivot: flow converts but the wrong user demographic responds strongly.
Action: redefine target user and run a focused retest.

Narrow: one yield protocol resonates much more than others.
Action: build a single-protocol version first, for example Zest only,
before adding more complexity.

Stop: fewer than 10% completion across all tests and a clear fundamental
trust barrier that UX cannot solve. Action: document all findings clearly
and explore a different opportunity in the ecosystem.
