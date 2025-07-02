/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'bg-github-bg',
    'bg-github-bg-secondary',
    'bg-github-bg-tertiary',
    'border-github-border',
    'text-github-text',
    'text-github-text-secondary',
    'text-github-text-muted',
    'bg-github-accent',
    'bg-github-accent-hover',
    'bg-github-danger',
    'bg-github-danger-hover',
    'bg-github-primary',
    'bg-github-primary-hover',
    'border-github-primary',
    'border-github-text-secondary',
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
        'github-bg': '#0d1117',
        'github-bg-secondary': '#161b22',
        'github-bg-tertiary': '#21262d',
        'github-border': '#30363d',
        'github-border-secondary': '#21262d',
        'github-text': '#f0f6fc',
        'github-text-secondary': '#8b949e',
        'github-text-muted': '#7d8590',
        'github-accent': '#238636',
        'github-accent-hover': '#2ea043',
        'github-danger': '#f85149',
        'github-danger-hover': '#da3633',
        'github-primary': '#58a6ff',
        'github-primary-hover': '#79c0ff',
      }
    },
  },
  plugins: [],
}
