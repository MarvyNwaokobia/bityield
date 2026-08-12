# Outreach draft: Stacks team, sBTC Dual Stacking integration

Purpose: confirm the one external dependency for Milestone 2 Route 2 (Dual
Stacking) before building. Two hard asks: (1) does reward distribution include
enrolled **contract** principals, and (2) is `enroll-defi` the right registration
path for us. See [milestone-2-plan.md](milestone-2-plan.md) section 3 (Route 2)
and section 12 (checklist track B).

Who operates it: the rewards program `SP804...sbtc-yield-rewards-v3` is a
first-party Stacks program (driven on-chain by `dual-stacking-v3_0_0` at deployer
`SP1HFCRKEJ8BYW4D0E3FAWHFDX8A25PPAA83HWWZ9`; Dual Stacking lives on app.stacks.co).
Operated by the Stacks Foundation / Stacks Labs, i.e. the same org behind the
grant, not a third-party dApp with its own support desk.

Who to contact, in order:
1. Your Stacks Endowment / grant contact FIRST (warmest, most reliable). Ask them
   to route you to the owner of the sBTC Dual Stacking rewards contracts.
2. Stacks Discord (invite linked from stacks.co / docs.stacks.co) - post in the
   sBTC / developers channel, referencing the contract id below.
3. Stacks Forum sBTC working group weekly megathread
   (forum.stacks.org/t/sbtc-updates-weekly-megathread/14860).
4. Clarity Working Group call (every other Tuesday; open to grant project teams).

Lead with the contract id `SP804CDG3KBN9M6E00AD744K8DC697G7HBCG520Q.sbtc-yield-rewards-v3`
and the two precise questions below - a specific on-chain question gets routed to
the right engineer; a generic one gets a generic reply.

Before sending: fill the exact strategy principal only once the live
`dual-stacking-strategy` is deployed (it does not exist yet). The draft promises
it "the moment it's deployed" rather than inventing an address.

---

**Subject: BitYield (Endowment grantee) integrating sBTC Dual Stacking, two enrollment questions**

Hi [name],

I'm Marvellous Nwaokobia from BitYield, a Stacks Endowment grantee. We're a consumer app that routes Bitcoin holders' sBTC into live Stacks yield sources through annon-custodial router plus pluggable strategy contracts. For Milestone 2 we're integrating two routes: Zest lending and **sBTC Dual Stacking**.

For the Dual Stacking side we've studied the deployed rewards program
`SP804CDG3KBN9M6E00AD744K8DC697G7HBCG520Q.sbtc-yield-rewards-v3`. Our design is: a
BitYield strategy contract holds users' sBTC and enrolls in the program, so the
sBTC-denominated rewards accrue to that contract, which we then attribute back to
individual users. Before we build against it, three questions:

1. **Contract enrollment and distribution.** `enroll` has no
   `tx-sender`/`contract-caller` restriction and only checks the caller's sBTC
   balance against the minimum, so a contract can enroll itself. Does your reward
   distribution (`distribute-rewards`) include enrolled **contract** principals
   the same way it includes wallets, or is there anything about a contract
   participant that would cause it to be skipped?

2. **`enroll-defi` registration.** We saw the admin-gated
   `enroll-defi (defi-contract principal ...)`, which looks purpose-built for
   protocol integrations like ours. Is that the preferred path for a DeFi app,
   and if so, what do you need from us to register our strategy contract? Our
   contract will be deployed under
   `SP360GQARJRHQEFBW21RP957MC8YPJYHYJQTPKVFN` (we can share the exact strategy
   principal the moment it's deployed).

3. **Current version.** Is `sbtc-yield-rewards-v3` the active program we should
   target, or is a newer version live or imminent? We noticed a `-v2` also exists
   and want to build against the right one.

Happy to share our architecture doc or hop on a short call. We're aiming to have
this route live on mainnet within the next few weeks, so any guidance on the
enrollment path would help us sequence correctly.

Thanks,
[your name]
[BitYield link / contact]
