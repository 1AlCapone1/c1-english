/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#16213A", soft: "#5A6377" },
        paper: "#F4F5F0",
        accent: { DEFAULT: "#2944C4", soft: "#E3E8FB", dark: "#8199FF" },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', "system-ui", "sans-serif"],
        sans: ['"Atkinson Hyperlegible"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      keyframes: { pop: { "0%": { transform: "scale(.98)", opacity: ".6" }, "100%": { transform: "none", opacity: "1" } } },
      animation: { pop: "pop .18s ease-out" },
    },
  },
  plugins: [],
};
