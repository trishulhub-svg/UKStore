import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ServiceWorkerRegistration } from "@/components/pwa-sw-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Fresh Mart London — UK Grocery Delivery",
  description: "Order fresh groceries online from Fresh Mart London. Same-day delivery on fruits, vegetables, dairy, meat, bakery and more.",
  keywords: ["grocery delivery", "UK grocery", "fresh food", "online supermarket", "same-day delivery", "London"],
  authors: [{ name: "Fresh Mart London" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.svg",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FreshMart",
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
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
