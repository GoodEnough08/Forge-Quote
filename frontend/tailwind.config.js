/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F7F8FA",
        primary: "#172B4D",
        accent: "#2563EB",
        success: "#16845B",
        border: "#E5E7EB",
        ink: "#1F2937",
        muted: "#64748B",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};