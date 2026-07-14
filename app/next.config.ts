import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @stacks/* packages ship with `sideEffects: false`, which lets the
  // production tree-shaker drop the `ClarityType` enum's initializer while
  // keeping code that reads `ClarityType.Foo` — so at runtime the enum is
  // `undefined`. That silently breaks every Clarity value the library builds
  // (deserialized read results get `type: undefined`) and the CVs we pass to
  // deposit/withdraw. It only surfaces in the production build (dev and Node
  // don't tree-shake). Transpiling these packages through Next's own pipeline
  // keeps the enum as a real runtime object.
  transpilePackages: [
    "@stacks/transactions",
    "@stacks/network",
    "@stacks/connect",
    "@stacks/common",
  ],
};

export default nextConfig;
