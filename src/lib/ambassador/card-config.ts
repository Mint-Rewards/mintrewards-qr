/**
 * Mint Ambassador card layout configuration.
 *
 * Calibrated against "Ambassador Design 2", kept beside the flattened background in
 * templates/. The design is 756 x 1200 pt and is rasterised at 144 dpi -- exactly 2x
 * the PDF's point space -- so every measurement below is a whole pixel.
 *
 * The three values sit on the design's own ruled lines, which were MEASURED, not
 * estimated: the raster was scanned for rows of grey pixels and the rules came back at
 * y=1300 (x 80..788), y=1402 and y=1488 (both x 80..560). Each baseline sits
 * BASELINE_LIFT above its rule so the text rests on the line rather than through it.
 *
 * REPLACING THE TEMPLATE:
 *  1. Flatten the design to `templates/${AMBASSADOR_CARD_TEMPLATE_FILE}`
 *     (`pdftoppm -jpeg -r 144 design.pdf out` for a PDF at 2x, or export straight from
 *     Figma/PSD/AI). It must carry everything static and leave the values empty.
 *  2. Set CARD_WIDTH/CARD_HEIGHT to its real pixel size. `generateAmbassadorCardJpg`
 *     throws if they disagree rather than stamping text in the wrong place.
 *  3. Re-measure the boxes against the new file, and re-measure the RULES constants in
 *     tests/ambassador.test.ts, which describe the template rather than this config.
 *  4. Check it at `/dev/ambassador-card-preview` (auth required), then `npm test`.
 *
 * Coordinates are PIXELS from the TOP-LEFT, and `y` is the text BASELINE (SVG
 * convention). Note this is the opposite origin from the standee's pdf-lib boxes,
 * which measure from the bottom-left.
 */

export interface TextBox {
  /** Left edge of the text run. */
  x: number;
  /** Text baseline, measured down from the top of the image. */
  y: number;
  /** Space available before the text would run past the design's ruled line. */
  width: number;
  fontSize: number;
  fontWeight: number;
  color: string;
  /** Design 2 sets the name in capitals; the student's own casing is not preserved. */
  uppercase?: boolean;
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
 * (see LICENSE.txt beside them) and matches the font the template was rendered with.
 */
export const FONT_REGULAR_FILE = "LiberationSans-Regular.ttf";
export const FONT_BOLD_FILE = "LiberationSans-Bold.ttf";

/** Weights at or above this use the bold file; Liberation Sans has no semibold. */
export const BOLD_THRESHOLD = 600;

/** Design 2 at 2x its 756 x 1200 pt page. */
export const CARD_WIDTH = 1512;
export const CARD_HEIGHT = 2400;

/** Gap between a value's baseline and the ruled line it sits on. */
const BASELINE_LIFT = 16;

/** Teal sampled from the card's own "MINT AMBASSADOR" heading. */
const NAME_TEAL = "#0f5560";
/** Near-black used by the design's body copy. */
const BODY_INK = "#2b2b2b";

export const NAME_BOX: TextBox = {
  x: 80, y: 1300 - BASELINE_LIFT, width: 708,
  fontSize: 84, fontWeight: 400, color: NAME_TEAL, uppercase: true,
};
export const UNIVERSITY_BOX: TextBox = {
  x: 80, y: 1402 - BASELINE_LIFT, width: 480,
  fontSize: 46, fontWeight: 400, color: BODY_INK,
};
export const BATCH_BOX: TextBox = {
  x: 80, y: 1488 - BASELINE_LIFT, width: 480,
  fontSize: 46, fontWeight: 400, color: BODY_INK,
};

/**
 * Below this the text is too small to read on a phone, so an absurdly long value is
 * truncated instead of being shrunk further.
 */
export const MIN_FONT_SIZE = 26;
