// Theme presets and font pairs for the shop's brand. Pure data. Every preset must pass the
// contrast gate in lib/brand.ts (a test checks it), in both light and dark.

export type PresetTokens = {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  panel: string;
  panelInk: string;
  panelMuted: string;
};

export type PresetTheme = { label: string; light: PresetTokens; dark: PresetTokens };

export const PRESETS: Record<string, PresetTheme> = {
  // Exactly the values that were hard-coded in app/globals.css before branding became a setting.
  northbound: {
    label: "Northbound",
    light: { bg: "#e7e7e0", surface: "#f1f1ea", text: "#17241e", muted: "#63675f", accent: "#cb4a1c", panel: "#15231d", panelInk: "#e9e9e2", panelMuted: "#9aa79d" },
    dark: { bg: "#0e1512", surface: "#17211c", text: "#e7e7df", muted: "#949a8f", accent: "#cb4a1c", panel: "#17211c", panelInk: "#e7e7df", panelMuted: "#949a8f" },
  },
  paper: {
    label: "Paper",
    light: { bg: "#f4efe6", surface: "#fbf8f2", text: "#2a2118", muted: "#6b5f52", accent: "#b3471f", panel: "#2a2118", panelInk: "#f4efe6", panelMuted: "#b9ad9d" },
    dark: { bg: "#1a1612", surface: "#251f19", text: "#efe8dc", muted: "#a79c8d", accent: "#d9622f", panel: "#251f19", panelInk: "#efe8dc", panelMuted: "#a79c8d" },
  },
  ocean: {
    label: "Ocean",
    light: { bg: "#e6eef3", surface: "#f2f7fa", text: "#0f2230", muted: "#4f6372", accent: "#0b6fa8", panel: "#0f2230", panelInk: "#e6eef3", panelMuted: "#9fb4c3" },
    dark: { bg: "#0b141b", surface: "#13202a", text: "#e4edf3", muted: "#93a8b7", accent: "#3aa0dc", panel: "#13202a", panelInk: "#e4edf3", panelMuted: "#93a8b7" },
  },
  forest: {
    label: "Forest",
    light: { bg: "#e8ede4", surface: "#f3f6ef", text: "#16251a", muted: "#55645a", accent: "#2f7d4f", panel: "#16251a", panelInk: "#e8ede4", panelMuted: "#9fb3a4" },
    dark: { bg: "#0d1610", surface: "#16221a", text: "#e3ece4", muted: "#95a79a", accent: "#4fb27a", panel: "#16221a", panelInk: "#e3ece4", panelMuted: "#95a79a" },
  },
  rose: {
    label: "Rose",
    light: { bg: "#f3e9ec", surface: "#faf3f5", text: "#2b1820", muted: "#6c5560", accent: "#b8325f", panel: "#2b1820", panelInk: "#f3e9ec", panelMuted: "#bda6b0" },
    dark: { bg: "#170e12", surface: "#22161b", text: "#f1e6ea", muted: "#ab97a0", accent: "#e0668f", panel: "#22161b", panelInk: "#f1e6ea", panelMuted: "#ab97a0" },
  },
  midnight: {
    label: "Midnight",
    light: { bg: "#ececf2", surface: "#f6f6fa", text: "#181826", muted: "#5b5b70", accent: "#6d4fd6", panel: "#181826", panelInk: "#ececf2", panelMuted: "#a5a5ba" },
    dark: { bg: "#0d0d16", surface: "#161622", text: "#e9e9f2", muted: "#9b9bb0", accent: "#9a85f0", panel: "#161622", panelInk: "#e9e9f2", panelMuted: "#9b9bb0" },
  },
};

export type FontPair = {
  label: string;
  /** Whether the display face is set in capitals (Anton is a poster face; the others are not). */
  displayCase: "uppercase" | "none";
  tracking: string;
};

// Geist Mono (labels) and Noto Sans Sinhala (Sinhala text) are used with every pair.
export const FONT_PAIRS: Record<string, FontPair> = {
  northbound: { label: "Northbound (Anton and Geist)", displayCase: "uppercase", tracking: "0.005em" },
  classic: { label: "Classic (Playfair Display and Inter)", displayCase: "none", tracking: "0" },
  friendly: { label: "Friendly (Poppins)", displayCase: "none", tracking: "0" },
  modern: { label: "Modern (Space Grotesk and Inter)", displayCase: "none", tracking: "-0.01em" },
  editorial: { label: "Editorial (DM Serif Display and DM Sans)", displayCase: "none", tracking: "0" },
};
