// @vitest-environment node
import { gzipSync } from "node:zlib";

import { MAX_CONTENT_BYTES } from "@/lib/engine/types";
import { gzipText } from "@/lib/templates/upload";
import { gunzipUpload } from "@/lib/templates/upload-server";

vi.mock("server-only", () => ({}));

describe("gzip upload round trip", () => {
  it("returns exactly the text that was sent (BOM, CRLF, unicode, trailing spaces)", async () => {
    const text = "﻿<section>\r\n\t<p>Café 👋  </p>\r\n</section>\n\n  ";
    expect(await gunzipUpload(await gzipText(text))).toBe(text);
  });

  it("rejects anything that isn't a valid gzip of UTF-8 within the limits", async () => {
    expect(await gunzipUpload(null)).toBeNull();
    expect(await gunzipUpload("text")).toBeNull();
    expect(await gunzipUpload(new Blob([]))).toBeNull();
    expect(await gunzipUpload(new Blob(["not gzip"]))).toBeNull();
    expect(await gunzipUpload(new Blob([gzipSync(Buffer.from([0xff, 0xfe, 0xfd]))]))).toBeNull();
    // A zip bomb: tiny upload, more than 5 MB when unpacked.
    const bomb = gzipSync(Buffer.alloc(MAX_CONTENT_BYTES + 1, 97));
    expect(bomb.length).toBeLessThan(100_000);
    expect(await gunzipUpload(new Blob([bomb]))).toBeNull();
    // Exactly 5 MB is fine.
    expect(
      await gunzipUpload(new Blob([gzipSync(Buffer.alloc(MAX_CONTENT_BYTES, 97))])),
    ).toHaveLength(MAX_CONTENT_BYTES);
  });
});
