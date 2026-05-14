/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    // Fixed: files live under frontend/, not src/
    "./frontend/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}