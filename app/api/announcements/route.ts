import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

const MAX_IMAGE = 400_000;

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const text = typeof body.body === "string" ? body.body : "";
  const imageUrl = body.imageUrl ?? null;

  if (!title) return NextResponse.json({ error: "กรุณาใส่หัวข้อ" }, { status: 400 });
  if (imageUrl !== null && (!String(imageUrl).startsWith("data:image/") || String(imageUrl).length > MAX_IMAGE)) {
    return NextResponse.json({ error: "รูปไม่ถูกต้องหรือใหญ่เกินไป" }, { status: 400 });
  }

  const created = await prisma.announcement.create({
    data: { title, body: text, imageUrl },
  });
  return NextResponse.json(created);
}
