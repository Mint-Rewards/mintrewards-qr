/**
 * Standee PDF template placement configuration.
 *
 * ALL coordinates below were MEASURED from the real template, not estimated:
 * the page was rasterised at 72 dpi (so 1 px == 1 pt), the dashed QR placeholder
 * boxes were located by connected-component analysis on their fill colour, and the
 * result was verified end-to-end by stamping QR codes, re-rasterising the output and
 * machine-decoding the codes back out. See tests/standee.test.ts.
 *
 * PDF coordinate system notes:
 *  - Units are points. The template is 864 x 2160 pt (12" x 30").
 *  - pdf-lib uses a BOTTOM-LEFT origin. The measurements were taken in top-left
 *    image space, so every y below is already converted:  y = pageHeight - top - height.
 *  - `QR_INSET_PT` keeps the stamped code inside the dashed placeholder border and,
 *    combined with the QR library's own `margin: 1` module quiet zone, gives phones
 *    enough white space to acquire the code.
 */

export type Platform = "ios" | "android";
export type StandeeLanguage = "english" | "urdu";

export interface QrBox {
  /** distance from the left edge of the page, in points */
  x: number;
  /** distance from the BOTTOM edge of the page, in points (pdf-lib origin) */
  y: number;
  width: number;
  height: number;
}

export interface StandeeTemplate {
  templateName: string;
  /** file name inside the templates/ directory */
  fileName: string;
  page: number;
  pageSize: { width: number; height: number };
  iosQrBox: QrBox;
  androidQrBox: QrBox;
}

/** Points of padding between the dashed placeholder border and the QR image. */
export const QR_INSET_PT = 10;

/**
 * The placeholder boxes are 230 x 230 pt including their dashed border; the stamped
 * QR is 210 x 210 pt after QR_INSET_PT on each side.
 */
export const STANDEE_TEMPLATES: Record<StandeeLanguage, StandeeTemplate> = {
  english: {
    templateName: "Mint Rewards Standee Template - English",
    fileName: "Mint_Rewards_Standee_English.pdf",
    page: 0,
    pageSize: { width: 864, height: 2160 },
    // Left card, labelled "iPhone".
    iosQrBox: { x: 132, y: 212, width: 210, height: 210 },
    // Right card, labelled "Android".
    androidQrBox: { x: 522, y: 212, width: 210, height: 210 },
  },

  /**
   * NOT WIRED UP FOR v1 -- measured and verified, kept here so it never has to be
   * rediscovered.
   *
   * !! The Urdu template is RTL-MIRRORED: iOS is on the RIGHT and Android on the LEFT,
   * !! the reverse of the English template. Its boxes also sit 17 pt higher.
   * Assuming "left == iOS" would send every iPhone user to the Play Store, and the
   * mistake is invisible in the generated PDF unless you read Urdu or decode the codes.
   */
  urdu: {
    templateName: "Mint Rewards Standee Template - Urdu",
    fileName: "Mint_Rewards_Standee_Urdu.pdf",
    page: 0,
    pageSize: { width: 864, height: 2160 },
    // Right card, labelled "آئی فون" (iPhone).
    iosQrBox: { x: 522, y: 229, width: 210, height: 210 },
    // Left card, labelled "اینڈرائیڈ" (Android).
    androidQrBox: { x: 132, y: 229, width: 210, height: 210 },
  },
};

/** The only language offered in v1. */
export const DEFAULT_STANDEE_LANGUAGE: StandeeLanguage = "english";

export function getStandeeTemplate(
  language: StandeeLanguage = DEFAULT_STANDEE_LANGUAGE,
): StandeeTemplate {
  return STANDEE_TEMPLATES[language];
}

export function getQrBox(template: StandeeTemplate, platform: Platform): QrBox {
  return platform === "ios" ? template.iosQrBox : template.androidQrBox;
}
