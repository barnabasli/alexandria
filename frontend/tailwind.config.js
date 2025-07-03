/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'bg-rich-black',
    'bg-oxford-blue',
    'bg-yinmn-blue',
    'border-silver-lake-blue',
    'text-platinum',
    'text-silver-lake-blue',
    'text-yinmn-blue',
    'bg-apple-blue',
    'bg-apple-blue-hover',
    'bg-apple-danger',
    'bg-apple-danger-hover',
    'border-apple-blue',
    'border-silver-lake-blue',
    'border-red-500/30',
    'border-green-500/30',
    'border-yellow-500/30',
    'bg-red-900/20',
    'bg-green-900/20',
    'bg-yellow-900/20',
    'text-red-300',
    'text-green-300',
    'text-yellow-300'
  ],
  theme: {
    extend: {
      colors: {
        'rich-black': '#0d1b2a',
        'oxford-blue': '#1b263b',
        'yinmn-blue': '#415a77',
        'silver-lake-blue': '#778da9',
        'platinum': '#e0e1dd',
        'apple-blue': '#007AFF',
        'apple-blue-hover': '#0056CC',
        'apple-danger': '#FF3B30',
        'apple-danger-hover': '#D70015',
      },
      backgroundColor: {
        'rich-black': '#0d1b2a',
        'oxford-blue': '#1b263b',
        'yinmn-blue': '#415a77',
      },
      textColor: {
        'platinum': '#e0e1dd',
        'silver-lake-blue': '#778da9',
        'yinmn-blue': '#415a77',
      },
      borderColor: {
        'silver-lake-blue': 'rgba(119, 141, 169, 0.2)',
        'silver-lake-blue-secondary': 'rgba(119, 141, 169, 0.15)',
      }
    },
  },
  plugins: [],
}
