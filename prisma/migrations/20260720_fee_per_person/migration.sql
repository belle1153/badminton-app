-- ค่าธรรมเนียมต่อคน (บาท) ปรับได้จากหน้า Master ข้อมูล
-- บวกรวมเข้ากับค่าคอร์ทในหน้าคำนวณ ไม่แสดงเป็นบรรทัดแยก
ALTER TABLE "AppSettings" ADD COLUMN "feePerPerson" INTEGER NOT NULL DEFAULT 5;
