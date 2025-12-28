/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1DB954",
          dark: "#14833B",
          light: "#4EE88C",
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

