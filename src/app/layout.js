import "./globals.css";

export const metadata = {
  title: "Creative Studio | 3D Room Tour",
  description: "An interactive 3D scrollytelling room tour built with Next.js, Three.js, and GSAP.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
