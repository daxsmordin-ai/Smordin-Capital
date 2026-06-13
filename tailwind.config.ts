import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Inter", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        ink: {
          DEFAULT: "#0b1220",
          soft: "#1a2236",
          muted: "#5a6478",
        },
        accent: {
          DEFAULT: "#0f766e",
          dark: "#0b5b54",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.05), 0 4px 12px rgba(15, 23, 42, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
