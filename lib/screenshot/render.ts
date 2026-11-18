import "server-only";

import chromium from "@sparticuz/chromium";
import puppeteer, { type HTTPRequest } from "puppeteer-core";

import { buildSrcdoc } from "@/lib/preview/build-srcdoc";
import { BlockedRequestError, guardedFetch } from "@/lib/screenshot/net-guard";

// Server-side screenshot of a Custom template (DEVELOPMENT.md Phase 6): the same document as the
// live preview, at 1440×900, after the network goes idle (at most 8 s).

export const VIEWPORT = { width: 1440, height: 900 } as const;
const IDLE_TIMEOUT_MS = 8_000;
const TOTAL_TIMEOUT_MS = 30_000;
const MAX_REQUESTS = 150;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;

// Template scripts can't open sockets that the request interception wouldn't see.
const LOCKDOWN = `(() => {
  for (const name of ["WebSocket", "WebTransport", "RTCPeerConnection", "webkitRTCPeerConnection"]) {
    try { Object.defineProperty(window, name, { value: undefined, configurable: false }); } catch {}
  }
})();`;

/**
 * The template is served at this address inside Chrome (so new-document scripts run, unlike
 * setContent). `.invalid` never resolves, so relative links fail like in the live preview.
 */
const DOCUMENT_URL = "http://template.invalid/";

export class RenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderError";
  }
}

/** Render `content` and return a PNG of the 1440×900 viewport. */
export async function renderScreenshot(content: string): Promise<Buffer> {
  chromium.setGraphicsMode = false;
  const browser = await puppeteer.launch({
    args: await puppeteer.defaultArgs({
      args: [
        ...chromium.args,
        // Anything not answered by the request interception below (WebSockets, WebRTC over TCP)
        // goes to a proxy that doesn't exist and fails, including loopback addresses.
        "--proxy-server=http://127.0.0.1:9",
        "--proxy-bypass-list=<-loopback>",
        "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
      ],
      headless: "shell",
    }),
    defaultViewport: { ...VIEWPORT, deviceScaleFactor: 1 },
    executablePath: await chromium.executablePath(),
    headless: "shell",
    protocolTimeout: TOTAL_TIMEOUT_MS,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOTAL_TIMEOUT_MS);
  try {
    const page = await browser.newPage();
    await page.setBypassServiceWorker(true);
    await page.evaluateOnNewDocument(LOCKDOWN);
    const cdp = await page.createCDPSession();
    await cdp.send("Network.enable");
    await cdp.send("Network.setBlockedURLs", { urls: ["ws://*", "wss://*"] });
    await page.setRequestInterception(true);

    let requests = 0;
    let totalBytes = 0;
    page.on("request", (request) => {
      void handleRequest(request).catch(() => undefined);
    });

    async function handleRequest(request: HTTPRequest) {
      const url = request.url();
      // Inline documents and resources never touch the network.
      if (/^(data|blob|about):/i.test(url)) return request.continue();
      if (
        url === DOCUMENT_URL &&
        request.isNavigationRequest() &&
        request.frame() === page.mainFrame()
      ) {
        return request.respond({
          status: 200,
          contentType: "text/html; charset=utf-8",
          body: Buffer.from(buildSrcdoc(content), "utf8"),
        });
      }
      if (!/^https?:/i.test(url) || !["GET", "HEAD"].includes(request.method())) {
        return request.abort("blockedbyclient");
      }
      if (++requests > MAX_REQUESTS || controller.signal.aborted) {
        return request.abort("blockedbyclient");
      }
      try {
        const headers = request.headers();
        const response = await guardedFetch(url, {
          maxBytes: MAX_RESPONSE_BYTES,
          signal: controller.signal,
          headers: {
            accept: headers.accept ?? "*/*",
            "user-agent": headers["user-agent"] ?? "Mozilla/5.0",
          },
        });
        totalBytes += response.body.byteLength;
        if (totalBytes > MAX_TOTAL_BYTES) return request.abort("blockedbyclient");
        await request.respond({
          status: response.status,
          headers: { ...response.headers, "access-control-allow-origin": "*" },
          body: request.method() === "HEAD" ? "" : response.body,
        });
      } catch (error) {
        await request.abort(error instanceof BlockedRequestError ? "blockedbyclient" : "failed");
      }
    }

    const deadline = Date.now() + IDLE_TIMEOUT_MS;
    try {
      await page.goto(DOCUMENT_URL, { waitUntil: "load", timeout: IDLE_TIMEOUT_MS });
      await page.waitForNetworkIdle({
        idleTime: 500,
        timeout: Math.max(1, deadline - Date.now()),
      });
    } catch (error) {
      // A page that never goes idle (polling, long animations) is still captured as it is now.
      if (!(error instanceof Error && error.name === "TimeoutError")) throw error;
    }
    // Let web fonts and the first animation frame settle.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          void document.fonts.ready.then(() => requestAnimationFrame(() => resolve()));
          setTimeout(resolve, 1_000);
        }),
    );
    const png = await page.screenshot({ type: "png", captureBeyondViewport: false });
    return Buffer.from(png);
  } catch (error) {
    if (controller.signal.aborted) throw new RenderError("The page took too long to render.");
    throw error;
  } finally {
    clearTimeout(timer);
    controller.abort();
    await browser.close().catch(() => undefined);
  }
}
