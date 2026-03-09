import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        panel: "#0f172a",
        border: "#1e293b",
        muted: "#94a3b8",
        accent: "#22d3ee"
      }
    }
  },
  plugins: []
};

export default config;
