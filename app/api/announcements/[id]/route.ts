import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

const MAX_IMAGE = 400_000;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const data: { title?: string; body?: string; imageUrl?: string | null; active?: boolean } = {};

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) return NextResponse.json({ error: "กรุณาใส่หัวข้อ" }, { status: 400 });
    data.title = title;
  }
  if (body.body !== undefined) data.body = String(body.body);
  if (body.active !== undefined) data.active = Boolean(body.active);
  if (body.imageUrl !== undefined) {
    if (body.imageUrl === null) {
      data.imageUrl = null;
    } else {
      const url = String(body.imageUrl);
      if (!url.startsWith("data:image/") || url.length > MAX_IMAGE) {
        return NextResponse.json({ error: "รูปไม่ถูกต้องหรือใหญ่เกินไป" }, { status: 400 });
      }
      data.imageUrl = url;
    }
  }

  try {
    const updated = await prisma.announcement.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "ไม่พบประกาศนี้" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }
  const { id } = await params;
  try {
    await prisma.announcement.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "ไม่พบประกาศนี้" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
