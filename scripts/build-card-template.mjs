/**
 * Flattens the ambassador card design into the background the app stamps text onto.
 *
 *   npm run build:card-template
 *
 * Run this whenever the design PDF changes -- a corrected typo, new artwork, anything.
 * Drop the new file in at the same path and re-run; nothing else needs touching unless
 * the layout itself moved.
 *
 * The PDF is rasterised at 144 dpi, which is exactly 2x the 72 pt/inch PDF space, so a
 * 756 x 1200 pt page lands on a 1512 x 2400 pixel background and every coordinate in
 * card-config.ts stays a whole pixel.
 *
 * After flattening it re-measures the design's ruled lines and prints them next to the
 * values card-config.ts is calibrated to, so a layout shift is visible immediately
 * rather than discovered on a student's card. `npm test` asserts the same thing.
 *
 * Requires poppler's pdftoppm (the standee placement test already depends on it).
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";

const exec = promisify(execFile);

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const SOURCE_PDF = path.join(ROOT, "templates", "Ambassador Design 2.pdf");
const OUTPUT = path.join(ROOT, "templates", "ambassador-card-background.jpg");

/** 2x the PDF's point space. */
const DPI = 144;

/** What card-config.ts is currently calibrated to, for the drift report below. */
const EXPECTED = {
  width: 1512,
  height: 2400,
  rules: [
    { label: "name", y: 1300, x0: 80, x1: 788 },
    { label: "university", y: 1402, x0: 80, x1: 560 },
    { label: "batch", y: 1488, x0: 80, x1: 560 },
  ],
};

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "mint-card-"));
try {
  await exec("pdftoppm", ["-jpeg", "-r", String(DPI), "-f", "1", "-l", "1", SOURCE_PDF, path.join(tmp, "page")]);

  const [rendered] = (await fs.readdir(tmp)).filter((f) => f.endsWith(".jpg"));
  if (!rendered) throw new Error("pdftoppm produced no page");

  await sharp(path.join(tmp, rendered)).jpeg({ quality: 92 }).toFile(OUTPUT);

  const meta = await sharp(OUTPUT).metadata();
  console.log(`Wrote ${path.relative(ROOT, OUTPUT)} (${meta.width}x${meta.height})`);

  if (meta.width !== EXPECTED.width || meta.height !== EXPECTED.height) {
    console.warn(
      `\n!! Size changed: expected ${EXPECTED.width}x${EXPECTED.height}.\n` +
        `   Update CARD_WIDTH/CARD_HEIGHT in src/lib/ambassador/card-config.ts and ` +
        `re-measure every box, or card generation will throw.`,
    );
  }

  console.log("\nRuled lines found in the new artwork:");
  const found = await findRules(OUTPUT);
  for (const rule of found) console.log(`  y=${rule.y}  x=${rule.x0}..${rule.x1}`);

  const drifted = EXPECTED.rules.filter(
    (e) => !found.some((f) => Math.abs(f.y - e.y) <= 2 && Math.abs(f.x0 - e.x0) <= 2),
  );
  if (drifted.length) {
    console.warn(
      `\n!! These rules moved: ${drifted.map((d) => `${d.label} (was y=${d.y})`).join(", ")}.\n` +
        `   Re-measure the boxes in src/lib/ambassador/card-config.ts and the ROWS\n` +
        `   constants in tests/ambassador.test.ts against the list above.`,
    );
  } else {
    console.log("\nLayout unchanged — existing calibration still applies.");
  }
} finally {
  await fs.rm(tmp, { recursive: true, force: true });
}

/** Rows carrying a long horizontal run of mid-grey on white are the fill-in rules. */
async function findRules(file) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const rules = [];

  for (let y = 0; y < height; y++) {
    let run = 0;
    let start = -1;
    let best = 0;
    let bestStart = -1;

    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const grey = Math.abs(r - g) < 12 && Math.abs(g - b) < 12 && r > 150 && r < 225;

      if (grey) {
        if (run === 0) start = x;
        run++;
        if (run > best) { best = run; bestStart = start; }
      } else {
        run = 0;
      }
    }

    // Long enough to be a rule, and only the first row of each 2px-thick line.
    if (best > 250 && !rules.some((p) => y - p.y <= 2)) {
      rules.push({ y, x0: bestStart, x1: bestStart + best });
    }
  }

  return rules;
}
