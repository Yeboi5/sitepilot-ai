import type { Config } from "tailwindcss";

// Design tokens (Update Pack 1.1): soft blue and green accents on warm neutrals, rounded
// surfaces and large readable type. Text colours stay slate for contrast.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          200: "#bcd8fb",
          500: "#2f6fed",
          600: "#2158d1",
          700: "#1b46a8",
          900: "#132e66",
        },
        leaf: {
          50: "#edfaf3",
          100: "#d3f3e2",
          200: "#a8e5c6",
          500: "#1f9d64",
          600: "#17824f",
          700: "#11653d",
        },
        sand: {
          50: "#fbf9f5",
          100: "#f5f1e9",
          200: "#ebe4d6",
          300: "#dcd2bf",
          600: "#6d6355",
          900: "#2d2820",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-rounded", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
