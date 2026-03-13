import type { Metadata } from "next";
import { Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "../components/header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const editorialSerif = Cormorant_Garamond({
  variable: "--font-editorial-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://postforge-ai.vercel.app"),
  title: {
    default: "PostForge AI | AI Social Media Generator for Brands",
    template: "%s | PostForge AI",
  },
  description:
    "PostForge AI is an AI social media generator that creates Instagram posts, captions, ad copy, gym promotions, and startup marketing content in seconds.",
  keywords: [
    "AI social media generator",
    "AI caption generator",
    "AI marketing copy tool",
    "AI Instagram post generator",
    "social media content generator",
    "ad copy generator",
  ],
  openGraph: {
    title: "PostForge AI",
    description:
      "Create viral-ready social media posts, captions, ad copy, and promotions in seconds with AI.",
    siteName: "PostForge AI",
    type: "website",
    url: "https://postforge-ai.vercel.app",
    images: [
      {
        url: "/images/preview.png",
        width: 1200,
        height: 630,
        alt: "PostForge AI website preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PostForge AI",
    description:
      "Generate Instagram posts, captions, ad copy, promotions, and hashtags instantly.",
    images: ["/images/preview.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${editorialSerif.variable} min-h-screen bg-background text-foreground antialiased`}
      >
        <Header />
        <div className="pt-24">{children}</div>
      </body>
    </html>
  );
}
