import type { Metadata } from "next";
import { Manrope, Inter, Sarabun, JetBrains_Mono } from "next/font/google";
import { SessionInit } from "@/components/SessionInit";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sarabun",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "UPLABS — Health Intelligence Platform",
  description: "AI-powered health intelligence by UP Wellness. Science-based, human-centered.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="th"
      className={`${manrope.variable} ${inter.variable} ${sarabun.variable} ${jetbrains.variable}`}
    >
      <body className="font-body">
        <SessionInit />
        {children}
      </body>
    </html>
  );
}
