/** True for any admin-facing route (/admin/*, /session/<id>/admin/*). Shared by
 *  the header (bar colour) and AdminSwitch (button label) so they can never
 *  disagree on what counts as "in the admin view". */
export function isAdminPath(pathname: string): boolean {
  return pathname.includes("/admin");
}
