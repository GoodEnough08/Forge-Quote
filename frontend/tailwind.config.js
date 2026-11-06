/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F7F8FA",
        primary: "#172B4D",
        accent: "#00EA64", // HackerRank radiant green
        hk: {
          DEFAULT: "#00EA64",
          dark: "#00BD51",
          hover: "#05DE60",
          soft: "#E8FAF0",
          border: "#A1E8C2",
          darkbg: "#0E141E",
        },
        success: "#00BD51",
        border: "#E2E8F0",
        ink: "#1E293B",
        muted: "#64748B",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};
