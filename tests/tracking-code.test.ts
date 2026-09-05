import { describe, it, expect } from "vitest";
import {
  generateTrackingCode,
  generateReferenceCode,
  isValidTrackingCodeShape,
  TRACKING_CODE_ALPHABET,
  TRACKING_CODE_LENGTH,
} from "@/lib/tracking-code";

describe("tracking codes", () => {
  it("has the configured length and alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateTrackingCode();
      expect(code).toHaveLength(TRACKING_CODE_LENGTH);
      for (const ch of code) expect(TRACKING_CODE_ALPHABET).toContain(ch);
    }
  });

  it("excludes ambiguous glyphs that get misread off a printed standee", () => {
    // 0/O, 1/I/L and U are deliberately absent so a code can be read aloud or
    // re-typed by a field team member without ambiguity.
    for (const ch of ["0", "O", "1", "I", "L", "U"]) {
      expect(TRACKING_CODE_ALPHABET).not.toContain(ch);
    }
  });

  it("is URL-safe (no escaping needed)", () => {
    const code = generateTrackingCode();
    expect(encodeURIComponent(code)).toBe(code);
  });

  it("does not collide across a large sample", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20_000; i++) seen.add(generateTrackingCode());
    expect(seen.size).toBe(20_000);
  });

  it("distributes characters without modulo bias", () => {
    // 256 is not a multiple of the 30-character alphabet, so naive `byte % len`
    // would make early characters measurably likelier. Rejection sampling should
    // keep every character within a tight band of the expected frequency.
    const counts = new Map<string, number>();
    const samples = 60_000;
    for (let i = 0; i < samples / TRACKING_CODE_LENGTH; i++) {
      for (const ch of generateTrackingCode()) {
        counts.set(ch, (counts.get(ch) ?? 0) + 1);
      }
    }
    const expected = samples / TRACKING_CODE_ALPHABET.length;
    for (const ch of TRACKING_CODE_ALPHABET) {
      const got = counts.get(ch) ?? 0;
      expect(Math.abs(got - expected) / expected).toBeLessThan(0.15);
    }
  });

  it("validates shape and rejects malformed input", () => {
    expect(isValidTrackingCodeShape(generateTrackingCode())).toBe(true);
    expect(isValidTrackingCodeShape("")).toBe(false);
    expect(isValidTrackingCodeShape("SHORT")).toBe(false);
    expect(isValidTrackingCodeShape("0".repeat(TRACKING_CODE_LENGTH))).toBe(false); // '0' not in alphabet
    expect(isValidTrackingCodeShape("../../etc/pw")).toBe(false);
    expect(isValidTrackingCodeShape("abcdefghjkmn")).toBe(false); // lowercase
  });

  it("prefixes reference codes for admin readability", () => {
    expect(generateReferenceCode()).toMatch(/^MR-[A-Z0-9]{8}$/);
  });
});
