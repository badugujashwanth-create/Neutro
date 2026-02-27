/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#12131a',
        panel: '#1a1c26',
        border: '#2d3142',
      },
    },
  },
  plugins: [],
}
