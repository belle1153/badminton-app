import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

export async function GET() {
  const types = await prisma.shuttlecockType.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(types);
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const body = await req.json();
  const { name, pricePerPiece } = body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "กรุณาใส่ชื่อ" }, { status: 400 });
  }
  const price = Number(pricePerPiece);
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: "ราคาไม่ถูกต้อง" }, { status: 400 });
  }

  const type = await prisma.shuttlecockType.create({
    data: { name: name.trim(), pricePerPiece: price },
  });
  return NextResponse.json(type);
}
