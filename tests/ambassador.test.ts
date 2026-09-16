import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  ALUMNUS_CUTOFF_YEAR,
  classifyBatch,
  batchYearOptions,
} from "@/lib/ambassador/config";
import {
  generateAmbassadorCardJpg,
  truncatePreservingSuffix,
} from "@/lib/ambassador/card";
import {
  AMBASSADOR_CARD_TEMPLATE_FILE,
  CARD_WIDTH,
  CARD_HEIGHT,
} from "@/lib/ambassador/card-config";
import { ambassadorShareCaption, linkedInShareUrl } from "@/lib/ambassador/share";

describe("ambassador batch classification", () => {
  it("classifies the cutoff year itself as a current student", () => {
    expect(classifyBatch(ALUMNUS_CUTOFF_YEAR)).toBe("student");
  });

  it("classifies anything before the cutoff as an alumnus", () => {
    expect(classifyBatch(ALUMNUS_CUTOFF_YEAR - 1)).toBe("alumnus");
    expect(classifyBatch(2000)).toBe("alumnus");
  });

  it("classifies future batches as current students", () => {
    expect(classifyBatch(ALUMNUS_CUTOFF_YEAR + 5)).toBe("student");
  });

  it("offers six years either side of the current year, newest first", () => {
    const options = batchYearOptions(new Date("2026-09-14"));

    expect(options[0]).toBe(2032);
    expect(options.at(-1)).toBe(2020);
    expect(options).toHaveLength(13);
    expect(options).toEqual([...options].sort((a, b) => b - a));
  });

  it("stays inside the six-year window", () => {
    const options = batchYearOptions(new Date("2026-09-14"));

    // A first-year on a six-year programme reaches the far end; nothing beyond it is
    // a real batch, and a longer list is harder to scroll on a phone.
    expect(options).not.toContain(2033);
    expect(options).not.toContain(2019);
  });

  it("classifies both ends of the offered range", () => {
    const options = batchYearOptions(new Date("2026-09-14"));

    expect(classifyBatch(options[0])).toBe("student");
    expect(classifyBatch(options.at(-1)!)).toBe("alumnus");
  });
});

/**
 * Card generation.
 *
 * The valuable test here is the placement one, which is the card equivalent of the
 * standee's decode-it-back test: it does not merely assert that a JPG was produced,
 * it diffs two renders to find where the stamped text actually landed and asserts
 * that region sits inside the calibrated slot. That catches the two failures that are
 * invisible in review and embarrassing in public -- a coordinate typo putting a name
 * outside its panel, and text overflowing the panel edge.
 *
 * It also catches a missing-font deployment, which would render blank value slots:
 * two different names would then produce byte-identical cards and the diff would find
 * nothing.
 */
describe("ambassador card generation", () => {
  const base = { fullName: "Amina Khan", university: "LUMS", batchYear: 2027 };

  it("renders a JPG at the calibrated dimensions", async () => {
    const jpg = await generateAmbassadorCardJpg(base);
    const meta = await sharp(jpg).metadata();

    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(CARD_WIDTH);
    expect(meta.height).toBe(CARD_HEIGHT);
  });

  it("ships a template whose real dimensions match the calibration", async () => {
    // If these drift apart every stamped coordinate is wrong, so the config and the
    // file that ships beside it must agree.
    const file = path.join(process.cwd(), "templates", AMBASSADOR_CARD_TEMPLATE_FILE);
    const meta = await sharp(await fs.readFile(file)).metadata();

    expect(meta.width).toBe(CARD_WIDTH);
    expect(meta.height).toBe(CARD_HEIGHT);
  });

  it("refuses a template whose size no longer matches the calibration", async () => {
    const wrongSize = await sharp({
      create: { width: 800, height: 800, channels: 3, background: "#000000" },
    })
      .jpeg()
      .toBuffer();

    await expect(generateAmbassadorCardJpg(base, wrongSize)).rejects.toThrow(
      /calibrated/i,
    );
  });

  /**
   * Each line is measured against the BLANK template, not against another render.
   *
   * Diffing two renders only reveals the glyphs that changed: swapping the batch year
   * alters a few characters at the right-hand end of the shared detail line, so the
   * diff is a fragment sitting well off-centre and says nothing about where the line
   * itself sits. Differencing against the untouched artwork yields exactly the stamped
   * pixels, which can then be split by row.
   */
  it.each([
    ["name", ROWS.name],
    ["university and batch", ROWS.detail],
  ])("stamps the %s into its slice of the detail band", async (_label, row) => {
    const template = await fs.readFile(
      path.join(process.cwd(), "templates", AMBASSADOR_CARD_TEMPLATE_FILE),
    );
    const rendered = await generateAmbassadorCardJpg(base);

    const ink = await diffBounds(template, rendered, row);

    // Rendered at all -- a host with no fonts would leave the artwork untouched here.
    expect(ink.found).toBe(true);

    // Confined to its own slice, so the two lines can neither collide nor drift onto
    // the artwork above and below.
    expect(ink.minY).toBeGreaterThan(row.top - TOLERANCE_PX);
    expect(ink.maxY).toBeLessThan(row.bottom + TOLERANCE_PX);

    // Inside the shield, which tapers -- the title's span is the proven-safe width.
    expect(ink.minX).toBeGreaterThan(SAFE.left - TOLERANCE_PX);
    expect(ink.maxX).toBeLessThan(SAFE.right + TOLERANCE_PX);

    // CENTRED. The badge is a symmetric shield, so a line rendered left-aligned would
    // still land inside every bound above while looking obviously wrong.
    const inkCentre = (ink.minX + ink.maxX) / 2;
    expect(Math.abs(inkCentre - CENTRE_X)).toBeLessThan(MAX_CENTRE_DRIFT);
  });

  it("renders different names differently, proving fonts resolved", async () => {
    // Two renders that share a template but differ in one field. On a host with no
    // usable font both would come out identical.
    const [a, b] = await Promise.all([
      generateAmbassadorCardJpg({ ...base, fullName: "Ali" }),
      generateAmbassadorCardJpg({ ...base, fullName: "Zainab Fatima Sheikh" }),
    ]);

    expect((await diffBounds(a, b, ROWS.name)).found).toBe(true);
  });

  it("keeps an unusually long name inside the shield, still centred", async () => {
    const [before, after] = await Promise.all([
      generateAmbassadorCardJpg(base),
      generateAmbassadorCardJpg({
        ...base,
        fullName: "Abdurrahman Muhammad Siddiqui Al-Hussaini Bin Farooq",
      }),
    ]);

    const diff = await diffBounds(before, after);

    expect(diff.found).toBe(true);
    expect(diff.minX).toBeGreaterThan(SAFE.left - TOLERANCE_PX);
    expect(diff.maxX).toBeLessThan(SAFE.right + TOLERANCE_PX);
    expect(diff.maxY).toBeLessThan(ROWS.name.bottom + TOLERANCE_PX);
    expect(Math.abs((diff.minX + diff.maxX) / 2 - CENTRE_X)).toBeLessThan(MAX_CENTRE_DRIFT);
  });

  it("does not let unescaped input break the composited overlay", async () => {
    // A name with characters that are meaningful in XML must not corrupt the overlay.
    // Without escaping, sharp throws on the malformed SVG instead of returning a JPG.
    await expect(
      generateAmbassadorCardJpg({
        ...base,
        fullName: `<b>&"'</b>`,
        university: `Tom & Jerry's "University"`,
      }),
    ).resolves.toBeInstanceOf(Buffer);
  });
});

/**
 * The badge puts university and batch on one line, so an over-long campus must eat
 * into itself rather than into the batch. Plain truncation takes the END of a string,
 * which here is exactly the value worth keeping.
 *
 * Measured with an injected width function -- one unit per character -- so the rule is
 * tested without dragging a font in.
 */
describe("detail line truncation", () => {
  const measure = (text: string) => text.length;
  const BATCH = "  |  Batch 2026";

  it("leaves a line that already fits completely alone", () => {
    const line = `BUITEMS${BATCH}`;
    expect(truncatePreservingSuffix(line, BATCH, measure, 100)).toBe(line);
  });

  it("keeps the batch when the university is far too long", () => {
    const uni = "Balochistan University of Information Technology and Management Sciences";
    const result = truncatePreservingSuffix(`${uni}${BATCH}`, BATCH, measure, 40);

    expect(result.endsWith(BATCH)).toBe(true);
    expect(result).toContain("…");
    expect(measure(result)).toBeLessThanOrEqual(40);
  });

  it("keeps the batch even when the limit barely clears the batch itself", () => {
    const result = truncatePreservingSuffix(`Some Very Long University${BATCH}`, BATCH, measure, BATCH.length + 3);
    expect(result.endsWith(BATCH)).toBe(true);
  });

  it("falls back to plain truncation when nothing is protected", () => {
    const result = truncatePreservingSuffix("A very long value indeed", "", measure, 10);
    expect(result).toHaveLength(10);
    expect(result.endsWith("…")).toBe(true);
  });
});

describe("ambassador sharing", () => {
  it("falls back to a generic caption when the campaign has none", () => {
    const caption = ambassadorShareCaption(null, "Amina Khan");
    expect(caption).toContain("Amina Khan");
    expect(caption).toContain("MintRewards");
  });

  it("prefers the campaign's own caption when set", () => {
    expect(ambassadorShareCaption("Custom event caption", "Amina Khan")).toBe(
      "Custom event caption",
    );
  });

  it("builds a LinkedIn share intent around the public card page URL, not the image", () => {
    const url = linkedInShareUrl("https://mintrewards.app/a/card/abc123");
    expect(url).toBe(
      "https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fmintrewards.app%2Fa%2Fcard%2Fabc123",
    );
  });
});

/**
 * Geometry MEASURED FROM THE TEMPLATE IMAGE -- deliberately not imported from
 * card-config.ts.
 *
 * Asserting a render against the same constants that produced it proves nothing: move
 * NAME_BOX.y by 100 px and both the text and the expectation move together, so the
 * test passes while the card is wrong. These numbers instead describe what is painted
 * into Ambassador Design 2 itself -- the three ruled lines the values sit on -- so they
 * stay fixed while card-config.ts varies, which is what makes a mis-calibrated
 * coordinate fail here.
 *
 * The rules were found by scanning the raster for rows of grey pixels:
 *   y=1300 (x 80..788), y=1402 (x 80..560), y=1488 (x 80..560).
 *
 * RE-MEASURE THESE whenever the template changes, exactly as the standee's QR boxes
 * are re-measured against a new template.
 */
const TOLERANCE_PX = 8;

/**
 * The badge's centre line, and how far a stamped line's ink may sit from it before it
 * reads as misaligned. Side bearings mean ink is never centred to the pixel even when
 * the advance width is, so this is a band rather than an equality.
 */
const CENTRE_X = 726;
const MAX_CENTRE_DRIFT = 25;

/** Widest span proven to fit the shield: the printed title's own bounding box. */
const SAFE = { left: 164, right: 1283 };

const ROWS = {
  // The detail band runs y=728..1008; each line owns a slice of it. Nothing may be
  // drawn outside its own slice, which keeps the two lines from colliding or drifting
  // onto the artwork above and below.
  name: { top: 728, bottom: 880 },
  detail: { top: 880, bottom: 1008 },
};

/**
 * Bounding box of the pixels that differ between two images, optionally restricted to
 * a horizontal band so one line of the badge can be measured independently.
 */
async function diffBounds(a: Buffer, b: Buffer, zone?: { top: number; bottom: number }) {
  const [rawA, rawB] = await Promise.all([
    sharp(a).raw().toBuffer({ resolveWithObject: true }),
    sharp(b).raw().toBuffer({ resolveWithObject: true }),
  ]);

  const { width, height, channels } = rawA.info;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  const yStart = zone ? Math.max(0, zone.top) : 0;
  const yEnd = zone ? Math.min(height, zone.bottom) : height;

  for (let y = yStart; y < yEnd; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      // Well above JPEG compression noise, well below a real glyph edge.
      if (Math.abs(rawA.data[i] - rawB.data[i]) > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  return { minX, minY, maxX, maxY, found: maxX >= 0 };
}
