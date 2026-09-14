import { describe, it, expect } from "vitest";
import {
  readRegistration,
  writeRegistration,
  clearRegistration,
  registrationStorageKey,
} from "@/lib/ambassador/registration-storage";

/** Minimal in-memory Storage, so these run without a DOM. */
function fakeStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

/** Storage that throws on every access, as Safari private mode does. */
function hostileStorage(): Storage {
  const boom = () => { throw new Error("storage disabled"); };
  return {
    get length(): number { return boom(); },
    clear: boom, getItem: boom, key: boom, removeItem: boom, setItem: boom,
  } as unknown as Storage;
}

describe("registration storage", () => {
  const code = "PM63GC7KX87H";

  it("round-trips a registration", () => {
    const store = fakeStorage();
    writeRegistration(code, { ambassadorId: "abc-123", fullName: "Ayesha Khan" }, store);

    expect(readRegistration(code, store)).toEqual({
      ambassadorId: "abc-123",
      fullName: "Ayesha Khan",
    });
  });

  it("scopes storage per campaign, so joining a second campaign shows a fresh form", () => {
    const store = fakeStorage();
    writeRegistration(code, { ambassadorId: "abc-123", fullName: "Ayesha Khan" }, store);

    expect(readRegistration("ZZZZ23456789", store)).toBeNull();
    expect(registrationStorageKey(code)).not.toBe(registrationStorageKey("ZZZZ23456789"));
  });

  it("forgets the registration so a shared phone can register the next student", () => {
    const store = fakeStorage();
    writeRegistration(code, { ambassadorId: "abc-123", fullName: "Ayesha Khan" }, store);
    clearRegistration(code, store);

    expect(readRegistration(code, store)).toBeNull();
  });

  it("returns null for nothing stored", () => {
    expect(readRegistration(code, fakeStorage())).toBeNull();
  });

  it.each([
    ["malformed JSON", "{not json"],
    ["an empty object", "{}"],
    ["a missing id", JSON.stringify({ fullName: "Ayesha Khan" })],
    ["a non-string id", JSON.stringify({ ambassadorId: 42 })],
  ])("treats %s as absent rather than building a broken link", (_label, raw) => {
    const store = fakeStorage({ [registrationStorageKey(code)]: raw });
    expect(readRegistration(code, store)).toBeNull();
  });

  it("tolerates a name written by an older version", () => {
    const store = fakeStorage({
      [registrationStorageKey(code)]: JSON.stringify({ ambassadorId: "abc-123" }),
    });
    expect(readRegistration(code, store)).toEqual({ ambassadorId: "abc-123", fullName: "" });
  });

  it("never throws when storage itself is unavailable", () => {
    // Private mode must cost the convenience, never the registration.
    const store = hostileStorage();
    expect(() => writeRegistration(code, { ambassadorId: "a", fullName: "b" }, store)).not.toThrow();
    expect(() => clearRegistration(code, store)).not.toThrow();
    expect(readRegistration(code, store)).toBeNull();
  });
});
