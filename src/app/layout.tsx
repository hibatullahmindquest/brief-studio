import type { Metadata } from "next";
import { Poppins, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Header from "../components/header";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://postforge-ai.vercel.app"),
  title: {
    default: "SCIS — Creative Intelligence System",
    template: "%s | SCIS",
  },
  description:
    "SCIS is an internal AI marketing and creative platform — Meta organic/paid analytics, daily decision signals, reports, and AI creative generation for SifuTutor and NakNgaji.",
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
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${poppins.variable} ${jetbrainsMono.variable} min-h-screen bg-background text-foreground antialiased`}
      >
        <Header />
        {children}
      </body>
    </html>
  );
}
