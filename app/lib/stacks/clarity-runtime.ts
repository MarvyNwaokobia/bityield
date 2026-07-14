// Runtime-safe Clarity type checks.
//
// `@stacks/transactions` is published with `sideEffects: false`. Under a
// production build (tree-shaking + `isolatedModules`), the bundler eliminates
// the `ClarityType` *enum object* from the output even though our code still
// references `ClarityType.Foo`. At runtime `ClarityType` is then `undefined`,
// so `ClarityType.ResponseOk` throws — and any `try/catch` around a read
// silently falls back (e.g. a real sBTC balance renders as 0). It works in
// `next dev` and in Node (no tree-shaking) but breaks only in the deployed
// build, which makes it nasty to catch.
//
// The enum's underlying values are plain strings that the library's own
// deserializer assigns to every ClarityValue's `.type`. Those string literals
// are inlined and cannot be tree-shaken, so we compare against them directly.
// Keep this map in sync with @stacks/transactions' ClarityType enum.
export const CT = {
  int: 'int',
  uint: 'uint',
  buffer: 'buffer',
  true: 'true',
  false: 'false',
  address: 'address',
  contract: 'contract',
  ok: 'ok',
  err: 'err',
  none: 'none',
  some: 'some',
  list: 'list',
  tuple: 'tuple',
  ascii: 'ascii',
  utf8: 'utf8',
} as const;

/** The `.type` wire-string of any ClarityValue (or undefined if not a CV). */
export function cvType(cv: unknown): string | undefined {
  return (cv as { type?: string } | null | undefined)?.type;
}
