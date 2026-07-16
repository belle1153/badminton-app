/**
 * Admin cookie name + PIN check, shared by the server (lib/adminAuth) and the
 * Edge middleware. Kept free of `next/headers` so middleware.ts can import it —
 * that module only runs in a server component / route handler context.
 */
export const ADMIN_COOKIE_NAME = "badminton_admin_pin";

export function adminPin(): string {
  return process.env.ADMIN_PIN ?? "1234";
}

export function isValidPin(pin: string): boolean {
  return pin === adminPin();
}
