import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json([]);
  }

  const athletes = await prisma.athlete.findMany({
    where: { name: { contains: q } },
    orderBy: { name: "asc" },
    take: 10,
  });

  return NextResponse.json(athletes);
}
