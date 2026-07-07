import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LegalFooter } from "@/components/legal-footer";
import { PRODUCT_POSITIONING } from "@/lib/product-copy";
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
  title: {
    default: "TourniBase",
    template: "%s | TourniBase",
  },
  description: PRODUCT_POSITIONING,
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
      <body className="light-ui flex min-h-full flex-col">
        <div className="flex-1">{children}</div>
        <LegalFooter />
      </body>
    </html>
  );
}
