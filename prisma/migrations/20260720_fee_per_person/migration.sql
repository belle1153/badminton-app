-- ค่าธรรมเนียมต่อคน (บาท) ปรับได้จากหน้า Master ข้อมูล
ALTER TABLE "AppSettings" ADD COLUMN "feePerPerson" INTEGER NOT NULL DEFAULT 0;
