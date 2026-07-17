import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "./adminCookie";

export { ADMIN_COOKIE_NAME, ADMIN_SESSION_DAYS, isValidPin, issueAdminToken } from "./adminCookie";

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminToken(store.get(ADMIN_COOKIE_NAME)?.value);
}
