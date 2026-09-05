import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { generateStandeePdf } from "@/lib/standee/generate";
import { STANDEE_TEMPLATES, type StandeeLanguage } from "@/lib/standee/config";

const exec = promisify(execFile);

/**
 * The highest-value test in the suite.
 *
 * It does not merely assert that a PDF was produced -- it rasterises the generated PDF
 * and DECODES the QR codes back out, then asserts that the iOS payload is physically
 * located in the iPhone placeholder and the Android payload in the Android one.
 *
 * That end-to-end loop is what catches the two failure modes that are invisible in code
 * review and expensive in the field:
 *   1. a coordinate typo putting a QR outside its placeholder, and
 *   2. the platforms being swapped -- which would send every iPhone user to the Play
 *      Store. The Urdu template is RTL-mirrored, so this is a live risk, not a
 *      hypothetical one.
 *
 * Rasterisation uses poppler's pdftoppm. If it is unavailable the placement assertions
 * are skipped with a clear message rather than silently passing.
 */
async function hasPdftoppm(): Promise<boolean> {
  try {
    await exec("pdftoppm", ["-v"]);
    return true;
  } catch {
    return false;
  }
}

/** Decodes the QR inside a given box of the rendered page. Rendered at 72dpi: 1px = 1pt. */
function decodeBox(
  png: PNG,
  box: { x: number; y: number; width: number; height: number },
  pageHeight: number,
): string | null {
  // config y is measured from the bottom (pdf-lib); image y is from the top.
  const top = Math.round(pageHeight - box.y - box.height);
  const left = Math.round(box.x);
  const w = Math.round(box.width);
  const h = Math.round(box.height);

  const data = new Uint8ClampedArray(w * h * 4);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const s = ((top + j) * png.width + (left + i)) * 4;
      const d = (j * w + i) * 4;
      data[d] = png.data[s];
      data[d + 1] = png.data[s + 1];
      data[d + 2] = png.data[s + 2];
      data[d + 3] = 255;
    }
  }
  return jsQR(data, w, h)?.data ?? null;
}

describe("standee generation", () => {
  const ios = "https://qr.example.test/r/ios/ABCDEFGH2345";
  const android = "https://qr.example.test/r/android/JKMNPQRS6789";

  it("preserves the original template page geometry", async () => {
    const { pdf } = await generateStandeePdf({
      iosTrackingUrl: ios,
      androidTrackingUrl: android,
    });
    expect(pdf.byteLength).toBeGreaterThan(1000);

    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(1);
    const page = doc.getPages()[0];
    // The design must survive untouched: same page count, same 12"x30" geometry.
    expect(Math.round(page.getWidth())).toBe(864);
    expect(Math.round(page.getHeight())).toBe(2160);
  });

  it("rejects a template whose page size no longer matches the calibration", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const wrong = await PDFDocument.create();
    wrong.addPage([612, 792]); // US Letter, not the standee
    const bytes = await wrong.save();

    await expect(
      generateStandeePdf({ iosTrackingUrl: ios, androidTrackingUrl: android }, bytes),
    ).rejects.toThrow(/does not match the calibrated/);
  });

  // Both languages are verified even though only English ships in v1 -- the Urdu
  // coordinates are recorded in config.ts and this is what proves they are right.
  for (const language of ["english", "urdu"] as StandeeLanguage[]) {
    it(`stamps each QR into the correct placeholder (${language})`, async () => {
      if (!(await hasPdftoppm())) {
        console.warn("SKIPPED placement assertions: pdftoppm (poppler) not installed");
        return;
      }

      const { pdf } = await generateStandeePdf({
        iosTrackingUrl: ios,
        androidTrackingUrl: android,
        language,
      });

      const dir = await fs.mkdtemp(path.join(os.tmpdir(), "standee-"));
      const pdfPath = path.join(dir, "out.pdf");
      await fs.writeFile(pdfPath, pdf);
      await exec("pdftoppm", ["-png", "-r", "72", "-f", "1", "-l", "1", pdfPath,
                              path.join(dir, "page")]);

      const rendered = path.join(dir, "page-1.png");
      const png = PNG.sync.read(await fs.readFile(rendered));

      const tpl = STANDEE_TEMPLATES[language];
      const iosDecoded = decodeBox(png, tpl.iosQrBox, tpl.pageSize.height);
      const androidDecoded = decodeBox(png, tpl.androidQrBox, tpl.pageSize.height);

      // Scannable at all...
      expect(iosDecoded, "iOS QR did not decode from its placeholder").not.toBeNull();
      expect(androidDecoded, "Android QR did not decode from its placeholder").not.toBeNull();

      // ...and in the RIGHT box. Swapping these would send iPhone users to Google Play.
      expect(iosDecoded).toBe(ios);
      expect(androidDecoded).toBe(android);

      await fs.rm(dir, { recursive: true, force: true });
    });
  }

  it("places iOS and Android on opposite sides in the RTL Urdu template", () => {
    // Regression guard for the mirroring. If someone ever "tidies" the Urdu config by
    // copying the English coordinates, this fails immediately.
    const en = STANDEE_TEMPLATES.english;
    const ur = STANDEE_TEMPLATES.urdu;
    expect(en.iosQrBox.x).toBeLessThan(en.androidQrBox.x); // English: iOS left
    expect(ur.iosQrBox.x).toBeGreaterThan(ur.androidQrBox.x); // Urdu: iOS right
  });
});
