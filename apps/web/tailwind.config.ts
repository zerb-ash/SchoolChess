import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        surface: {
          DEFAULT: '#18181b',
          subtle: '#27272a',
          elevated: '#3f3f46',
          border: '#3f3f46',
        }
      },
    },
  },
  plugins: [],
};

export default config;

