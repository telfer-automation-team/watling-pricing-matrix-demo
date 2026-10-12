import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import RegisterSW from "@/components/RegisterSW";
import "./globals.css";

const inter = { variable: "" };

// JCB brand typeface (Bamford) — self-hosted, loaded locally.
const bamford = localFont({
  variable: "--font-bamford",
  display: "swap",
  src: [
    { path: "./fonts/Bamford-Regular.otf", weight: "400", style: "normal" },
    { path: "./fonts/Bamford-Italic.otf", weight: "400", style: "italic" },
    { path: "./fonts/Bamford-Bold.otf", weight: "700", style: "normal" },
    { path: "./fonts/Bamford-Headline.otf", weight: "800", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "Watling Pricing Matrix",
  description: "Watling JCB service pricing — pick a machine, enter hours, get the price and parts.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/favicon-64.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Pricing Matrix" },
};

export const viewport: Viewport = {
  themeColor: "#131311",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${bamford.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
