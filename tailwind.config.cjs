/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        merkaba: {
          bg: 'rgb(var(--merkaba-bg-rgb) / <alpha-value>)',
          sidebar: 'rgb(var(--merkaba-sidebar-rgb) / <alpha-value>)',
          elevated: 'rgb(var(--merkaba-elevated-rgb) / <alpha-value>)',
          surface: 'rgb(var(--merkaba-surface-rgb) / <alpha-value>)',
          hover: 'rgb(var(--merkaba-hover-rgb) / <alpha-value>)',
          accent: 'rgb(var(--merkaba-accent-rgb) / <alpha-value>)',
          'accent-hover': 'rgb(var(--merkaba-accent-hover-rgb) / <alpha-value>)',
          'accent-soft': 'var(--merkaba-accent-soft)',
          text: 'rgb(var(--merkaba-text-rgb) / <alpha-value>)',
          muted: 'rgb(var(--merkaba-muted-rgb) / <alpha-value>)',
          border: 'var(--merkaba-border)',
          'border-strong': 'var(--merkaba-border-strong)',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: 'var(--merkaba-shadow-panel)',
        glow: 'var(--merkaba-shadow-glow)',
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
