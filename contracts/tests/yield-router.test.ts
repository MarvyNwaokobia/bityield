import { describe, expect, it } from "vitest";
import { Cl, ClarityType } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

const TOKEN = `${deployer}.mock-sbtc-token`;
const MOCK_STRATEGY = `${deployer}.mock-yield-strategy`;
const ZEST_STRATEGY = `${deployer}.zest-strategy`;
const HERMETICA_STRATEGY = `${deployer}.hermetica-strategy`;
const DUAL_STRATEGY = `${deployer}.dual-stacking-strategy`;
const ONE_SBTC = 100_000_000; // 1 sBTC == 1e8 sats

function mint(amount: number, recipient: string) {
  return simnet.callPublicFn("mock-sbtc-token", "mint", [Cl.uint(amount), Cl.principal(recipient)], deployer);
}

function registerStrategies() {
  simnet.callPublicFn(
    "yield-router",
    "add-strategy",
    [Cl.stringAscii("mock-yield"), Cl.principal(MOCK_STRATEGY)],
    deployer
  );
  simnet.callPublicFn(
    "yield-router",
    "add-strategy",
    [Cl.stringAscii("zest"), Cl.principal(ZEST_STRATEGY)],
    deployer
  );
  simnet.callPublicFn(
    "yield-router",
    "add-strategy",
    [Cl.stringAscii("hermetica"), Cl.principal(HERMETICA_STRATEGY)],
    deployer
  );
  simnet.callPublicFn(
    "yield-router",
    "add-strategy",
    [Cl.stringAscii("dual-stacking"), Cl.principal(DUAL_STRATEGY)],
    deployer
  );
}

describe("yield-router", () => {
  it("starts with the default 5% APY and zero TVL", () => {
    const rate = simnet.callReadOnlyFn("yield-router", "get-best-rate", [], deployer);
    expect(rate.result).toStrictEqual(
      Cl.tuple({
        strategy: Cl.stringAscii("mock-yield"),
        "apy-bps": Cl.uint(500),
        tvl: Cl.uint(0),
      })
    );
  });

  it("rejects a zero-amount deposit", () => {
    registerStrategies();
    mint(ONE_SBTC, wallet1);
    const result = simnet.callPublicFn(
      "yield-router",
      "deposit",
      [Cl.uint(0), Cl.stringAscii("mock-yield"), Cl.principal(MOCK_STRATEGY), Cl.principal(TOKEN)],
      wallet1
    );
    expect(result.result).toStrictEqual(Cl.error(Cl.uint(101)));
  });

  it("rejects an invalid token contract parameter", () => {
    registerStrategies();
    mint(ONE_SBTC, wallet1);
    
    // Temporarily point the router's sBTC token configuration to a dummy address (wallet1)
    simnet.callPublicFn("yield-router", "set-sbtc-token", [Cl.principal(wallet1)], deployer);

    // Call deposit with the real token: it should fail with ERR-INVALID-TOKEN (108)
    const result = simnet.callPublicFn(
      "yield-router",
      "deposit",
      [Cl.uint(50_000_000), Cl.stringAscii("mock-yield"), Cl.principal(MOCK_STRATEGY), Cl.principal(TOKEN)],
      wallet1
    );
    expect(result.result).toStrictEqual(Cl.error(Cl.uint(108)));

    // Restore the sBTC token configuration
    simnet.callPublicFn("yield-router", "set-sbtc-token", [Cl.principal(TOKEN)], deployer);
  });

  it("accepts a deposit, transfers the token to strategy, and records a position", () => {
    registerStrategies();
    mint(ONE_SBTC, wallet1);

    const depositAmount = 50_000_000; // 0.5 sBTC
    const deposit = simnet.callPublicFn(
      "yield-router",
      "deposit",
      [Cl.uint(depositAmount), Cl.stringAscii("mock-yield"), Cl.principal(MOCK_STRATEGY), Cl.principal(TOKEN)],
      wallet1
    );
    expect(deposit.result.type).toBe(ClarityType.ResponseOk);

    // Tokens moved from the depositor to the strategy contract.
    const strategyBalance = simnet.callReadOnlyFn(
      "mock-sbtc-token",
      "get-balance",
      [Cl.principal(MOCK_STRATEGY)],
      wallet1
    );
    expect(strategyBalance.result).toStrictEqual(Cl.ok(Cl.uint(depositAmount)));
  });

  it("supports dynamic routing to Zest, Hermetica, and Dual Stacking", () => {
    registerStrategies();
    mint(ONE_SBTC * 3, wallet2);

    const amount = 50_000_000; // 0.5 sBTC per strategy

    // Deposit into Zest (APY = 4.5% / 450 bps)
    const zestDeposit = simnet.callPublicFn(
      "yield-router",
      "deposit",
      [Cl.uint(amount), Cl.stringAscii("zest"), Cl.principal(ZEST_STRATEGY), Cl.principal(TOKEN)],
      wallet2
    );
    expect(zestDeposit.result.type).toBe(ClarityType.ResponseOk);
    const zestPosId = (zestDeposit.result as { value: { value: bigint } }).value.value;

    // Deposit into Hermetica (APY = 6.2% / 620 bps)
    const hermeticaDeposit = simnet.callPublicFn(
      "yield-router",
      "deposit",
      [Cl.uint(amount), Cl.stringAscii("hermetica"), Cl.principal(HERMETICA_STRATEGY), Cl.principal(TOKEN)],
      wallet2
    );
    expect(hermeticaDeposit.result.type).toBe(ClarityType.ResponseOk);
    const hermeticaPosId = (hermeticaDeposit.result as { value: { value: bigint } }).value.value;

    // Deposit into Dual Stacking (APY = 8.5% / 850 bps)
    const dualDeposit = simnet.callPublicFn(
      "yield-router",
      "deposit",
      [Cl.uint(amount), Cl.stringAscii("dual-stacking"), Cl.principal(DUAL_STRATEGY), Cl.principal(TOKEN)],
      wallet2
    );
    expect(dualDeposit.result.type).toBe(ClarityType.ResponseOk);
    const dualPosId = (dualDeposit.result as { value: { value: bigint } }).value.value;

    // Mine a year's worth of blocks (52560)
    simnet.mineEmptyBlocks(52560);

    // Mint extra to strategies to cover yield
    mint(10_000_000, ZEST_STRATEGY);
    mint(10_000_000, HERMETICA_STRATEGY);
    mint(10_000_000, DUAL_STRATEGY);

    // Zest payout: 50,000,000 * 450 * 52566 / 525600000 = 2,250,256 sats yield. Payout = 52,250,256
    const zestWithdraw = simnet.callPublicFn(
      "yield-router",
      "withdraw",
      [Cl.uint(Number(zestPosId)), Cl.principal(ZEST_STRATEGY), Cl.principal(TOKEN)],
      wallet2
    );
    // Hermetica payout: 50,000,000 * 620 * 52566 / 525600000 = 3,100,353 sats yield. Payout = 53,100,353
    // (Note: one extra block mined for Zest withdraw)
    const hermeticaWithdraw = simnet.callPublicFn(
      "yield-router",
      "withdraw",
      [Cl.uint(Number(hermeticaPosId)), Cl.principal(HERMETICA_STRATEGY), Cl.principal(TOKEN)],
      wallet2
    );
    expect(hermeticaWithdraw.result).toStrictEqual(Cl.ok(Cl.uint(53_100_353)));

    // Dual payout: 50,000,000 * 850 * 52566 / 525600000 = 4,250,485 sats yield. Payout = 54,250,485
    // (Note: one more block mined for Hermetica withdraw)
    const dualWithdraw = simnet.callPublicFn(
      "yield-router",
      "withdraw",
      [Cl.uint(Number(dualPosId)), Cl.principal(DUAL_STRATEGY), Cl.principal(TOKEN)],
      wallet2
    );
    expect(dualWithdraw.result).toStrictEqual(Cl.ok(Cl.uint(54_250_485)));
  });
});
