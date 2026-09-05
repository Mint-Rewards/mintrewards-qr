import QRCode from "qrcode";

/**
 * QR image generation.
 *
 * `margin: 1` is one module of quiet zone. The printed standee adds far more white space
 * around the code via QR_INSET_PT and the card itself, so a wide built-in margin would
 * only shrink the modules for no benefit.
 *
 * Error correction level M (~15% recovery) is the right trade for this use: printed
 * standees pick up scuffs and glare, but higher levels add modules, which shrink each
 * module at a fixed physical size and hurt scanning more than they help.
 */
export const QR_OPTIONS = {
  errorCorrectionLevel: "M",
  margin: 1,
  color: { dark: "#000000ff", light: "#ffffffff" },
} as const;

/** Rendered at 1200 px so the 210 pt printed box is ~410 dpi — comfortably past print need. */
export const QR_PRINT_PIXELS = 1200;

/** High-resolution PNG for stamping into the print PDF. */
export async function generateQrPng(
  data: string,
  width: number = QR_PRINT_PIXELS,
): Promise<Buffer> {
  return QRCode.toBuffer(data, { ...QR_OPTIONS, type: "png", width });
}

/** Small data URL for on-screen previews on the assignment detail page. */
export async function generateQrDataUrl(data: string, width = 320): Promise<string> {
  return QRCode.toDataURL(data, { ...QR_OPTIONS, width });
}
