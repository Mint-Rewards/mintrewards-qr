import "server-only";
import { PDFDocument } from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";
import { generateQrPng } from "@/lib/qr";
import {
  getQrBox,
  getStandeeTemplate,
  type StandeeLanguage,
  type StandeeTemplate,
} from "./config";

export interface StandeeInput {
  iosTrackingUrl: string;
  androidTrackingUrl: string;
  language?: StandeeLanguage;
}

/**
 * Stamps the two QR codes into the existing template and returns the finished PDF.
 *
 * The template is loaded and re-saved unchanged apart from two drawn images, so all
 * original branding, colour, type and page geometry are preserved exactly -- the spec's
 * central requirement.
 */
export async function generateStandeePdf(
  input: StandeeInput,
  templateBytes?: Uint8Array,
): Promise<{ pdf: Uint8Array; template: StandeeTemplate }> {
  const template = getStandeeTemplate(input.language);
  const bytes = templateBytes ?? (await loadTemplateFromDisk(template.fileName));

  const pdf = await PDFDocument.load(bytes);
  const page = pdf.getPages()[template.page];

  if (!page) {
    throw new Error(`Template "${template.fileName}" has no page ${template.page}`);
  }

  // Guard against a swapped or re-exported template silently shifting every coordinate.
  // The boxes are calibrated against this exact page size; if it changes, the QR codes
  // would land in the wrong place and the error would only be visible after printing.
  const { width, height } = page.getSize();
  if (
    Math.abs(width - template.pageSize.width) > 1 ||
    Math.abs(height - template.pageSize.height) > 1
  ) {
    throw new Error(
      `Template page size ${width}x${height} does not match the calibrated ` +
        `${template.pageSize.width}x${template.pageSize.height}. ` +
        `QR placement coordinates in standee/config.ts must be re-measured.`,
    );
  }

  // NOTE: the platform-to-box mapping comes from the template config, never from an
  // assumption about left/right. The Urdu template mirrors the two cards.
  for (const platform of ["ios", "android"] as const) {
    const url = platform === "ios" ? input.iosTrackingUrl : input.androidTrackingUrl;
    const box = getQrBox(template, platform);
    const png = await generateQrPng(url);
    const image = await pdf.embedPng(png);

    page.drawImage(image, {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    });
  }

  return { pdf: await pdf.save(), template };
}

/**
 * Templates live in a fixed `templates/` directory at the project root.
 *
 * The directory segment is a STATIC literal on purpose. Building the path from an
 * environment variable makes Next's static analysis give up and trace the entire
 * project -- every source file and the whole public folder -- into the serverless
 * bundle, which bloats deployments and can breach size limits.
 *
 * STANDEE_TEMPLATE_STORAGE_PATH remains meaningful for the Supabase Storage variant
 * documented in the README; it does not relocate the bundled template.
 */
async function loadTemplateFromDisk(fileName: string): Promise<Uint8Array> {
  // Guard against path traversal even though every caller passes a config constant.
  if (fileName.includes("/") || fileName.includes("..")) {
    throw new Error(`Invalid template file name: ${fileName}`);
  }

  const filePath = path.join(process.cwd(), "templates", fileName);
  try {
    return new Uint8Array(await fs.readFile(filePath));
  } catch {
    throw new Error(
      `Standee template not found at ${filePath}. ` +
        `Ensure templates/${fileName} exists in the deployment.`,
    );
  }
}

/** Storage object path for a generated standee. */
export function standeeStoragePath(
  assignmentId: string,
  referenceCode: string,
  language: StandeeLanguage,
): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${assignmentId}/${referenceCode}-${language}-${stamp}.pdf`;
}
