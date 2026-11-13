import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { siteDescription, siteUrl } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  // Only used for small labels and figures, never above the main heading:
  // keep it off the critical path.
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Planwerk",
  description: siteDescription,
  openGraph: {
    title: "Planwerk",
    description: siteDescription,
    url: "/",
    siteName: "Planwerk",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Planwerk", description: siteDescription },
};

export const viewport: Viewport = {
  // Lets the browser draw scrollbars and form controls dark before the CSS loads.
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
