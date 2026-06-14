import type { Metadata } from "next";
import { Inter, Cairo } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
});

export const metadata: Metadata = {
  title: "معرض الأشياء — سوق البيع والشراء",
  description: "منصة معرض الأشياء لبيع وشراء الأغراض المستعملة والجديدة",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${inter.variable} ${cairo.variable}`}>
      <body className="antialiased min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
