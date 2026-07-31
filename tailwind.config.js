/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0b0e0c',
        panel: '#10140f',
        border: '#1e2a1c',
        foreground: '#d8e4d0',
        muted: '#6b7a63',
        accent: '#7fd858',
        warning: '#ffb347',
        danger: '#ff6b5e',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'SF Mono', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
};
