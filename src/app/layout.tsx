import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegistration } from "@/components/pwa-sw-register";
import { StoreInfoProvider } from "@/lib/store-info";
import { DeliveryLocationProvider } from "@/lib/delivery-location";

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

export async function generateMetadata(): Promise<Metadata> {
  // Read store name from DB for dynamic metadata
  let storeName = "Fresh Mart";
  try {
    const { getPrisma } = await import("@/lib/auth/prisma");
    const prisma = await getPrisma();
    const store = await prisma.store.findFirst({ where: { isActive: true } });
    if (store?.name) storeName = store.name;
  } catch {}

  return {
    title: `${storeName} — UK Grocery Delivery`,
    description: `Order fresh groceries online from ${storeName}. Same-day delivery on fruits, vegetables, dairy, meat, bakery and more.`,
    keywords: ["grocery delivery", "UK grocery", "fresh food", "online supermarket", "same-day delivery"],
    authors: [{ name: storeName }],
    manifest: "/manifest.json",
    icons: {
      icon: "/logo.svg",
      apple: "/icon-192.png",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: storeName,
    },
    openGraph: {
      title: `${storeName} — UK Grocery Delivery`,
      description: "Fresh groceries delivered to your door. Order online for same-day delivery.",
      siteName: storeName,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${storeName} — UK Grocery Delivery`,
      description: "Fresh groceries delivered to your door. Order online for same-day delivery.",
    },
  };
}

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
        <StoreInfoProvider>
          <DeliveryLocationProvider>
            {children}
          </DeliveryLocationProvider>
        </StoreInfoProvider>
        <Toaster />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
