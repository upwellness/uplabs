import type { Metadata } from "next";
import { Manrope, Inter, Sarabun, JetBrains_Mono } from "next/font/google";
import { SessionInit } from "@/components/SessionInit";
import { ViewAsBanner } from "@/components/ViewAsBanner";
import { getSession } from "@/lib/auth/session";
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
  title: "UP Wellness Ops — Health Intelligence Platform",
  description: "AI-powered health intelligence by UP Wellness. Science-based, human-centered.",
  metadataBase: new URL("https://upwellness.vercel.app"),
  icons: { icon: "/favicon.ico" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <html
      lang="th"
      className={`${manrope.variable} ${inter.variable} ${sarabun.variable} ${jetbrains.variable}`}
    >
      <body className="font-body">
        <SessionInit />
        {session?.viewAs?.active && (
          <ViewAsBanner
            label={session.profile.display_name ?? session.profile.email ?? session.user.id}
            adminLabel={session.viewAs.adminLabel}
          />
        )}
        {children}
      </body>
    </html>
  );
}
