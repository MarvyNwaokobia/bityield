// SERVER-ONLY. Never import this from a client component or from anything the
// browser bundles (lib/stacks/{contract,tx,balances,analytics}.ts stay anonymous).
//
// Hiro's free API key is sent as `x-api-key`. Hiro says keys must stay out of
// browser code (they can be scraped from dev tools), so the key is only attached
// on server routes: sponsor-tx (broadcast) and sponsor-health (balance check).
// Browser reads keep using Hiro anonymously, where each visitor's own IP gets
// its own rate limit instead of everyone sharing one key's limit.
//
// HIRO_API_KEY is optional: when unset nothing changes and calls go out
// anonymously. The key is only ever sent to *.hiro.so hosts. Hiro answers an
// invalid or revoked key with 403 (worse than anonymous, which is 200), so a
// rejected key falls back to one anonymous retry instead of breaking the route.
import { network } from './network';

type Client = NonNullable<
  Parameters<typeof import('@stacks/transactions').broadcastTransaction>[0]['client']
>;

const HIRO_API_KEY = process.env.HIRO_API_KEY?.trim();
const HIRO_HOST = /(^|\.)hiro\.so$/;

function isHiro(url: string): boolean {
  try {
    return HIRO_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

let warnedRejected = false;

/** fetch() that adds the Hiro key to Hiro hosts, retrying anonymously if the key is rejected. */
export async function hiroFetch(url: string, init?: RequestInit): Promise<Response> {
  if (!HIRO_API_KEY || !isHiro(url)) return fetch(url, init);

  const headers = new Headers(init?.headers);
  headers.set('x-api-key', HIRO_API_KEY);
  const res = await fetch(url, { ...init, headers });

  if (res.status === 401 || res.status === 403) {
    if (!warnedRejected) {
      warnedRejected = true;
      console.warn(
        `Hiro rejected HIRO_API_KEY (${res.status}); falling back to anonymous requests. Check the key.`
      );
    }
    return fetch(url, init);
  }
  return res;
}

/** stacks.js `client` option routing requests through hiroFetch (undefined when no key is set). */
export function hiroClient(): Client | undefined {
  if (!HIRO_API_KEY) return undefined;
  return { baseUrl: network.client.baseUrl, fetch: hiroFetch };
}
