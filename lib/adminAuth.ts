import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, adminPin } from "./adminCookie";

export { ADMIN_COOKIE_NAME, isValidPin } from "./adminCookie";

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return store.get(ADMIN_COOKIE_NAME)?.value === adminPin();
}
