/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.tsx",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // "Quiet" identity — minimal, dark-first. Near-black canvas, warm
        // off-white text, a single green accent used only where it MEANS
        // something (service on, blocked/safe, enabled, improving).
        ink: "#0D0D0C", // app canvas
        ink2: "#141413", // deeper recess
        panel: "#1A1A18", // subtle grouped fill (no border/shadow needed)
        panelhi: "#2C2C29", // raised / active segment
        bone: "#F2F1EC", // primary text (warm off-white)
        ash: "#9A9A92", // secondary text
        dim: "#62625B", // tertiary text / labels
        // Token names kept (ember*/toxic*) so usages don't churn; both point at
        // the one green accent now. amber retained for the warn glyph.
        ember: "#38C786",
        emberdeep: "#2E9466",
        amber: "#F5A524",
        toxic: "#38C786",
        toxicdeep: "#0E3D29",
      },
    },
  },
  plugins: [],
};
