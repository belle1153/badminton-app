// Client-only helper (uses localStorage) tracking which sign-ups were made
// from THIS device, so self-withdrawal can be limited to your own names.
// Stored as an array per session, so one phone can hold several people.

const keyFor = (sessionId: string) => `badminton_signups_${sessionId}`;
const legacyKey = (sessionId: string) => `badminton_signup_${sessionId}`;

export function getMySignups(sessionId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(keyFor(sessionId));
    const list: string[] = raw ? JSON.parse(raw) : [];
    // Absorb the old single-value key from earlier versions.
    const legacy = localStorage.getItem(legacyKey(sessionId));
    if (legacy && !list.includes(legacy)) list.push(legacy);
    return list;
  } catch {
    return [];
  }
}

export function addMySignup(sessionId: string, signUpId: string): void {
  if (typeof window === "undefined") return;
  const list = getMySignups(sessionId);
  if (!list.includes(signUpId)) list.push(signUpId);
  localStorage.setItem(keyFor(sessionId), JSON.stringify(list));
}

export function removeMySignup(sessionId: string, signUpId: string): void {
  if (typeof window === "undefined") return;
  const list = getMySignups(sessionId).filter((id) => id !== signUpId);
  localStorage.setItem(keyFor(sessionId), JSON.stringify(list));
  if (localStorage.getItem(legacyKey(sessionId)) === signUpId) {
    localStorage.removeItem(legacyKey(sessionId));
  }
}

export function isMySignup(sessionId: string, signUpId: string): boolean {
  return getMySignups(sessionId).includes(signUpId);
}
