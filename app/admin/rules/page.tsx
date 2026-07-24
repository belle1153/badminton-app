import { redirect } from "next/navigation";

/** กฎ was folded into the ประกาศ page (one nav slot for both). Kept as a redirect
 *  so existing links and bookmarks don't 404. */
export default function RulesAdminPage() {
  redirect("/admin/announcements");
}
