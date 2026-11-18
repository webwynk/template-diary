import "server-only";

import { lookup as dnsLookup } from "node:dns";
import { BlockList, isIP, type LookupFunction } from "node:net";

import { Agent, fetch } from "undici";

// SSRF guard for the screenshot renderer (RULES.md §7, DEVELOPMENT.md Phase 6).
//
// Template code runs in headless Chrome on our server, so every network request it makes is
// intercepted and fetched here instead. Two checks keep it away from internal services:
//  1. URLs whose host is an IP literal are checked before connecting (and on every redirect).
//  2. Host names are resolved by our own `lookup`, which refuses private addresses. Node uses
//     the address that lookup returns for the connection itself, so a DNS answer can't change
//     between the check and the connect (no DNS rebinding window).

const BLOCKED = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, cloud metadata (169.254.169.254)
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // 6to4 relay
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, broadcast
] as const) {
  BLOCKED.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  ["100::", 64], // discard
  ["2001:db8::", 32], // documentation
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["fec0::", 10], // old site-local
  ["ff00::", 8], // multicast
] as const) {
  BLOCKED.addSubnet(net, prefix, "ipv6");
}

/** IPv4 embedded in an IPv6 address (IPv4-mapped ::ffff:a.b.c.d, NAT64 64:ff9b::/96), if any. */
function embeddedIPv4(ip: string): string | null {
  const lower = ip.toLowerCase();
  const dotted = /^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (dotted) return dotted[1]!;
  const hex = /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (hex) {
    const hi = parseInt(hex[1]!, 16);
    const lo = parseInt(hex[2]!, 16);
    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  }
  return null;
}

/** True for loopback, private, link-local, metadata, multicast and other non-public addresses. */
export function isBlockedAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return BLOCKED.check(ip, "ipv4");
  if (family === 6) {
    const v4 = embeddedIPv4(ip);
    if (v4) return BLOCKED.check(v4, "ipv4");
    // Strip a zone id ("fe80::1%eth0"); BlockList doesn't accept it.
    return BLOCKED.check(ip.split("%")[0]!, "ipv6");
  }
  return true; // not an IP address at all
}

/** Hostname of a URL without IPv6 brackets. */
function hostOf(url: URL): string {
  return url.hostname.replace(/^\[|\]$/g, "");
}

export class BlockedRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedRequestError";
  }
}

/** Throws when a URL may not be fetched: non-http(s), credentials, or a blocked IP literal. */
export function assertFetchableUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedRequestError("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedRequestError(`Blocked scheme ${url.protocol}`);
  }
  if (url.username || url.password) throw new BlockedRequestError("Blocked credentials in URL");
  const host = hostOf(url);
  if (host === "" || /^localhost$|\.localhost$|\.local$|\.internal$/i.test(host)) {
    throw new BlockedRequestError(`Blocked host ${host}`);
  }
  if (isIP(host) && isBlockedAddress(host))
    throw new BlockedRequestError(`Blocked address ${host}`);
  return url;
}

/** dns.lookup that refuses names resolving to any blocked address. */
export const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 0);
    const list = addresses as unknown as { address: string; family: number }[];
    if (list.length === 0 || list.some((a) => isBlockedAddress(a.address))) {
      const blocked = Object.assign(new Error(`Blocked address for ${hostname}`), {
        code: "EBLOCKED",
      });
      return callback(blocked, "", 0);
    }
    if (options.all) {
      (callback as unknown as (e: null, a: typeof list) => void)(null, list);
    } else {
      callback(null, list[0]!.address, list[0]!.family);
    }
  });
};

let agent: Agent | null = null;
function guardedAgent(): Agent {
  agent ??= new Agent({
    connect: { lookup: guardedLookup, timeout: 5_000 },
    headersTimeout: 8_000,
    bodyTimeout: 8_000,
  });
  return agent;
}

export interface GuardedResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

const MAX_REDIRECTS = 5;
// Headers Chrome must not receive from a proxied response.
const DROP_HEADERS = new Set([
  "content-encoding", // undici already decoded the body
  "content-length",
  "transfer-encoding",
  "connection",
  "set-cookie",
  "alt-svc",
  "strict-transport-security",
]);

/**
 * GET a public URL with the guard on every hop. The body is capped at `maxBytes`.
 * Throws BlockedRequestError for blocked targets and plain errors for network failures.
 */
export async function guardedFetch(
  raw: string,
  {
    maxBytes,
    signal,
    headers,
  }: { maxBytes: number; signal?: AbortSignal; headers?: Record<string, string> },
): Promise<GuardedResponse> {
  let url = assertFetchableUrl(raw);
  for (let hop = 0; ; hop++) {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      dispatcher: guardedAgent(),
      signal,
      headers,
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel();
      if (hop >= MAX_REDIRECTS) throw new BlockedRequestError("Too many redirects");
      url = assertFetchableUrl(new URL(location, url).href);
      continue;
    }
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > maxBytes) {
      await response.body?.cancel();
      throw new BlockedRequestError("Response too large");
    }
    const chunks: Buffer[] = [];
    let size = 0;
    if (response.body) {
      for await (const chunk of response.body) {
        size += chunk.byteLength;
        if (size > maxBytes) throw new BlockedRequestError("Response too large");
        chunks.push(Buffer.from(chunk));
      }
    }
    const out: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      if (!DROP_HEADERS.has(key.toLowerCase())) out[key] = value;
    });
    return { status: response.status, headers: out, body: Buffer.concat(chunks) };
  }
}
