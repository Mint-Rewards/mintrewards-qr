import "server-only";
import sharp from "sharp";
// Named import: opentype.js's ESM build (which Next resolves) has no default export,
// even though its CJS build does.
import { parse as parseFont, type Font } from "opentype.js";
import fs from "node:fs/promises";
import path from "node:path";
import {
  AMBASSADOR_CARD_TEMPLATE_FILE,
  BOLD_THRESHOLD,
  CARD_WIDTH,
  CARD_HEIGHT,
  BATCH_BOX,
  UNIVERSITY_BOX,
  FONT_BOLD_FILE,
  FONT_REGULAR_FILE,
  MIN_FONT_SIZE,
  NAME_BOX,
  type TextBox,
} from "./card-config";

export interface AmbassadorCardInput {
  fullName: string;
  university: string;
  batchYear: number;
}

/**
 * Stamps an ambassador's details into the existing card template and returns a JPG.
 *
 * The template is used as-is apart from three lines of text, so all branding and
 * layout are preserved exactly -- the same rule the standee generator follows.
 */
export async function generateAmbassadorCardJpg(
  input: AmbassadorCardInput,
  templateBytes?: Buffer,
): Promise<Buffer> {
  const background = templateBytes ?? (await loadTemplateFromDisk());

  // Guard against a re-exported template silently shifting every coordinate. The text
  // boxes are calibrated against one exact pixel size; if it changes, the values would
  // land outside their slots and nothing would surface the mistake until a student
  // posted the card.
  const { width, height } = await sharp(background).metadata();
  if (width !== CARD_WIDTH || height !== CARD_HEIGHT) {
    throw new Error(
      `Card template is ${width}x${height} but the layout is calibrated for ` +
        `${CARD_WIDTH}x${CARD_HEIGHT}. Re-measure the boxes in ambassador/card-config.ts.`,
    );
  }

  const [name, university, batch] = await Promise.all([
    renderLine(NAME_BOX, input.fullName),
    renderLine(UNIVERSITY_BOX, input.university),
    renderLine(BATCH_BOX, `Batch ${input.batchYear}`),
  ]);

  const overlay =
    `<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">` +
    name + university + batch +
    `</svg>`;

  return sharp(background)
    .composite([{ input: Buffer.from(overlay), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

/**
 * The template lives at a fixed `templates/` path with a STATIC directory literal, for
 * the same reason as the standee template: building the path from an environment
 * variable defeats Next's static analysis and drags the whole project into the
 * serverless bundle.
 */
async function loadTemplateFromDisk(): Promise<Buffer> {
  const filePath = path.join(process.cwd(), "templates", AMBASSADOR_CARD_TEMPLATE_FILE);
  try {
    return await fs.readFile(filePath);
  } catch {
    throw new Error(
      `Ambassador card template not found at ${filePath}. ` +
        `Ensure templates/${AMBASSADOR_CARD_TEMPLATE_FILE} exists in the deployment.`,
    );
  }
}

/** Parsed fonts are reused across requests; parsing a 400 KB TTF per card is wasteful. */
const fontCache = new Map<string, Promise<Font>>();

function loadFont(fileName: string): Promise<Font> {
  const cached = fontCache.get(fileName);
  if (cached) return cached;

  const loading = (async () => {
    const filePath = path.join(process.cwd(), "templates", "fonts", fileName);
    let bytes: Buffer;
    try {
      bytes = await fs.readFile(filePath);
    } catch {
      throw new Error(
        `Card font not found at ${filePath}. Ensure templates/fonts/ ships with the ` +
          `deployment -- without it card text cannot be rendered.`,
      );
    }
    // opentype needs a standalone ArrayBuffer; a Buffer may be a view into a larger
    // pooled allocation, which would parse as garbage.
    return parseFont(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
  })();

  fontCache.set(fileName, loading);
  return loading;
}

async function renderLine(box: TextBox, rawValue: string): Promise<string> {
  const trimmed = rawValue.trim();
  if (!trimmed) return "";

  // Uppercase before measuring: capitals are wider, so fitting the original casing
  // would let the rendered name overrun its rule.
  const value = box.uppercase ? trimmed.toUpperCase() : trimmed;

  const font = await loadFont(
    box.fontWeight >= BOLD_THRESHOLD ? FONT_BOLD_FILE : FONT_REGULAR_FILE,
  );
  const fitted = fitToBox(font, value, box);

  // For a centred line, box.x is the shield's centre rather than the run's left edge,
  // so the pen has to start half the rendered width to its left. Measured after
  // fitting, since shrinking changes the width.
  const penX =
    box.align === "center"
      ? box.x - font.getAdvanceWidth(fitted.value, fitted.fontSize) / 2
      : box.x;

  // Glyph outlines, not <text>: nothing here depends on a font being installed on the
  // machine that renders the card.
  const outline = font.getPath(fitted.value, penX, box.y, fitted.fontSize);
  outline.fill = box.color;

  return outline.toSVG(2);
}

/**
 * Shrinks the value to fit its slot, then truncates if it still does not fit at
 * MIN_FONT_SIZE.
 *
 * Widths come from the font's own advance metrics, so this is exact rather than
 * estimated -- which matters because long names are the norm here, and a
 * per-character average is wrong by enough to push text over the panel border for
 * exactly the names most likely to appear.
 */
function fitToBox(
  font: Font,
  value: string,
  box: TextBox,
): { value: string; fontSize: number } {
  if (font.getAdvanceWidth(value, box.fontSize) <= box.width) {
    return { value, fontSize: box.fontSize };
  }

  // Advance widths scale linearly with font size, so one proportional correction is exact.
  const scaled = Math.floor(
    (box.fontSize * box.width) / font.getAdvanceWidth(value, box.fontSize),
  );
  const fontSize = Math.max(MIN_FONT_SIZE, scaled);
  if (font.getAdvanceWidth(value, fontSize) <= box.width) {
    return { value, fontSize };
  }

  // Only reachable at the MIN_FONT_SIZE floor: drop characters until the ellipsis fits.
  let truncated = value;
  while (
    truncated.length > 1 &&
    font.getAdvanceWidth(`${truncated}…`, fontSize) > box.width
  ) {
    truncated = truncated.slice(0, -1);
  }
  return { value: `${truncated}…`, fontSize };
}

/** Storage object path for a generated ambassador card. */
export function ambassadorCardStoragePath(ambassadorId: string): string {
  return `${ambassadorId}.jpg`;
}
