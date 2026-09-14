import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  ALUMNUS_CUTOFF_YEAR,
  classifyBatch,
  batchYearOptions,
} from "@/lib/ambassador/config";
import { generateAmbassadorCardJpg } from "@/lib/ambassador/card";
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

  it("offers batch years centred on the current year, newest first", () => {
    const options = batchYearOptions(new Date("2026-09-14"));
    expect(options[0]).toBe(2027);
    expect(options).toContain(2026);
    expect(options).toContain(2011);
    expect(options).toEqual([...options].sort((a, b) => b - a));
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

  it.each([
    ["name", { fullName: "Zainab Fatima Sheikh" }, ROWS.name],
    ["university", { university: "Institute of Business Administration" }, ROWS.university],
    ["batch", { batchYear: 2019 }, ROWS.batch],
  ])("stamps the %s onto its ruled line", async (_label, override, row) => {
    const [before, after] = await Promise.all([
      generateAmbassadorCardJpg(base),
      generateAmbassadorCardJpg({ ...base, ...override }),
    ]);

    const diff = await diffBounds(before, after);

    // Rendered at all -- a host with no fonts would produce identical cards here.
    expect(diff.found).toBe(true);

    // Sits in its own row, below whatever precedes it...
    expect(diff.minY).toBeGreaterThan(row.ceiling);
    // ...and RESTS ON its rule. Both bounds matter: only checking that the text is
    // above the line lets it float anywhere up the card and still pass, so the lower
    // bound is what actually pins it to the design.
    expect(diff.maxY).toBeLessThan(row.rule + TOLERANCE_PX);
    expect(diff.maxY).toBeGreaterThan(row.rule - MAX_RULE_GAP);

    // And within the horizontal span of that rule.
    expect(diff.minX).toBeGreaterThan(row.left - TOLERANCE_PX);
    expect(diff.maxX).toBeLessThan(row.right + TOLERANCE_PX);
  });

  it("keeps an unusually long name within its rule instead of overflowing", async () => {
    const [before, after] = await Promise.all([
      generateAmbassadorCardJpg(base),
      generateAmbassadorCardJpg({
        ...base,
        fullName: "Abdurrahman Muhammad Siddiqui Al-Hussaini Bin Farooq",
      }),
    ]);

    const diff = await diffBounds(before, after);

    expect(diff.found).toBe(true);
    expect(diff.maxX).toBeLessThan(ROWS.name.right + TOLERANCE_PX);
    expect(diff.maxY).toBeLessThan(ROWS.name.rule + TOLERANCE_PX);
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
 * Furthest a value's lowest pixel may sit above its rule before it reads as floating
 * rather than written on the line. Capitals bottom out on the baseline, which
 * card-config lifts 16 px clear of the rule.
 */
const MAX_RULE_GAP = 40;

const ROWS = {
  // ceiling: nothing for this value may be drawn above it. rule: the printed line the
  // value rests on -- text must stay above it, never through or below it.
  name: { ceiling: 1100, rule: 1300, left: 80, right: 788 },
  university: { ceiling: 1302, rule: 1402, left: 80, right: 560 },
  batch: { ceiling: 1404, rule: 1488, left: 80, right: 560 },
};

/** Bounding box of the pixels that differ between two renders of the same card. */
async function diffBounds(a: Buffer, b: Buffer) {
  const [rawA, rawB] = await Promise.all([
    sharp(a).raw().toBuffer({ resolveWithObject: true }),
    sharp(b).raw().toBuffer({ resolveWithObject: true }),
  ]);

  const { width, height, channels } = rawA.info;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
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
