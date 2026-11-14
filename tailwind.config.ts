import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--hub-bg)',
        panel: 'var(--hub-panel-bg)',
        line: 'var(--hud-hairline)',
        accent: 'var(--hub-blue)',
        muted: 'var(--hub-muted)',
        dim: 'var(--hud-dim)',
      },
      fontFamily: {
        sans: ['var(--font-exo2)', 'Arial', 'sans-serif'],
        display: ['var(--font-jura)', 'Arial', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'monospace'],
        num: ['var(--font-rajdhani)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
