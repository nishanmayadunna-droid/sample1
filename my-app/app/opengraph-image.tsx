import { ImageResponse } from "next/og";
import { brandAssetUrl, logoText, resolveTheme } from "@/lib/brand";
import { getBrand } from "@/lib/brand-data";

export const alt = "Link preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The share card follows the shop's brand: the uploaded share image, or the logo text on the theme colours.
export default async function Image() {
  const brand = await getBrand();
  if (brand.shareImagePath) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brandAssetUrl(brand.shareImagePath)} alt="" width={1200} height={630} style={{ objectFit: "cover" }} />
        </div>
      ),
      { ...size },
    );
  }
  const theme = resolveTheme(brand).light;
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
          background: theme.panel,
          color: theme.panelInk,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 140, fontWeight: 700, letterSpacing: 6, display: "flex", textTransform: "uppercase" }}>
          {logoText(brand)}
        </div>
        {brand.taglineEn && (
          <div style={{ marginTop: 32, fontSize: 40, color: theme.panelMuted, display: "flex" }}>{brand.taglineEn}</div>
        )}
      </div>
    ),
    { ...size },
  );
}
