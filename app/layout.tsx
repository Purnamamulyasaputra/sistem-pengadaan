import type { Metadata } from "next";
import { Cabin, Albert_Sans } from "next/font/google";
import "./globals.css";
import Providers from "@/components/shared/Providers";

const cabin = Cabin({
  subsets: ["latin"],
  variable: "--font-cabin",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const albertSans = Albert_Sans({
  subsets: ["latin"],
  variable: "--font-albert-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Sunrise Daily | Sistem Pengadaan & Inventory",
  description: "Centralized Procurement & Inventory Management System for Sunrise Daily F&B Holdings",
  keywords: ["procurement", "inventory", "pengadaan", "sunrise daily", "er coffeelab"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${cabin.variable} ${albertSans.variable}`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
