import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "badminton_admin_pin";

function adminPin(): string {
  return process.env.ADMIN_PIN ?? "1234";
}

export function isValidPin(pin: string): boolean {
  return pin === adminPin();
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return store.get(ADMIN_COOKIE_NAME)?.value === adminPin();
}
