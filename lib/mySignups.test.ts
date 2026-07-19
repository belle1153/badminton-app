import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { addMySignup, removeMySignup, getMySignups, isMySignup } from "./mySignups";

/**
 * These run in a Node test environment (no real `window`), so each test fakes
 * just enough of the browser global for the `typeof window === "undefined"`
 * guard to pass, and supplies its own localStorage mock.
 */
function installWindow(storage: Storage) {
  (globalThis as unknown as { window: unknown }).window = {};
  (globalThis as unknown as { localStorage: Storage }).localStorage = storage;
}

function realLikeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  } as Storage;
}

/** Simulates Safari private mode / LINE's in-app WebView: getItem is fine,
 *  setItem throws — the exact split that caused the incident. */
function writeThrowingStorage(): Storage {
  const real = realLikeStorage();
  return {
    ...real,
    setItem: () => {
      throw new DOMException("QuotaExceededError");
    },
  } as Storage;
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  delete (globalThis as { localStorage?: unknown }).localStorage;
  vi.restoreAllMocks();
});

describe("mySignups — the incident: setItem throws after a real signup", () => {
  it("addMySignup does not throw when the browser blocks storage writes", () => {
    installWindow(writeThrowingStorage());
    expect(() => addMySignup("s1", "signup-1")).not.toThrow();
  });

  it("removeMySignup does not throw when the browser blocks storage writes", () => {
    installWindow(writeThrowingStorage());
    expect(() => removeMySignup("s1", "signup-1")).not.toThrow();
  });

  it("getMySignups still returns [] afterward — nothing was recorded, consistently", () => {
    installWindow(writeThrowingStorage());
    addMySignup("s1", "signup-1");
    expect(getMySignups("s1")).toEqual([]);
    expect(isMySignup("s1", "signup-1")).toBe(false);
  });
});

describe("mySignups — normal operation (storage works)", () => {
  it("records a signup and can find it again", () => {
    installWindow(realLikeStorage());
    addMySignup("s1", "signup-1");
    expect(getMySignups("s1")).toEqual(["signup-1"]);
    expect(isMySignup("s1", "signup-1")).toBe(true);
  });

  it("holds several people per session on one device", () => {
    installWindow(realLikeStorage());
    addMySignup("s1", "a");
    addMySignup("s1", "b");
    expect(getMySignups("s1").sort()).toEqual(["a", "b"]);
  });

  it("removeMySignup drops only the given id", () => {
    installWindow(realLikeStorage());
    addMySignup("s1", "a");
    addMySignup("s1", "b");
    removeMySignup("s1", "a");
    expect(getMySignups("s1")).toEqual(["b"]);
  });

  it("keeps sessions separate", () => {
    installWindow(realLikeStorage());
    addMySignup("s1", "a");
    addMySignup("s2", "b");
    expect(getMySignups("s1")).toEqual(["a"]);
    expect(getMySignups("s2")).toEqual(["b"]);
  });
});
