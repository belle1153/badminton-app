import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

export async function GET() {
  const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  return NextResponse.json(settings ?? { id: "singleton", qrImageDataUrl: null });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const body = await req.json();
  const { qrImageDataUrl } = body;
  if (typeof qrImageDataUrl !== "string" || !qrImageDataUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "ไฟล์รูปไม่ถูกต้อง" }, { status: 400 });
  }

  const settings = await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", qrImageDataUrl },
    update: { qrImageDataUrl },
  });
  return NextResponse.json(settings);
}
