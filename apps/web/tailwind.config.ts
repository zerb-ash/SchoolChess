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
        wood: {
          950: '#0f0d0b',
          900: '#171310',
          850: '#1e1915',
          800: '#26201b',
          700: '#383029',
          600: '#4d4239',
        },
        brass: {
          100: '#fbf7ee',
          200: '#f4ebd2',
          300: '#e5d4a6',
          400: '#d5bb7a',
          500: '#c5a858',
          600: '#a6893c',
          700: '#82692c',
        },
        parchment: {
          50: '#faf8f5',
          100: '#f4efe6',
          200: '#e7ded0',
          300: '#d7c8b4',
          400: '#c2af96',
          500: '#a69279',
        },
        salon: {
          crimson: '#8b261e',
          forest: '#2d4a3e',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
