/** @type {import('tailwindcss').Config} */
module.exports = {
  blocklist: ['overline'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#D7141A', dark: '#B91015', light: '#FEF2F2' },
        ink: { DEFAULT: '#0F172A', soft: '#1E293B', muted: '#64748B' },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: { card: '0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(15,23,42,.12)' },
    },
  },
  plugins: [],
};
