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

export type ValidationResult = { ok: true; value: string } | { ok: false; error: string };

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
