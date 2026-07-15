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

  // Update whichever fields were sent — the QR image and the per-person fee are
  // edited from different places in Master ข้อมูล.
  const data: { qrImageDataUrl?: string; feePerPerson?: number } = {};

  if (body.qrImageDataUrl !== undefined) {
    if (typeof body.qrImageDataUrl !== "string" || !body.qrImageDataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "ไฟล์รูปไม่ถูกต้อง" }, { status: 400 });
    }
    data.qrImageDataUrl = body.qrImageDataUrl;
  }

  if (body.feePerPerson !== undefined) {
    const fee = Number(body.feePerPerson);
    if (!Number.isInteger(fee) || fee < 0) {
      return NextResponse.json({ error: "ค่าธรรมเนียมไม่ถูกต้อง" }, { status: 400 });
    }
    data.feePerPerson = fee;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "ไม่มีข้อมูลให้บันทึก" }, { status: 400 });
  }

  const settings = await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });
  return NextResponse.json(settings);
}
