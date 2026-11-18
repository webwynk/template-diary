// @vitest-environment node
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import sharp from "sharp";

import { screenshotToWebp } from "@/lib/images/process";
import { renderScreenshot } from "@/lib/screenshot/render";

vi.mock("server-only", () => ({}));

// Launches the real headless Chromium (@sparticuz/chromium), as on Vercel.
describe("renderScreenshot", () => {
  it("renders the template at 1440×900 and blocks requests to private addresses", async () => {
    let hits = 0;
    const server = createServer((_req, res) => {
      hits++;
      res.end("secret");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    const local = `http://127.0.0.1:${port}`;

    const html = `<style>body{margin:0;background:#4f46e5}</style>
      <img src="${local}/a.png"><link rel="stylesheet" href="http://localhost:${port}/x.css">
      <script>fetch("${local}/steal").catch(()=>{}); new Image().src="http://169.254.169.254/latest";
      try { new WebSocket("ws://127.0.0.1:${port}") } catch (e) {}
      const f = document.createElement("iframe"); document.body.appendChild(f);
      try { new f.contentWindow.WebSocket("ws://127.0.0.1:${port}/frame") } catch (e) {}</script>`;
    try {
      const png = await renderScreenshot(html);
      const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
      expect([info.width, info.height]).toEqual([1440, 900]);
      const at = (800 * info.width + 720) * info.channels; // away from the broken <img>
      const [r, g, b] = [data[at], data[at + 1], data[at + 2]];
      expect([r, g, b]).toEqual([0x4f, 0x46, 0xe5]);
      expect(hits).toBe(0);

      const webp = await screenshotToWebp(png);
      const meta = await sharp(webp).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(["webp", 1280, 800]);
    } finally {
      server.close();
    }
  }, 60_000);
});
