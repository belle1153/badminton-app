"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { isAdminPath } from "@/lib/adminPath";
import AdminSwitch from "./AdminSwitch";

/**
 * The top bar, orange while on an admin route (/admin/*, /session/<id>/admin/*)
 * as an unmissable "you're in admin mode" cue, navy everywhere else. Route-only
 * check — nobody who isn't an admin can even reach an admin route (proxy.ts
 * 404s it), so this never needs the admin cookie itself to decide the colour.
 */
export default function SiteHeader({ admin }: { admin: boolean }) {
  const pathname = usePathname();
  const onAdmin = isAdminPath(pathname);

  return (
    <header
      className={`flex items-center gap-3 px-4 py-2 text-white transition-colors ${
        onAdmin ? "bg-orange-400" : "bg-brand-800"
      }`}
    >
      <Image src="/logo.jpg" alt="TUATUENG LAEMCHABANG" width={56} height={56} className="rounded-full" />
      <span className="font-semibold text-base tracking-wide">TUATUENG LAEMCHABANG</span>
      {admin && <AdminSwitch />}
    </header>
  );
}
