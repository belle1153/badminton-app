import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseDataUrl } from "@/lib/dataUrl";

/**
 * Serve an announcement/rule image as a real, cacheable image. The home and
 * rules pages used to inline these as base64 — the home page alone shipped
 * ~580 KB of HTML on every visit. Pages embed
 * `/api/announcements/<id>/image?v=<updatedAt>` now; editing the announcement
 * bumps updatedAt, which busts the URL.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ann = await prisma.announcement.findUnique({
    where: { id },
    select: { imageUrl: true },
  });
  const parsed = ann?.imageUrl ? parseDataUrl(ann.imageUrl) : null;
  if (!parsed) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(parsed.bytes), {
    headers: {
      "content-type": parsed.mime,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
