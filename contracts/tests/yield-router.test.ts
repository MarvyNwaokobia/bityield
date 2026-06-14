import { describe, expect, it } from "vitest";
import { Cl, ClarityType } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

const TOKEN = `${deployer}.mock-sbtc-token`;
const ONE_SBTC = 100_000_000; // 1 sBTC == 1e8 sats

function mint(amount: number, recipient: string) {
  return simnet.callPublicFn("mock-sbtc-token", "mint", [Cl.uint(amount), Cl.principal(recipient)], deployer);
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
    mint(ONE_SBTC, wallet1);
    const result = simnet.callPublicFn(
      "yield-router",
      "deposit",
      [Cl.uint(0), Cl.stringAscii("mock-yield"), Cl.principal(TOKEN)],
      wallet1
    );
    expect(result.result).toStrictEqual(Cl.error(Cl.uint(101)));
  });

  it("accepts a deposit, transfers the token, and records a position", () => {
    mint(ONE_SBTC, wallet1);

    const depositAmount = 50_000_000; // 0.5 sBTC
    const deposit = simnet.callPublicFn(
      "yield-router",
      "deposit",
      [Cl.uint(depositAmount), Cl.stringAscii("mock-yield"), Cl.principal(TOKEN)],
      wallet1
    );
    expect(deposit.result).toStrictEqual(Cl.ok(Cl.uint(0)));

    // Tokens moved from the depositor to the router contract.
    const routerBalance = simnet.callReadOnlyFn(
      "mock-sbtc-token",
      "get-balance",
      [Cl.principal(`${deployer}.yield-router`)],
      wallet1
    );
    expect(routerBalance.result).toStrictEqual(Cl.ok(Cl.uint(depositAmount)));

    const position = simnet.callReadOnlyFn(
      "yield-router",
      "get-position",
      [Cl.principal(wallet1), Cl.uint(0)],
      wallet1
    );
    expect(position.result).toStrictEqual(
      Cl.some(
        Cl.tuple({
          amount: Cl.uint(depositAmount),
          strategy: Cl.stringAscii("mock-yield"),
          "entry-block": Cl.uint(simnet.blockHeight),
          "apy-bps": Cl.uint(500),
          closed: Cl.bool(false),
        })
      )
    );

    const ids = simnet.callReadOnlyFn(
      "yield-router",
      "get-all-position-ids",
      [Cl.principal(wallet1)],
      wallet1
    );
    expect(ids.result).toStrictEqual(Cl.list([Cl.uint(0)]));
  });

  it("only the contract owner can change the APY", () => {
    const unauthorized = simnet.callPublicFn(
      "yield-router",
      "set-apy",
      [Cl.uint(700)],
      wallet1
    );
    expect(unauthorized.result).toStrictEqual(Cl.error(Cl.uint(100)));

    const authorized = simnet.callPublicFn(
      "yield-router",
      "set-apy",
      [Cl.uint(700)],
      deployer
    );
    expect(authorized.result).toStrictEqual(Cl.ok(Cl.uint(700)));

    const rate = simnet.callReadOnlyFn("yield-router", "get-best-rate", [], deployer);
    expect(rate.result).toStrictEqual(
      Cl.tuple({
        strategy: Cl.stringAscii("mock-yield"),
        "apy-bps": Cl.uint(700),
        tvl: Cl.uint(0),
      })
    );
  });

  it("accrues yield over time and pays out principal + yield on withdrawal", () => {
    // Reset to the default 5% APY regardless of state left over from earlier tests.
    simnet.callPublicFn("yield-router", "set-apy", [Cl.uint(500)], deployer);

    mint(ONE_SBTC, wallet2);

    const depositAmount = 100_000_000; // 1 sBTC, APY = 500 bps at this point
    const deposit = simnet.callPublicFn(
      "yield-router",
      "deposit",
      [Cl.uint(depositAmount), Cl.stringAscii("mock-yield"), Cl.principal(TOKEN)],
      wallet2
    );
    const positionId = (deposit.result as { value: { value: bigint } }).value.value;

    // Mine a year's worth of blocks so the accrued yield is easy to predict:
    // 1 sBTC * 500 bps / 10000 == 0.05 sBTC == 5_000_000 sats.
    simnet.mineEmptyBlocks(52560);

    const before = simnet.callReadOnlyFn(
      "yield-router",
      "get-position-value",
      [Cl.principal(wallet2), Cl.uint(Number(positionId))],
      wallet2
    );
    expect(before.result).toStrictEqual(
      Cl.some(
        Cl.tuple({
          amount: Cl.uint(depositAmount),
          "accrued-yield": Cl.uint(5_000_000),
          closed: Cl.bool(false),
        })
      )
    );

    // The withdraw call itself mines one more block than the read above, so
    // accrued yield is computed over 52561 blocks: 5_000_000 + floor(5_000_000 / 52560).
    const payout = depositAmount + 5_000_095;

    const withdraw = simnet.callPublicFn(
      "yield-router",
      "withdraw",
      [Cl.uint(Number(positionId)), Cl.principal(TOKEN)],
      wallet2
    );
    expect(withdraw.result).toStrictEqual(Cl.ok(Cl.uint(payout)));

    const balance = simnet.callReadOnlyFn(
      "mock-sbtc-token",
      "get-balance",
      [Cl.principal(wallet2)],
      wallet2
    );
    expect(balance.result).toStrictEqual(Cl.ok(Cl.uint(payout)));
  });

  it("cannot withdraw a position twice", () => {
    mint(ONE_SBTC, wallet1);
    const deposit = simnet.callPublicFn(
      "yield-router",
      "deposit",
      [Cl.uint(10_000_000), Cl.stringAscii("mock-yield"), Cl.principal(TOKEN)],
      wallet1
    );
    const positionId = (deposit.result as { value: { value: bigint } }).value.value;

    const first = simnet.callPublicFn(
      "yield-router",
      "withdraw",
      [Cl.uint(Number(positionId)), Cl.principal(TOKEN)],
      wallet1
    );
    expect(first.result.type).toBe(ClarityType.ResponseOk);

    const second = simnet.callPublicFn(
      "yield-router",
      "withdraw",
      [Cl.uint(Number(positionId)), Cl.principal(TOKEN)],
      wallet1
    );
    expect(second.result).toStrictEqual(Cl.error(Cl.uint(103)));
  });

  it("returns an error for a position that does not exist", () => {
    const result = simnet.callPublicFn(
      "yield-router",
      "withdraw",
      [Cl.uint(9999), Cl.principal(TOKEN)],
      wallet1
    );
    expect(result.result).toStrictEqual(Cl.error(Cl.uint(102)));
  });
});
