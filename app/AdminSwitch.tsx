"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isAdminPath } from "@/lib/adminPath";

/**
 * Header controls for a logged-in admin: hop between the player view and the
 * admin side, and log out. Rendered only when the server has already confirmed
 * an admin cookie, so nobody else ever sees it — the app stays fully hidden for
 * players.
 *
 * On an admin URL it offers "ดูหน้า user" (and remembers which session you were
 * managing so "แอดมิน" jumps back to that session, not the generic list); on a
 * player URL it offers the way in.
 *
 * Logout lives here rather than in AdminNav so the nav below can fit its items
 * on one row.
 */
export default function AdminSwitch() {
  const pathname = usePathname();
  const router = useRouter();
  const onAdmin = isAdminPath(pathname);

  // /session/<id>/... → keep the id so we can return to this day's admin.
  const sessionMatch = pathname.match(/^\/session\/([^/]+)/);
  const adminHref = sessionMatch ? `/session/${sessionMatch[1]}/admin` : "/admin";
  const userHref = sessionMatch ? `/session/${sessionMatch[1]}` : "/";

  const pill =
    "shrink-0 rounded-full bg-white/15 hover:bg-white/25 px-3 py-1.5 text-xs font-medium text-white transition";

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      {/* `replace`, not push: switching view is a mode toggle, not a place you'd
          "back" into. Replacing the entry keeps the admin↔user switch out of
          history, so a "ดูหน้า user" jump to a day page then Back returns to the
          user home — not the admin page you switched away from. */}
      {onAdmin ? (
        <Link href={userHref} replace className={pill}>
          👁 ดูหน้า user
        </Link>
      ) : (
        <Link href={adminHref} replace className={pill}>
          ⚙️ แอดมิน
        </Link>
      )}

      <button onClick={logout} title="ออกจากระบบ" className={pill}>
        🚪<span className="ml-1 hidden sm:inline">ออกจากระบบ</span>
      </button>
    </div>
  );
}
