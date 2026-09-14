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
  ])("stamps the %s into its row on the template", async (_label, override, row) => {
    const [before, after] = await Promise.all([
      generateAmbassadorCardJpg(base),
      generateAmbassadorCardJpg({ ...base, ...override }),
    ]);

    const diff = await diffBounds(before, after);

    // Rendered at all -- a host with no fonts would produce identical cards here.
    expect(diff.found).toBe(true);

    // Sits below its printed label and above the rule that closes the row.
    expect(diff.minY).toBeGreaterThan(row.labelBaseline);
    expect(diff.maxY).toBeLessThan(row.floor);

    // And inside the panel, not running over its border.
    expect(diff.minX).toBeGreaterThan(PANEL.left);
    expect(diff.maxX).toBeLessThan(PANEL.right - PANEL.inset);
  });

  it("keeps an unusually long name inside the panel instead of overflowing", async () => {
    const [before, after] = await Promise.all([
      generateAmbassadorCardJpg(base),
      generateAmbassadorCardJpg({
        ...base,
        fullName: "Abdurrahman Muhammad Siddiqui Al-Hussaini Bin Farooq",
      }),
    ]);

    const diff = await diffBounds(before, after);

    expect(diff.found).toBe(true);
    expect(diff.maxX).toBeLessThan(PANEL.right - PANEL.inset);
    expect(diff.maxY).toBeLessThan(ROWS.name.floor);
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
 * into the template itself (the field labels, the divider rules, the panel border), so
 * they stay fixed while card-config.ts varies -- which is what makes a mis-calibrated
 * coordinate fail here.
 *
 * RE-MEASURE THESE when the real designed template replaces the stand-in, exactly as
 * the standee's QR boxes are re-measured against a new template.
 */
const PANEL = { left: 80, right: 1000, inset: 20 };

const ROWS = {
  // labelBaseline: the row's printed label. floor: the divider rule below it (the
  // panel's bottom edge, for the last row).
  name: { labelBaseline: 580, floor: 695 },
  university: { labelBaseline: 763, floor: 878 },
  batch: { labelBaseline: 946, floor: 1062 },
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
