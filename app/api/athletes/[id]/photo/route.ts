import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseDataUrl } from "@/lib/dataUrl";

/**
 * Serve an athlete's avatar as a real, cacheable image. Court boards used to
 * inline every avatar into the HTML as a base64 data URL — megabytes per page,
 * re-sent on every 15-second auto-refresh. Pages now embed
 * `/api/athletes/<id>/photo?v=<updatedAt>` instead: the URL changes when the
 * photo does, so the response can be cached hard.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const athlete = await prisma.athlete.findUnique({
    where: { id },
    select: { photoUrl: true },
  });
  const parsed = athlete?.photoUrl ? parseDataUrl(athlete.photoUrl) : null;
  if (!parsed) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(parsed.bytes), {
    headers: {
      "content-type": parsed.mime,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
