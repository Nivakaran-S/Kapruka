import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Sinhala, Rubik } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display/heading face — friendly, modern, retail-leaning (per ui-ux-pro-max pairing).
const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const notoSinhala = Noto_Sans_Sinhala({
  variable: "--font-noto-sinhala",
  subsets: ["sinhala"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Kavi — Sri Lanka's AI Shopping Companion",
  description:
    "Kavi is a warm, Sinhala-first AI shopping companion for Kapruka. Find the perfect gift for any occasion — in English, Sinhala, or Tanglish.",
};

export const viewport: Viewport = {
  themeColor: "#0f6e56",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${rubik.variable} ${notoSinhala.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full">
        {children}
      </body>
    </html>
  );
}
