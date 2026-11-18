// @vitest-environment node
import sharp from "sharp";

import { ImageError, processUpload, screenshotToWebp, sniffImage } from "@/lib/images/process";

vi.mock("server-only", () => ({}));

const solid = (width: number, height: number, format: "png" | "jpeg" | "webp") =>
  sharp({ create: { width, height, channels: 3, background: "#4f46e5" } })
    .toFormat(format)
    .toBuffer();

describe("sniffImage", () => {
  it("detects PNG, JPEG and WebP by their bytes", async () => {
    expect(sniffImage(await solid(4, 4, "png"))).toBe("png");
    expect(sniffImage(await solid(4, 4, "jpeg"))).toBe("jpeg");
    expect(sniffImage(await solid(4, 4, "webp"))).toBe("webp");
    expect(sniffImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(sniffImage(Buffer.from("GIF89a"))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
});

describe("processUpload", () => {
  it("re-encodes to WebP, at most 1280 wide, never enlarged", async () => {
    const big = await sharp(await processUpload(await solid(2560, 1600, "png"))).metadata();
    expect([big.format, big.width, big.height]).toEqual(["webp", 1280, 800]);
    const small = await sharp(await processUpload(await solid(640, 400, "jpeg"))).metadata();
    expect([small.width, small.height]).toEqual([640, 400]);
  });

  it("keeps the top 3200 px of very tall images", async () => {
    const tall = await sharp(await processUpload(await solid(1280, 5000, "webp"))).metadata();
    expect([tall.width, tall.height]).toEqual([1280, 3200]);
  });

  it("refuses files that aren't PNG, JPG or WebP whatever their name says", async () => {
    await expect(processUpload(Buffer.from("<svg/>"))).rejects.toThrow("Use a PNG, JPG or WebP");
    await expect(processUpload(Buffer.alloc(0))).rejects.toBeInstanceOf(ImageError);
    const broken = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(50),
    ]);
    await expect(processUpload(broken)).rejects.toThrow("couldn't be read");
    await expect(processUpload(Buffer.alloc(5 * 1024 * 1024 + 1))).rejects.toThrow("5 MB");
  });
});

describe("screenshotToWebp", () => {
  it("makes a 1280×800 WebP from the 1440×900 screenshot", async () => {
    const meta = await sharp(await screenshotToWebp(await solid(1440, 900, "png"))).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 1280, 800]);
  });
});
