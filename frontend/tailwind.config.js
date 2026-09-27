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
          ink: "#05070B",
          navy: "#08111F",
          soft: "#0D1A2A",
          gold: "#D9A441",
          bright: "#F2C866",
          muted: "#A7AFBA",
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
        xl: "14px",
      },
    },
  },
  plugins: [],
};
