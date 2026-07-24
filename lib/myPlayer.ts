// Client-only shortcut remembering which player profile is "me", so the home
// page can link straight to it.
//
// This is a convenience ONLY — never the source of truth. Identity lives in the
// profile URL (/player/<athleteId>), because storage writes genuinely fail in
// some in-app browsers: that is exactly how a member ended up unable to withdraw
// a sign-up that had actually succeeded. If this returns null the user simply
// picks their name again.

const KEY = "badminton_me";

export function getMyPlayerId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setMyPlayerId(athleteId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, athleteId);
  } catch {
    // Storage unavailable — the profile URL still works, so this is harmless.
  }
}

export function clearMyPlayerId(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // As above.
  }
}
