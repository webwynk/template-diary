// @vitest-environment node
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import {
  assertFetchableUrl,
  BlockedRequestError,
  guardedFetch,
  guardedLookup,
  isBlockedAddress,
} from "@/lib/screenshot/net-guard";

vi.mock("server-only", () => ({}));

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fe80::1",
    "fd00::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "64:ff9b::a9fe:a9fe",
    "not-an-ip",
  ])("blocks %s", (ip) => expect(isBlockedAddress(ip)).toBe(true));

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])(
    "allows %s",
    (ip) => expect(isBlockedAddress(ip)).toBe(false),
  );
});

describe("assertFetchableUrl", () => {
  it.each([
    "file:///etc/passwd",
    "ftp://example.com/x",
    "http://127.0.0.1/",
    "http://2130706433/", // 127.0.0.1 as a number; the URL parser normalizes it
    "http://0x7f.1/",
    "http://[::1]/",
    "http://[::ffff:169.254.169.254]/",
    "http://localhost:3000/",
    "http://db.internal/",
    "http://user:pass@example.com/",
    "nonsense",
  ])("refuses %s", (url) => expect(() => assertFetchableUrl(url)).toThrow(BlockedRequestError));

  it("accepts public http(s) URLs", () => {
    expect(assertFetchableUrl("https://fonts.googleapis.com/css2?family=Inter").hostname).toBe(
      "fonts.googleapis.com",
    );
  });
});

describe("guardedLookup", () => {
  it("refuses names that resolve to loopback", async () => {
    const error = await new Promise<NodeJS.ErrnoException | null>((resolve) =>
      guardedLookup("localhost", {}, (e) => resolve(e)),
    );
    expect(error?.code).toBe("EBLOCKED");
  });
});

describe("guardedFetch", () => {
  it("never connects to a local server", async () => {
    let hits = 0;
    const server = createServer((_req, res) => {
      hits++;
      res.end("secret");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    try {
      await expect(
        guardedFetch(`http://127.0.0.1:${port}/`, { maxBytes: 1000 }),
      ).rejects.toBeInstanceOf(BlockedRequestError);
      // Through a name: the lookup refuses it before any connection is made.
      await expect(
        guardedFetch(`http://localtest.me:${port}/`, { maxBytes: 1000 }),
      ).rejects.toThrow();
      expect(hits).toBe(0);
    } finally {
      server.close();
    }
  });
});
