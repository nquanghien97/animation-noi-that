import "./globals.css";
import { Be_Vietnam_Pro } from "next/font/google";

export const metadata = {
  title: "Creative Studio | 3D Room Tour",
  description: "An interactive 3D scrollytelling room tour built with Next.js, Three.js, and GSAP.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const beVietNam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["100", "300", "400", "500", "700", "900"],
  variable: "--font-body",
  display: "swap",
});

export default function RootLayout({ children }) {
  return (
    <html className={beVietNam.variable} lang="vi" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
