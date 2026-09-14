/**
 * Remembers, on this device, that someone already registered for a campaign.
 *
 * The card lives at a permanent URL (/a/card/[id]), but the screen that reveals it is
 * client state: refresh the page, close the tab, or tap a share link and come back, and
 * it is gone. Re-scanning the QR then returns a blank form, so an ambassador who wanted
 * to post to LinkedIn a day later had no route back to their own card -- and re-filling
 * the form silently created a duplicate registration.
 *
 * Storage is per-campaign, so a student who joins a second campaign still sees a fresh
 * form rather than the previous campaign's card.
 */

export interface StoredRegistration {
  ambassadorId: string;
  fullName: string;
}

const PREFIX = "mint-ambassador";

export function registrationStorageKey(trackingCode: string): string {
  return `${PREFIX}:${trackingCode}`;
}

/**
 * Every access is guarded. Storage throws outright in Safari private mode and can be
 * disabled entirely, and none of that should stop a student registering -- losing the
 * convenience is acceptable, losing the sign-up is not.
 */
function storage(explicit?: Storage): Storage | null {
  if (explicit) return explicit;
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The stored string, unparsed.
 *
 * useSyncExternalStore compares snapshots by reference and re-renders until two agree,
 * so the snapshot has to be a stable primitive. Returning a freshly parsed object here
 * would produce a new reference every call and loop forever; callers parse separately,
 * memoised on this string.
 */
export function readRegistrationRaw(
  trackingCode: string,
  explicit?: Storage,
): string | null {
  const store = storage(explicit);
  if (!store) return null;

  try {
    return store.getItem(registrationStorageKey(trackingCode));
  } catch {
    return null;
  }
}

export function parseRegistration(raw: string | null): StoredRegistration | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredRegistration>;
    // Anything written by an older version, or hand-edited, is treated as absent
    // rather than trusted into a broken link.
    if (!parsed?.ambassadorId || typeof parsed.ambassadorId !== "string") return null;

    return { ambassadorId: parsed.ambassadorId, fullName: parsed.fullName ?? "" };
  } catch {
    return null;
  }
}

export function readRegistration(
  trackingCode: string,
  explicit?: Storage,
): StoredRegistration | null {
  return parseRegistration(readRegistrationRaw(trackingCode, explicit));
}

/**
 * Storage changes in OTHER tabs raise a `storage` event, but changes in this one do
 * not -- so writes here dispatch their own, or the view that just registered would
 * keep showing stale state.
 */
const CHANGE_EVENT = "mint-ambassador:changed";

export function subscribeToRegistration(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function announceChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function writeRegistration(
  trackingCode: string,
  value: StoredRegistration,
  explicit?: Storage,
): void {
  const store = storage(explicit);
  if (!store) return;

  try {
    store.setItem(registrationStorageKey(trackingCode), JSON.stringify(value));
    announceChange();
  } catch {
    // Quota exceeded or storage disabled. The registration itself already succeeded.
  }
}

export function clearRegistration(trackingCode: string, explicit?: Storage): void {
  const store = storage(explicit);
  if (!store) return;

  try {
    store.removeItem(registrationStorageKey(trackingCode));
    announceChange();
  } catch {
    // Nothing to do -- the caller is about to show the form regardless.
  }
}
