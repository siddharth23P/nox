/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
      colors: {
        nox: {
          bg: '#030303',
          card: '#0d0d0d',
          border: '#1a1a1a',
          accent: '#1d8cf8',
        }
      }
    },
  },
  plugins: [],
}
