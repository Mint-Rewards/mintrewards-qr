import { describe, it, expect } from "vitest";
import {
  validateFullName,
  validateUniversityName,
  validateEmail,
  validatePhone,
  NAME_MAX_LENGTH,
  PHONE_INPUT_PATTERN,
  PHONE_MAX_LENGTH,
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

describe("email validation", () => {
  it.each([
    "ayesha.khan@gmail.com",
    "a.b+tag@sub.domain.co.uk",
    "student_2027@lums.edu.pk",
    "MUBASHIR@EXAMPLE.COM",
  ])("accepts %j", (email) => {
    expect(validateEmail(email).ok, `rejected: ${email}`).toBe(true);
  });

  it("lower-cases so one person cannot register twice by changing case", () => {
    expect(validateEmail("  Ayesha.Khan@Gmail.COM  ")).toEqual({
      ok: true,
      value: "ayesha.khan@gmail.com",
    });
  });

  it.each([
    ["no @", "ayeshagmail.com"],
    ["no domain dot", "ayesha@gmail"],
    ["a space", "ayesha khan@gmail.com"],
    ["blank", "   "],
  ])("rejects %s", (_label, email) => {
    expect(validateEmail(email).ok).toBe(false);
  });
});

describe("phone validation", () => {
  it.each([
    ["local", "03001234567"],
    ["local spaced", "0300 1234567"],
    ["local dashed", "0300-1234567"],
    ["international", "+923001234567"],
    ["international spaced", "+92 300 1234567"],
    ["no plus", "923001234567"],
    ["double-zero prefix", "00923001234567"],
    ["bare national", "3001234567"],
  ])("normalises a %s number to one canonical form", (_label, phone) => {
    // The same person writes their number a dozen ways; all must land on one value,
    // or the number cannot identify them later.
    expect(validatePhone(phone)).toEqual({ ok: true, value: "+923001234567" });
  });

  it.each([
    ["a landline", "0421234567"],
    ["too short", "0300123"],
    ["too long", "030012345678"],
    ["letters", "0300abcdefg"],
    ["blank", "   "],
  ])("rejects %s", (_label, phone) => {
    expect(validatePhone(phone).ok).toBe(false);
  });
});

/**
 * The browser gate and the server validator must agree.
 *
 * `pattern` fails closed with a generic native message and no explanation, so if it is
 * stricter than the server the student is blocked from submitting something that was
 * actually fine, with no way to tell why. That failure is invisible in review, so it is
 * asserted here against every format the validator handles.
 */
describe("phone field browser gate", () => {
  // HTML pattern is implicitly anchored; anchor it explicitly to test the same thing.
  const browserGate = new RegExp(`^(?:${PHONE_INPUT_PATTERN})$`);

  const ACCEPTED = [
    "03001234567",
    "0300 1234567",
    "0300-1234567",
    "+923001234567",
    "+92 300 1234567",
    "923001234567",
    "00923001234567",
    "3001234567",
  ];

  it.each(ACCEPTED)("never blocks %j, which the server accepts", (phone) => {
    expect(validatePhone(phone).ok, "server should accept this").toBe(true);
    expect(browserGate.test(phone), "but the browser pattern blocked it").toBe(true);
  });

  it.each([
    ["a landline", "0421234567"],
    ["too short", "0300123"],
    ["too long", "030012345678"],
    ["letters", "0300abcdefg"],
  ])("also catches %s before submit", (_label, phone) => {
    expect(browserGate.test(phone)).toBe(false);
  });

  it("allows enough room for the longest accepted format", () => {
    const longest = "+92 300 1234567";
    expect(longest.length).toBeLessThanOrEqual(PHONE_MAX_LENGTH);
  });
});
