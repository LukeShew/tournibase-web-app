import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LegalFooter } from "@/components/legal-footer";
import { getAppEnvironment } from "@/lib/app-environment";
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

export function generateMetadata(): Metadata {
  const isTestEnvironment = getAppEnvironment() === "test";

  return {
    title: {
      default: "TourniBase",
      template: "%s | TourniBase",
    },
    description: PRODUCT_POSITIONING,
    robots: isTestEnvironment
      ? { follow: false, index: false, nocache: true }
      : { follow: true, index: true },
  };
}

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
