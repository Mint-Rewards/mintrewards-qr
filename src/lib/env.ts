import "server-only";
import { z } from "zod";

/**
 * Server-side environment validation.
 *
 * Validated once at module load so a misconfigured deployment fails loudly at boot
 * rather than at the moment a field team member scans a printed standee.
 *
 * This module is marked `server-only`: importing it from a client component is a build
 * error. That is the guard rail that keeps SUPABASE_SERVICE_ROLE_KEY out of the browser
 * bundle. Anything the browser legitimately needs must go through NEXT_PUBLIC_* and
 * `clientEnv` below.
 */
const serverSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),

  // Server-only. Bypasses RLS -- never expose to the browser.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Redirect destinations.
  IOS_APP_STORE_URL: z.string().url(),
  ANDROID_PLAY_STORE_URL: z.string().url(),

  /**
   * Base URL encoded into every QR code. This is BAKED INTO PRINTED STANDEES -- once a
   * standee is printed, changing this value orphans it permanently. Confirm the final
   * production domain before the first print run.
   */
  QR_PUBLIC_BASE_URL: z.string().url(),

  /** Where an invalid or unknown tracking code sends the user. Never an error page. */
  QR_FALLBACK_URL: z.string().url(),

  STANDEE_TEMPLATE_STORAGE_PATH: z.string().default("templates"),
  GENERATED_STANDEES_BUCKET: z.string().default("generated-standees"),
  QR_IMAGES_BUCKET: z.string().default("qr-images"),

  /**
   * PUBLIC bucket, unlike the two above. Ambassador cards are meant to be reshared on
   * LinkedIn/Instagram, and link-preview crawlers fetch the image unauthenticated,
   * whenever someone eventually views the post -- long after any signed URL would
   * have expired. The card contains only what the student chose to submit and is
   * about to post publicly themselves, so this is an intentional, narrow exception to
   * "storage stays private."
   */
  AMBASSADOR_CARDS_BUCKET: z.string().default("ambassador-cards"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

function loadEnv(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\n` +
        `Copy .env.example to .env.local and fill in the missing values.`,
    );
  }
  return parsed.data;
}

export const env: ServerEnv = loadEnv();

/** Trailing slashes here would produce `//r/ios/...` in printed QR payloads. */
export function qrBaseUrl(): string {
  return env.QR_PUBLIC_BASE_URL.replace(/\/+$/, "");
}

export function buildTrackingUrl(platform: "ios" | "android", trackingCode: string): string {
  return `${qrBaseUrl()}/r/${platform}/${trackingCode}`;
}

/** Public registration-form URL encoded into an ambassador campaign's QR code. */
export function buildAmbassadorUrl(trackingCode: string): string {
  return `${qrBaseUrl()}/a/${trackingCode}`;
}

export function destinationUrlFor(platform: "ios" | "android"): string {
  return platform === "ios" ? env.IOS_APP_STORE_URL : env.ANDROID_PLAY_STORE_URL;
}
