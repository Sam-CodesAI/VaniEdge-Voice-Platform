import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://vaniedge.vercel.app"),
  title: "VaniEdge Voice Platform — Sub-Second Edge Voice AI & Telephony",
  description:
    "Autonomous 24/7 multi-lingual AI phone answering and voice dispatch for clinics, restaurants, and local businesses.",
  keywords: [
    "voice AI",
    "telephony",
    "AI receptionist",
    "local business voice agent",
    "sub-second latency",
    "SutraDB",
    "ElevenLabs",
  ],
  authors: [{ name: "Samarth Nimangre", url: "https://sam-codes.vercel.app" }],
  icons: {
    icon: "/vaniedge-logo.png",
    shortcut: "/vaniedge-logo.png",
    apple: "/vaniedge-logo.png",
  },
  openGraph: {
    title: "VaniEdge Voice Platform — Enterprise Voice AI & Telephony",
    description:
      "Instant multi-lingual customer answering with sub-second latency, zero dropped calls, and direct carrier phone support.",
    url: "https://vaniedge.vercel.app",
    siteName: "VaniEdge Voice Platform",
    images: [
      {
        url: "/vaniedge-logo.png",
        width: 1024,
        height: 1024,
        alt: "VaniEdge Voice Platform Logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VaniEdge AI — Edge-Native Voice AI Telephony",
    description: "Multi-lingual 24/7 phone answering agent for local businesses.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth bg-[#07070a] text-white dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=Montserrat:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#07070a] text-white selection:bg-emerald-500/30 selection:text-white antialiased">
        {children}
      </body>
    </html>
  );
}
