import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TUATUENG GO!",
  description: "ระบบลงชื่อ จับคู่ และหารค่าใช้จ่ายเล่นแบด",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="bg-brand-800 text-white flex items-center gap-3 px-4 py-2">
          <Image src="/logo.jpg" alt="TUATUENG LAEMCHABANG" width={56} height={56} className="rounded-full" />
          <span className="font-semibold text-base tracking-wide">TUATUENG LAEMCHABANG</span>
        </header>
        {children}
      </body>
    </html>
  );
}
