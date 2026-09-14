import "server-only";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import {
  AMBASSADOR_CARD_TEMPLATE_FILE,
  CARD_WIDTH,
  CARD_HEIGHT,
  FONT_STACK,
  MIN_FONT_SIZE,
  NAME_BOX,
  UNIVERSITY_BOX,
  BATCH_BOX,
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

  const lines = await Promise.all([
    renderLine(NAME_BOX, input.fullName),
    renderLine(UNIVERSITY_BOX, input.university),
    renderLine(BATCH_BOX, String(input.batchYear)),
  ]);

  const overlay =
    `<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">` +
    lines.join("") +
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

async function renderLine(box: TextBox, rawValue: string): Promise<string> {
  const { value, fontSize } = await fitToBox(rawValue.trim(), box);
  if (!value) return "";

  return (
    `<text x="${box.x}" y="${box.y}" font-family="${FONT_STACK}" ` +
    `font-size="${fontSize}" font-weight="${box.fontWeight}" fill="${box.color}">` +
    `${escapeXml(value)}</text>`
  );
}

/**
 * Shrinks the value to fit its slot, then truncates if it still does not fit at
 * MIN_FONT_SIZE.
 *
 * The width is MEASURED, not estimated from a per-character average. Long names are
 * the norm here rather than an edge case, and an average is wrong by enough to push
 * text off the panel for exactly the names most likely to appear ("Muhammad Abdul
 * Rahman Khan" renders ~6% wider than a 0.56 em-ratio predicts). Since the card is a
 * public artefact a student posts to LinkedIn, overflow is not a defect worth
 * discovering in production.
 */
async function fitToBox(
  value: string,
  box: TextBox,
): Promise<{ value: string; fontSize: number }> {
  if (!value) return { value, fontSize: box.fontSize };

  let width = await measureTextWidth(value, box.fontSize, box.fontWeight);
  if (width <= box.width) return { value, fontSize: box.fontSize };

  // Glyph widths scale linearly with font size, so one proportional correction lands
  // within a pixel or two rather than needing a search.
  const fontSize = Math.max(MIN_FONT_SIZE, Math.floor((box.fontSize * box.width) / width));
  width = await measureTextWidth(value, fontSize, box.fontWeight);
  if (width <= box.width) return { value, fontSize };

  // Only reachable at the MIN_FONT_SIZE floor. Derive the character budget from what
  // was actually measured instead of guessing again.
  const perChar = width / value.length;
  const maxChars = Math.max(1, Math.floor(box.width / perChar) - 1);
  return { value: `${value.slice(0, maxChars)}…`, fontSize };
}

/** Renders the text alone and trims the transparent margin to get its true width. */
async function measureTextWidth(
  value: string,
  fontSize: number,
  fontWeight: number,
): Promise<number> {
  const pad = fontSize;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH * 3}" height="${fontSize * 3}">` +
    `<text x="${pad}" y="${fontSize * 2}" font-family="${FONT_STACK}" font-size="${fontSize}" ` +
    `font-weight="${fontWeight}" fill="#ffffff">${escapeXml(value)}</text></svg>`;

  try {
    const { info } = await sharp(Buffer.from(svg))
      .trim()
      .toBuffer({ resolveWithObject: true });
    return info.width;
  } catch {
    // sharp throws when the render is entirely blank (e.g. a value of only spaces).
    return 0;
  }
}

/**
 * Names and universities are public, unauthenticated form input. Without escaping, a
 * value containing `<` or `&` would corrupt the SVG and break rendering outright.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Storage object path for a generated ambassador card. */
export function ambassadorCardStoragePath(ambassadorId: string): string {
  return `${ambassadorId}.jpg`;
}
