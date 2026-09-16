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
const SOURCE_PDF = path.join(ROOT, "templates", "Badge template.pdf");
const OUTPUT = path.join(ROOT, "templates", "ambassador-card-background.jpg");

/** 2x the PDF's point space. */
const DPI = 144;

/** What card-config.ts is currently calibrated to, for the drift report below. */
const EXPECTED = { width: 1452, height: 1512 };

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

  const { band, title } = await measureBadge(OUTPUT);
  console.log("\nAnchors measured in the new artwork:");
  console.log(`  detail band : y=${band.top}..${band.bottom}`);
  console.log(`  title       : x=${title.left}..${title.right}  centre=${title.centre}`);
  console.log(
    "\nCheck these against CARD_WIDTH/CENTRE_X and the box baselines in\n" +
      "src/lib/ambassador/card-config.ts, and the BADGE constants in\n" +
      "tests/ambassador.test.ts. `npm test` asserts the stamped text lands inside them.",
  );
} finally {
  await fs.rm(tmp, { recursive: true, force: true });
}

/**
 * Measures the two anchors the badge layout depends on: the lighter tonal band left
 * empty for the ambassador's details, and the printed title, whose span establishes the
 * centre line and a text width already proven to fit inside the shield.
 */
async function measureBadge(file) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const px = (x, y) => {
    const i = (y * width + x) * channels;
    return [data[i], data[i + 1], data[i + 2]];
  };

  // Title: bright pixels, below the logo wordmark and above the detail band.
  let left = Infinity, right = -1;
  for (let y = Math.round(height * 0.37); y < Math.round(height * 0.47); y++) {
    for (let x = 100; x < width - 100; x++) {
      const [r, g, b] = px(x, y);
      if (r > 235 && g > 235 && b > 235) {
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }

  // Band: the teal lightens where the details go, then darkens again below.
  const centre = Math.round(width / 2);
  let top = null, bottom = null, prev = px(centre, Math.round(height * 0.45));
  for (let y = Math.round(height * 0.45); y < Math.round(height * 0.75); y++) {
    const c = px(centre, y);
    const delta = Math.abs(c[0] - prev[0]) + Math.abs(c[1] - prev[1]) + Math.abs(c[2] - prev[2]);
    // Only the first two transitions matter: into the band and back out of it.
    // Later ones are the mascot's edges further down the shield.
    if (delta > 12 && bottom === null) {
      if (top === null) top = y;
      else bottom = y;
    }
    prev = c;
  }

  return {
    band: { top, bottom },
    title: { left, right, centre: Math.round((left + right) / 2) },
  };
}
