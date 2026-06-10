/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        risk: {
          "read-only": "#16a34a",
          "internal-write": "#15803d",
          "external-api": "#ca8a04",
          financial: "#ea580c",
          destructive: "#dc2626",
          administrative: "#b91c1c",
        },
      },
    },
  },
  plugins: [],
};