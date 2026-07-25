import type { Metadata } from "next";
import { Geist, Geist_Mono, Chakra_Petch, Press_Start_2P } from "next/font/google";
import { isAdmin } from "@/lib/adminAuth";
import SiteHeader from "./SiteHeader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Retro-game pair, used only by the player profile. Chakra Petch carries the
// Thai text; Press Start 2P is Latin-only so it is reserved for numerals and
// short markers, never for Thai copy.
const chakraPetch = Chakra_Petch({
  variable: "--font-pixel-body",
  subsets: ["latin", "thai"],
  weight: ["400", "600", "700"],
});

const pressStart = Press_Start_2P({
  variable: "--font-pixel-display",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "TUATUENG GO!",
  description: "ระบบลงชื่อ จับคู่ และหารค่าใช้จ่ายเล่นแบด",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const admin = await isAdmin();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${chakraPetch.variable} ${pressStart.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader admin={admin} />
        {children}
      </body>
    </html>
  );
}
