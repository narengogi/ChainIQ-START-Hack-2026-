import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:     ["Inter", "system-ui", "sans-serif"],
        heading:  ["Montserrat", "Inter", "system-ui", "sans-serif"],
        mono:     ["JetBrains Mono", "monospace"],
      },
      colors: {
        /** ChainIQ brand red palette */
        ciq: {
          50:  "#fff1f1",
          100: "#ffe0e0",
          200: "#ffc6c6",
          300: "#ff9d9d",
          400: "#ff5a5f",
          500: "#f51d28",
          600: "#e30613", // ← ChainIQ primary
          700: "#b30010",
          800: "#8f0012",
          900: "#700015",
          950: "#40000a",
        },
        /** Neutral dark surfaces */
        surface: {
          DEFAULT: "#161616",
          2:       "#222222",
          3:       "#2e2e2e",
        },
      },
      animation: {
        "pulse-slow":  "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-in":    "slideIn 0.4s ease-out",
        "glow-pulse":  "glowPulse 2s ease-in-out infinite",
      },
      keyframes: {
        slideIn: {
          "0%":   { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)",     opacity: "1" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(227, 6, 19, 0)" },
          "50%":      { boxShadow: "0 0 16px 4px rgba(227, 6, 19, 0.35)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
