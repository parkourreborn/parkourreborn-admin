import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--admin-bg)',
        panel: 'var(--admin-panel)',
        line: 'var(--admin-line)',
        accent: 'var(--admin-blue)',
        muted: 'var(--admin-muted)',
      },
      fontFamily: {
        sans: ['Exo 2', 'Arial', 'sans-serif'],
        display: ['Jura', 'Arial', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      boxShadow: {
        panel: '0 22px 70px rgba(0, 0, 0, 0.28)',
      },
    },
  },
  plugins: [],
};

export default config;
