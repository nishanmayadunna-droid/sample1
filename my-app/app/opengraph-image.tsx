import { ImageResponse } from "next/og";

export const alt = "Northbound — Hard-wearing field apparel";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#111111",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 140, fontWeight: 700, letterSpacing: 6, display: "flex" }}>
          NORTH·BOUND
        </div>
        <div style={{ marginTop: 32, fontSize: 40, color: "#cccccc", display: "flex" }}>
          Hard-wearing field apparel for the cold miles.
        </div>
      </div>
    ),
    { ...size },
  );
}
