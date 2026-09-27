/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#D9A441",
          dark: "#B8812D",
          light: "#F2C866",
        },
        xtalenti: {
          ink: "#070A10",
          navy: "#0D1420",
          soft: "#121C2A",
          gold: "#D9A441",
          bright: "#F2C866",
          muted: "#A7AFBA",
          subtle: "#778393",
          border: "rgba(255,255,255,.10)",
        },
        black: "#0B0B0B",
        white: "#FFFFFF",
        gray: {
          100: "#F5F5F5",
          300: "#D1D1D1",
          600: "#6B6B6B",
        },
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "10px",
        xl: "18px",
      },
      boxShadow: {
        card: "0 8px 28px rgba(0,0,0,.22)",
        popover: "0 18px 55px rgba(0,0,0,.42)",
      },
      screens: {
        xs: "480px",
      },
    },
  },
  plugins: [],
};
