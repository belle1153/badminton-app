"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isAdminPath } from "@/lib/adminPath";

/**
 * Header shortcut for logged-in admins to hop between the player view and the
 * admin side. Rendered only when the server has already confirmed an admin
 * cookie, so nobody else ever sees it — the app stays fully hidden for players.
 *
 * On an admin URL it offers "ดูหน้า user" (and remembers which session you were
 * managing so "แอดมิน" jumps back to that session, not the generic list); on a
 * player URL it offers the way in.
 */
export default function AdminSwitch() {
  const pathname = usePathname();
  const onAdmin = isAdminPath(pathname);

  // /session/<id>/... → keep the id so we can return to this day's admin.
  const sessionMatch = pathname.match(/^\/session\/([^/]+)/);
  const adminHref = sessionMatch ? `/session/${sessionMatch[1]}/admin` : "/admin";
  const userHref = sessionMatch ? `/session/${sessionMatch[1]}` : "/";

  // `replace`, not push: switching view is a mode toggle, not a place you'd
  // "back" into. Replacing the entry keeps the admin↔user switch out of history,
  // so a "ดูหน้า user" jump to a day page then Back returns to the user home —
  // not the admin page you switched away from.
  return onAdmin ? (
    <Link
      href={userHref}
      replace
      className="ml-auto shrink-0 rounded-full bg-white/15 hover:bg-white/25 px-3 py-1.5 text-xs font-medium text-white transition"
    >
      👁 ดูหน้า user
    </Link>
  ) : (
    <Link
      href={adminHref}
      replace
      className="ml-auto shrink-0 rounded-full bg-white/15 hover:bg-white/25 px-3 py-1.5 text-xs font-medium text-white transition"
    >
      ⚙️ แอดมิน
    </Link>
  );
}
