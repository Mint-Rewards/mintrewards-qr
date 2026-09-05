import { randomBytes } from "node:crypto";

/**
 * Public tracking codes for QR URLs.
 *
 * Requirements (spec): unique, stable, non-guessable, URL-safe, and never a raw
 * database ID.
 *
 * Alphabet: 32 characters, Crockford-style -- digits and uppercase letters with the
 * ambiguous glyphs removed (no 0/O, no 1/I/L, no U). A code may be read aloud over the
 * phone or typed off a printed standee by a field team member, so look-alike pairs are
 * a real operational cost, not a theoretical one.
 *
 * Length: 12 characters over a 32-character alphabet == 60 bits of entropy. That is far
 * beyond guessable, while keeping the encoded URL short enough to stay a version-3 QR at
 * error-correction level M. Longer codes push the QR version up, shrink each module and
 * measurably hurt scan reliability on a printed standee held at arm's length.
 */
export const TRACKING_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
export const TRACKING_CODE_LENGTH = 12;

/** Reference codes shown to admins; same alphabet, shorter, human-quotable. */
export const REFERENCE_CODE_LENGTH = 8;

/**
 * Draws from a CSPRNG using rejection sampling.
 *
 * The naive `byte % alphabet.length` introduces modulo bias when 256 is not a multiple
 * of the alphabet size (30 here), making some characters likelier than others and
 * quietly reducing effective entropy. Rejecting bytes at or above the largest usable
 * multiple removes the bias entirely.
 */
function randomFromAlphabet(length: number, alphabet: string): string {
  const n = alphabet.length;
  const limit = Math.floor(256 / n) * n; // largest unbiased multiple of n
  let out = "";

  while (out.length < length) {
    // Over-draw so the common case needs a single syscall.
    const buf = randomBytes((length - out.length) * 2);
    for (const byte of buf) {
      if (byte >= limit) continue; // biased tail -- discard
      out += alphabet[byte % n];
      if (out.length === length) break;
    }
  }
  return out;
}

export function generateTrackingCode(): string {
  return randomFromAlphabet(TRACKING_CODE_LENGTH, TRACKING_CODE_ALPHABET);
}

export function generateReferenceCode(): string {
  return `MR-${randomFromAlphabet(REFERENCE_CODE_LENGTH, TRACKING_CODE_ALPHABET)}`;
}

/**
 * Cheap shape check for the public redirect route, so obviously malformed codes are
 * rejected before touching the database.
 */
export function isValidTrackingCodeShape(code: string): boolean {
  if (code.length !== TRACKING_CODE_LENGTH) return false;
  for (const ch of code) {
    if (!TRACKING_CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}

/** Postgres unique-violation SQLSTATE. */
export const UNIQUE_VIOLATION = "23505";

/**
 * Insert-with-retry helper.
 *
 * Uniqueness is enforced by the UNIQUE constraint on qr_codes.tracking_code, not by a
 * pre-flight SELECT -- a pre-check is racy under concurrent assignment creation, whereas
 * the constraint is the actual guarantee. With 60 bits of entropy a collision is
 * vanishingly unlikely; this exists so that if one ever happens the request succeeds
 * anyway instead of surfacing an error to the admin.
 */
export const MAX_CODE_ATTEMPTS = 5;
