import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseDataUrl } from "@/lib/dataUrl";

/**
 * A team's logo as a real, cacheable image — same pattern as athlete photos.
 * Pages embed `/api/games/teams/<id>/logo?v=<updatedAt>`, so the URL changes
 * whenever the logo does and the bytes can be cached for good.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const team = await prisma.gamesTeam.findUnique({ where: { id: teamId }, select: { logoUrl: true } });
  const parsed = team?.logoUrl ? parseDataUrl(team.logoUrl) : null;
  if (!parsed) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(parsed.bytes), {
    headers: {
      "content-type": parsed.mime,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
