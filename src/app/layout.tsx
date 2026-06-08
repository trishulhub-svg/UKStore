import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fresh Mart London — UK Grocery Delivery",
  description: "Order fresh groceries online from Fresh Mart London. Same-day delivery on fruits, vegetables, dairy, meat, bakery and more.",
  keywords: ["grocery delivery", "UK grocery", "fresh food", "online supermarket", "same-day delivery", "London"],
  authors: [{ name: "Fresh Mart London" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Fresh Mart London — UK Grocery Delivery",
    description: "Fresh groceries delivered to your door. Order online for same-day delivery.",
    siteName: "Fresh Mart London",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fresh Mart London — UK Grocery Delivery",
    description: "Fresh groceries delivered to your door. Order online for same-day delivery.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
