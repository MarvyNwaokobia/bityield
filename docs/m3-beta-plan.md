# Milestone 3 Plan: Closed Beta + On-Chain Adoption Evidence

## 1. The milestone, in one paragraph

Unlike M1 and M2, this is not primarily an engineering milestone. The
contracts and app already work end to end on mainnet (see the README
[Status](../README.md#status) section). M3 is proving real people can use
them: invite real Bitcoin holders, get them through a real mainnet deposit
with no hand-holding, and document it. The engineering here exists only to
make that provable — recruiting the actual users is the real work and it's
on Marvy, not something more code produces.

## 2. Usage thresholds (all required)

| # | Requirement | How it's measured |
|---|---|---|
| 1 | >=15 closed beta users invited | Invite list (section 4) |
| 2 | >=10 connect a wallet through BitYield | `wallet_connected` events (section 3) |
| 3 | >=5 non-team users complete a mainnet deposit | `deposit_completed` events + on-chain tx |
| 4 | >=5 total mainnet deposit transactions | On-chain, cross-check against `deposit_completed` |
| 5 | >=$1,000 equivalent aggregate deposits | Sum of `amountSats` across `deposit_completed` events |
| 6 | >=3 users complete the flow with no founder assistance | Section 5 |
| 7 | >=5 users give structured feedback | Feedback form responses (section 6) |

## 3. Funnel tracking (built)

Three events fire automatically and land wherever `BETA_EVENTS_WEBHOOK_URL`
points (a Google Sheet via Apps Script, Zapier, Make, or anything that
accepts a JSON POST — same pattern as the waitlist, see `app/.env.example`):

- `wallet_connected` — fires in `lib/stacks/wallet.tsx` right after a wallet
  connects. Carries `wallet`, `ref`.
- `deposit_attempted` — fires in `app/deposit/page.tsx` when the user
  confirms a deposit (before signing). Carries `wallet`, `strategy`,
  `amountSats`, `ref`.
- `deposit_completed` — fires once the deposit tx is confirmed on-chain.
  Carries `wallet`, `strategy`, `amountSats`, `txid`, `ref`.

Each invitee gets a personal link, `https://bityield.click/?ref=<code>`
(pick short codes, e.g. first names). The code is captured into
`localStorage` on first load (`app/components/ReferralCapture.tsx`) and
attached to every event from then on, so responses in the funnel sheet and
the feedback form (section 6) can be tied back to a specific invitee without
anyone pre-registering a wallet.

**Setup before inviting anyone:** point `BETA_EVENTS_WEBHOOK_URL` (Vercel env,
production) at a real destination. Without it, events are silently dropped
in production — the app still works, but nothing is recorded.

**What this does NOT replace:** completed deposits are also independently
verifiable on-chain (`/proof`, the router's `get-position` reads, Hiro
Explorer against the M2 deployer address) — the events are for the funnel
steps that never touch the chain (invited, connected, attempted), and for
correlating a completion with a specific beta user's feedback.

## 4. Invite list (manual, off-platform)

A spreadsheet (or Notion table) with one row per invitee:

| Name/handle | Ref code | Invited on | Wallet connected? | Deposited? | Feedback given? | Team member? |

Recruit from: the existing landing-page waitlist (Resend audience), Stacks
Discord/forum, personal network. Aim for meaningfully more than 15 invited —
not everyone invited converts, and the thresholds are on *completions*, not
invites.

## 5. Independent completion (no code, a discipline)

At least 3 of the 5+ non-team depositors must complete connect → deposit
with zero founder assistance — no screen-share, no "click here next," no
live troubleshooting. Practically: send the link and written instructions
only, then go quiet until they report back (or the funnel events show
`deposit_completed`) for at least 3 named invitees. Note in the invite-list
spreadsheet which ones these were — the final grant update needs to name
them as evidence, not just claim the number.

## 6. Feedback (external form, not built)

Create a short form (Google Form / Typeform — pick one, paste the link into
`NEXT_PUBLIC_FEEDBACK_FORM_URL`) covering what the milestone asks for:

1. What ref code or wallet address did you use? *(for correlation)*
2. How did the deposit flow feel — confusing anywhere, or smooth?
3. Before depositing, did you feel like you understood where your Bitcoin
   was actually going and what could go wrong? What made you trust it (or
   not)?
4. Did the risk & disclosures panel give you what you needed, or did you
   want more/different information before confirming?
5. Would you use BitYield again with a larger amount? Why or why not?
6. Anything that felt untrustworthy, unclear, or broken?

Link this in the beta invite message and it's also surfaced automatically on
the deposit success screen (section 3).

## 7. Final grant update (deliverable)

A single writeup linking: the live product (bityield.click), this repo, docs
(this file + `docs/m2-testing-guide.md` + README), the demo video, on-chain
transaction evidence (the `/proof` page + explorer links, same format as the
README's M2 evidence tables), a summary of the beta results against each
threshold in section 2, a summary of feedback themes from section 6, and
known limitations (unaudited contracts, single-key ownership, Hermetica
still preview — see README [Roadmap](../README.md#roadmap)).

## 8. Completion checklist

- [ ] `BETA_EVENTS_WEBHOOK_URL` configured in production
- [ ] Feedback form created, `NEXT_PUBLIC_FEEDBACK_FORM_URL` configured
- [ ] Invite list started, >=15 invited
- [ ] >=10 wallet connections
- [ ] >=5 non-team completed deposits, >=5 total tx, >=$1,000 aggregate
- [ ] >=3 named independent completions
- [ ] >=5 feedback responses
- [ ] Final grant update published
