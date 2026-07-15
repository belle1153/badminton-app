"use client";

/**
 * "← กลับ" that steps back one entry in browser history (like the real back
 * button), instead of always jumping to a fixed page. Fixes the reported bug
 * where "back" from any session tab (e.g. opened via "เปิดหน้าวัน" from
 * สนามที่กำลังเล่น) skipped straight to the home page rather than returning to
 * whatever page the person actually came from.
 *
 * Falls back to `fallbackHref` when there's no in-app history to go back to
 * (e.g. the page was opened directly from a shared link / new tab).
 */
export default function BackLink({
  fallbackHref = "/",
  label = "← กลับ",
  className = "text-sm text-gray-500 hover:underline",
}: {
  fallbackHref?: string;
  label?: string;
  className?: string;
}) {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = fallbackHref;
    }
  }

  return (
    <a href={fallbackHref} onClick={handleClick} className={className}>
      {label}
    </a>
  );
}
