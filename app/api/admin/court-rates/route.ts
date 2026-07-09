import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

export async function GET() {
  const rates = await prisma.courtRate.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(rates);
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const body = await req.json();
  const { name, pricePerHour } = body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "กรุณาใส่ชื่อ" }, { status: 400 });
  }
  const price = Number(pricePerHour);
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: "ราคาไม่ถูกต้อง" }, { status: 400 });
  }

  const rate = await prisma.courtRate.create({
    data: { name: name.trim(), pricePerHour: price },
  });
  return NextResponse.json(rate);
}
