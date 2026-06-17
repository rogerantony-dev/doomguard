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
        // "Hazard Console" identity — a doomscroll monitor styled like safety gear.
        ink: "#08080A",
        ink2: "#0C0C10",
        panel: "#141419",
        panelhi: "#1B1B22",
        bone: "#F4F1EA",
        ash: "#9C9CA6",
        dim: "#5C5C66",
        // Primary "pop" accent — electric cyan on near-black (was ember red).
        // Token names kept as ember* so usages don't churn.
        ember: "#19E3FF",
        emberdeep: "#0BB6D6",
        amber: "#F5A524",
        toxic: "#3DDC84",
        toxicdeep: "#0F3A24",
      },
    },
  },
  plugins: [],
};
