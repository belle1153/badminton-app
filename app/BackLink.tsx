"use client";

/**
 * The one back control for the whole app — a real pill button rather than a bare
 * "←" text link, so it reads as tappable and gives a thumb something to hit on a
 * phone.
 *
 * Two modes:
 *  - default: steps back one entry in browser history, like the device's own
 *    back button, so "back" returns where you actually came from (a session tab
 *    opened from สนามที่กำลังเล่น goes back there, not to the home page).
 *  - `exact`: always navigates to `href`, for top-level pages where "back" means
 *    one specific place.
 * Either way `href` is the real anchor target, so middle-click / open-in-new-tab
 * and no-JS still work.
 */
export default function BackLink({
  href = "/",
  label = "กลับ",
  exact = false,
  className = "",
}: {
  href?: string;
  label?: string;
  exact?: boolean;
  className?: string;
}) {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (exact) return; // let the anchor navigate normally
    // Don't hijack modified clicks — those mean "open elsewhere".
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
    else window.location.href = href;
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 self-start rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 active:scale-95 ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="h-4 w-4 shrink-0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 15L7 10l5-5" />
      </svg>
      {label}
    </a>
  );
}
