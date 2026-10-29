import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/modules/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        school: {
          text: '#17212f',
          'text-muted': '#526071',
          surface: '#ffffff',
          'surface-subtle': '#f5f7fa',
          border: '#d6dde6',
          primary: '#244a73',
          'primary-hover': '#1c3b5c',
          focus: '#1368ce',
          success: '#216e4e',
          warning: '#8a5a00',
          danger: '#a4262c',
        },
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
      },
      maxWidth: {
        content: '1440px',
      },
    },
  },
  plugins: [],
};

export default config;
