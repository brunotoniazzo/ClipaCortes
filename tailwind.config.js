/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f3ff',
          100: '#ede9fe',
          400: 'var(--t-primary-hover)',
          500: 'var(--t-primary-hover)',
          600: 'var(--t-primary)',
          700: 'var(--t-primary)',
          900: '#4c1d95',
        },
        studio: {
          950: 'var(--t-bg-950)',
          900: 'var(--t-bg-900)',
          850: '#131622',
          800: 'var(--t-bg-800)',
          700: '#262c42',
        }
      }
    },
  },
  plugins: [],
}
