"use client";

import dynamic from "next/dynamic";

// Dynamically import the RoomTour component with SSR disabled
const RoomTour = dynamic(() => import("@/components/RoomTour"), {
  ssr: false,
  loading: () => (
    <div style={{
      width: "100vw",
      height: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#050409",
      color: "#ffffff",
      fontFamily: "sans-serif",
      fontSize: "1.2rem",
      letterSpacing: "2px"
    }}>
      INITIALIZING STUDIO...
    </div>
  )
});

export default function Home() {
  return (
    <main>
      <RoomTour />
    </main>
  );
}
