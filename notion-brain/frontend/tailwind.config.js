/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        manga: ['Bangers', 'cursive'],
        mono:  ['Share Tech Mono', 'monospace'],
        serif: ['EB Garamond', 'Georgia', 'serif'],
      },
      colors: {
        ink:   '#0d0d0d',
        paper: '#f2ede0',
        space: '#01000a',
        nebula:'#6366f1',
      },
    },
  },
  plugins: [],
};