import { describe, it, expect } from "vitest";
import {
  validateFullName,
  validateUniversityName,
  NAME_MAX_LENGTH,
} from "@/lib/ambassador/validation";

/**
 * The false-rejection cases matter more than the false-acceptance ones.
 *
 * A student whose real name is refused has no recourse and simply leaves; junk that
 * slips through is visible to an admin on the roster. So the accept list below is the
 * more important half of this file, and any new gibberish heuristic has to keep it
 * green.
 */
describe("full name validation", () => {
  it.each([
    "Ayesha Khan",
    "Muhammad Abdul Rahman Khan",
    "Abdurrahman Al-Hussaini",
    "Muhammad A. Khan",
    "Zainab Fatima Sheikh",
    "Syed Ali Raza Naqvi",
    "Hafiz Muhammad Usman",
    "Mir Chakar Khan Rind",
    "Aisha O'Brien",
    "Jean-Pierre Dubois",
    "Li Wei",
    "Ali",
  ])("accepts the real name %j", (name) => {
    const result = validateFullName(name);
    expect(result.ok, `rejected: ${JSON.stringify(name)}`).toBe(true);
  });

  it("collapses padding so spacing cannot be used to pad a name", () => {
    const result = validateFullName("  Ayesha    Khan  ");
    expect(result).toEqual({ ok: true, value: "Ayesha Khan" });
  });

  it.each([
    ["a digit", "Ayesha Khan 123"],
    ["only digits", "12345"],
    ["an email address", "ayesha@example.com"],
    ["a URL", "https://example.com"],
    ["markup", "<script>alert(1)</script>"],
    ["an emoji", "Ayesha 🎉"],
    ["too short", "A"],
    ["blank", "   "],
  ])("rejects %s", (_label, name) => {
    expect(validateFullName(name).ok).toBe(false);
  });

  it("rejects a name longer than the limit", () => {
    expect(validateFullName("A".repeat(NAME_MAX_LENGTH + 1)).ok).toBe(false);
  });

  it.each([
    ["keyboard mashing", "asdfgh"],
    ["home row backwards", "lkjhgf"],
    ["a qwerty run", "qwerty"],
    ["repeated letters", "aaaa"],
    ["a repeated letter inside a word", "Khaaaan"],
    ["an unpronounceable consonant run", "bcdfghjk"],
  ])("rejects %s", (_label, name) => {
    expect(validateFullName(name).ok).toBe(false);
  });
});

describe("university name validation", () => {
  it.each([
    "University of Lahore",
    "Ghulam Ishaq Khan Institute of Engineering Sciences and Technology",
    "Shaheed Zulfikar Ali Bhutto Institute of Science and Technology (SZABIST)",
    "Forman Christian College (A Chartered University)",
    "Sardar Bahadur Khan Women's University",
    "NED University of Engineering & Technology",
  ])("accepts %j", (name) => {
    expect(validateUniversityName(name).ok, `rejected: ${name}`).toBe(true);
  });

  it.each([
    ["too short", "X"],
    ["markup", "<b>uni</b>"],
    ["keyboard mashing", "asdfasdf"],
  ])("rejects %s", (_label, name) => {
    expect(validateUniversityName(name).ok).toBe(false);
  });
});
