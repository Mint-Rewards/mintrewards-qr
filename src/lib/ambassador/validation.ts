/**
 * Input rules for the public ambassador registration form.
 *
 * This is the one place in the app that accepts writes from anonymous strangers, and
 * whatever it accepts gets printed onto a card the student then posts publicly. So the
 * rules are tighter than a typical form: the cost of rejecting an unusual name is one
 * support message, while the cost of accepting junk is a MintRewards-branded card with
 * junk on it circulating on LinkedIn.
 */

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 60;
export const UNIVERSITY_MAX_LENGTH = 90;

/**
 * Letters, spaces and the three punctuation marks that appear in real names:
 * hyphen (Al-Hussaini), apostrophe (O'Brien) and full stop (Muhammad A. Khan).
 *
 * Deliberately Latin-only. The card renders through Liberation Sans, which has no
 * Urdu or Arabic glyphs -- a name in Urdu script would come out as empty boxes on the
 * card rather than being rejected here, which is a far worse failure.
 */
const NAME_ALLOWED = /^[A-Za-z][A-Za-z\s'.-]*$/;

/** University names additionally carry commas, ampersands and parentheses. */
const UNIVERSITY_ALLOWED = /^[A-Za-z][A-Za-z0-9\s'.,&()-]*$/;

export const EMAIL_MAX_LENGTH = 120;

export type ValidationResult = { ok: true; value: string } | { ok: false; error: string };

/**
 * Deliberately loose. Email syntax is famously permissive, and the only authority on
 * whether an address exists is sending to it -- so this rejects the shapes that are
 * unambiguously wrong (no @, no dot in the domain, whitespace) and lets everything
 * else through rather than turning away a student with an unusual but valid address.
 *
 * Stored lower-cased so the same person cannot register twice with different casing.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function validateEmail(raw: string): ValidationResult {
  const value = raw.trim().toLowerCase();

  if (!value) return { ok: false, error: "Please enter your email address." };
  if (value.length > EMAIL_MAX_LENGTH) {
    return { ok: false, error: `Email must be ${EMAIL_MAX_LENGTH} characters or fewer.` };
  }
  if (!EMAIL_SHAPE.test(value)) {
    return { ok: false, error: "That doesn't look like a valid email address." };
  }

  return { ok: true, value };
}

/**
 * Pakistani mobile numbers, normalised to +923XXXXXXXXX.
 *
 * Students write the same number a dozen ways -- 0300 1234567, 0300-1234567,
 * +92 300 1234567, 92-300-1234567 -- and all of them are the same person. Storing one
 * canonical form is what lets the number identify someone later; storing whatever they
 * typed would make that impossible.
 *
 * Landlines are rejected on purpose: this is for contacting ambassadors about a
 * cleanup drive, where a mobile is the point.
 */
/**
 * Browser-side gate for the phone field, deliberately mirroring validatePhone below.
 *
 * `type="tel"` validates nothing -- it only picks the on-screen keyboard -- so without
 * this a student could type anything and only discover it was wrong after submitting.
 * The HTML `pattern` attribute is implicitly anchored, so no ^ or $ here.
 *
 * The two MUST agree, or the browser silently blocks input the server would have
 * accepted, with a generic native message and no way for the student to tell why.
 * `tests/ambassador-validation.test.ts` asserts that agreement across every format.
 */
export const PHONE_INPUT_PATTERN = "(?:\\+?92|0092|0)?[\\s.-]?3\\d{2}[\\s.-]?\\d{7}";

/** Long enough for "+92 300 1234567" and any separator style around it. */
export const PHONE_MAX_LENGTH = 20;

export function validatePhone(raw: string): ValidationResult {
  // Everything a human might use as a separator.
  const digits = raw.replace(/[\s()\-.]/g, "");

  if (!digits) return { ok: false, error: "Please enter your mobile number." };
  if (/[^\d+]/.test(digits)) {
    return { ok: false, error: "Mobile number can only contain digits." };
  }

  let national: string | null = null;
  if (/^0(3\d{9})$/.test(digits)) national = digits.slice(1);
  else if (/^\+92(3\d{9})$/.test(digits)) national = digits.slice(3);
  else if (/^92(3\d{9})$/.test(digits)) national = digits.slice(2);
  else if (/^0092(3\d{9})$/.test(digits)) national = digits.slice(4);
  else if (/^(3\d{9})$/.test(digits)) national = digits;

  if (!national) {
    return {
      ok: false,
      error: "Enter a Pakistani mobile number, like 0300 1234567.",
    };
  }

  return { ok: true, value: `+92${national}` };
}

/**
 * Collapses runs of whitespace so "Ayesha    Khan" and "Ayesha Khan" are the same
 * person, and so padding cannot be used to fake a longer name.
 */
function normalise(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function validateFullName(raw: string): ValidationResult {
  const value = normalise(raw);

  if (value.length < NAME_MIN_LENGTH) {
    return { ok: false, error: "Please enter your full name." };
  }
  if (value.length > NAME_MAX_LENGTH) {
    return { ok: false, error: `Name must be ${NAME_MAX_LENGTH} characters or fewer.` };
  }
  if (/\d/.test(value)) {
    return { ok: false, error: "Name cannot contain numbers." };
  }
  if (!NAME_ALLOWED.test(value)) {
    return { ok: false, error: "Name can only contain letters, spaces, hyphens and apostrophes." };
  }
  if (looksLikeGibberish(value)) {
    return { ok: false, error: "Please enter your real name." };
  }

  return { ok: true, value };
}

export function validateUniversityName(raw: string): ValidationResult {
  const value = normalise(raw);

  if (value.length < 3) {
    return { ok: false, error: "Please enter your university's name." };
  }
  if (value.length > UNIVERSITY_MAX_LENGTH) {
    return { ok: false, error: `University must be ${UNIVERSITY_MAX_LENGTH} characters or fewer.` };
  }
  if (!UNIVERSITY_ALLOWED.test(value)) {
    return { ok: false, error: "University name contains characters that aren't allowed." };
  }
  if (looksLikeGibberish(value)) {
    return { ok: false, error: "Please enter your university's real name." };
  }

  return { ok: true, value };
}

/**
 * Cheap keyboard-mashing heuristics.
 *
 * These cannot detect gibberish in general, and they are not trying to -- each one
 * targets a pattern that real names do not produce, and stops short of anything that
 * would reject an unfamiliar but legitimate name. Anything subtler is left to the
 * admin reviewing the roster, since a false rejection is invisible to us and the
 * student simply gives up.
 */
export function looksLikeGibberish(value: string): boolean {
  const letters = value.replace(/[^A-Za-z]/g, "");

  // "A" alone, or "A. B." -- not enough to be a name.
  if (letters.length < 2) return true;

  // "aaaa", "Khaaaaan". Three identical letters in a row does not occur in real names.
  if (/([A-Za-z])\1{2,}/.test(value)) return true;

  // "bcdfg", "qwrtp". A run this long with no vowel is not pronounceable; the cutoff
  // is generous enough to clear names like "Khyber" and Welsh-style spellings.
  if (/[^aeiouAEIOU\s'.-]{6,}/.test(value)) return true;

  // "asdf", "qwerty" and the rest of the home row, in either direction.
  const lower = letters.toLowerCase();
  const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
  for (const row of ROWS) {
    for (let i = 0; i + 4 <= row.length; i++) {
      const run = row.slice(i, i + 4);
      if (lower.includes(run) || lower.includes([...run].reverse().join(""))) return true;
    }
  }

  return false;
}
