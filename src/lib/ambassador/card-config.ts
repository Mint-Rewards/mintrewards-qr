/**
 * Mint Ambassador badge layout configuration.
 *
 * Calibrated against "Badge template.pdf", kept beside the flattened background in
 * templates/. The design is 726 x 756 pt and is rasterised at 144 dpi -- exactly 2x the
 * PDF's point space -- so the 1452 x 1512 background lands on whole pixels.
 *
 * Unlike the earlier card, this artwork has no ruled lines to write on. The anchors are
 * MEASURED features of the shield instead: the lighter tonal band that runs from y=728
 * to y=1008 is the area left empty for the ambassador's details, and the printed
 * "CAMPUS AMBASSADOR" title spans x=164..1283 with its centre on x=724, which is what
 * establishes both the centre line and a text width already proven to fit the shield.
 *
 * Two lines, not three: the badge puts university and batch together on one line
 * ("University of Lahore | Batch 2027"), so card.ts composes them rather than stamping
 * three separate values.
 *
 * REPLACING THE TEMPLATE:
 *  1. Drop the new artwork at templates/Badge template.pdf and run
 *     `npm run build:card-template`, which re-flattens and reports the measurements.
 *  2. Set CARD_WIDTH/CARD_HEIGHT to its real pixel size. Generation throws if they
 *     disagree rather than stamping text in the wrong place.
 *  3. Re-measure the boxes below, and the BADGE constants in tests/ambassador.test.ts,
 *     which describe the template rather than this config.
 *  4. Check it at /dev/ambassador-card-preview (auth required), then `npm test`.
 *
 * Coordinates are PIXELS from the TOP-LEFT, and `y` is the text BASELINE (SVG
 * convention). Note this is the opposite origin from the standee's pdf-lib boxes,
 * which measure from the bottom-left.
 */

export interface TextBox {
  /** Left edge of the run, or its CENTRE when `align` is "center". */
  x: number;
  /** Text baseline, measured down from the top of the image. */
  y: number;
  /** Space available before the text would run past the shield. */
  width: number;
  fontSize: number;
  fontWeight: number;
  color: string;
  /** The badge sets the name in capitals; the student's own casing is not preserved. */
  uppercase?: boolean;
  align?: "left" | "center";
}

export const AMBASSADOR_CARD_TEMPLATE_FILE = "ambassador-card-background.jpg";

/**
 * Fonts are BUNDLED and rendered as vector outlines, never as SVG <text>.
 *
 * sharp draws SVG text through the host's fontconfig. Vercel's Lambda image ships
 * with no fonts, so every glyph came out as a tofu box (□) on the first deployed
 * card -- while rendering perfectly on a dev machine, which is what made it slip
 * through. Converting text to <path> with opentype.js removes the host from the
 * equation entirely: identical output everywhere, and exact glyph metrics for
 * fitting.
 *
 * These files must stay in templates/fonts/ so next.config.ts's `./templates/**`
 * tracing pulls them into the serverless bundle. Liberation Sans is SIL OFL 1.1
 * (see LICENSE.txt beside them).
 */
export const FONT_REGULAR_FILE = "LiberationSans-Regular.ttf";
export const FONT_BOLD_FILE = "LiberationSans-Bold.ttf";

/** Weights at or above this use the bold file; Liberation Sans has no semibold. */
export const BOLD_THRESHOLD = 600;

/** The badge at 2x its 726 x 756 pt page. */
export const CARD_WIDTH = 1452;
export const CARD_HEIGHT = 1512;

/** Shield centre line, from the printed title's own bounding box. */
const CENTRE_X = 726;

/** Text is white on teal throughout the lower half of the shield. */
const BADGE_INK = "#ffffff";

export const NAME_BOX: TextBox = {
  x: CENTRE_X, y: 830, width: 1120,
  fontSize: 84, fontWeight: 400, color: BADGE_INK,
  uppercase: true, align: "center",
};

/** University and batch, composed onto one line by card.ts. */
export const DETAIL_BOX: TextBox = {
  x: CENTRE_X, y: 928, width: 1060,
  fontSize: 42, fontWeight: 400, color: BADGE_INK,
  align: "center",
};

/** Separator between university and batch on the detail line. */
export const DETAIL_SEPARATOR = "  |  ";

/**
 * Below this the text is too small to read on a phone, so an absurdly long value is
 * truncated instead of being shrunk further.
 */
export const MIN_FONT_SIZE = 24;
