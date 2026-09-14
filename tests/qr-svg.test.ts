import { describe, it, expect } from "vitest";
import sharp from "sharp";
import jsQR from "jsqr";
import { generateQrSvg } from "@/lib/qr";

/**
 * Vector QR codes are handed to designers and end up on printed posters, so the failure
 * that matters is a code that looks right and does not scan. Asserting the output is
 * valid SVG would not catch that.
 *
 * Instead this rasterises the SVG and DECODES it back, at both a small and a large size,
 * proving the artwork actually carries the tracking URL and survives scaling -- which is
 * the entire reason for shipping vector rather than a PNG.
 */
async function decodeSvg(svg: string, width: number): Promise<string | null> {
  const { data, info } = await sharp(Buffer.from(svg))
    .resize(width)
    .flatten({ background: "#ffffff" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  return decoded?.data ?? null;
}

describe("vector QR generation", () => {
  const url = "https://mintrewards-qr.vercel.app/a/PM63GC7KX87H";

  it("produces an SVG", async () => {
    const svg = await generateQrSvg(url);
    expect(svg).toMatch(/^<\?xml|^<svg/);
    expect(svg).toContain("</svg>");
  });

  it("scans back to the tracking URL at poster size", async () => {
    const svg = await generateQrSvg(url);
    expect(await decodeSvg(svg, 1200)).toBe(url);
  });

  it("still scans when scaled down to sticker size", async () => {
    const svg = await generateQrSvg(url);
    expect(await decodeSvg(svg, 200)).toBe(url);
  });

  it("encodes whatever URL it is given, not a cached one", async () => {
    const other = "https://mintrewards-qr.vercel.app/a/ZZZZ23456789";
    expect(await decodeSvg(await generateQrSvg(other), 600)).toBe(other);
  });
});
