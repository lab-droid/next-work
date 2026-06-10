/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#e5f0ff',
          100: '#cce1ff',
          200: '#99c2ff',
          300: '#66a3ff',
          400: '#3385ff',
          500: '#0052CC', // Primary
          600: '#0047b3',
          700: '#003d99',
          800: '#003380',
          900: '#002966',
        },
        navy: {
          900: '#1A2B45', // Sidebar
          800: '#2A3C58',
          700: '#344563', // Text
        },
        surface: {
          light: '#F8F9FA', // Background
          white: '#FFFFFF',
        }
      },
      fontFamily: {
        sans: ['Pretendard', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
      }
    },
  },
  plugins: [],
}
