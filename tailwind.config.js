/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Geist', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        surface: {
          DEFAULT: '#0f0f0f',
          100: '#212121',
          200: '#282828',
          300: '#3F3F3F',
        },
        fg: {
          DEFAULT: '#aaa',
          secondary: '#808080',
          muted: '#666',
          contrast: '#fff',
        },
        border: {
          DEFAULT: 'rgb(153 153 153 / 0.15)',
          hover: 'rgb(153 153 153 / 0.3)',
        },
      },
      borderRadius: {
        aspect: '14px',
        'aspect-sm': '8px',
        'aspect-pill': '9999px',
      },
    },
  },
  plugins: [],
};
