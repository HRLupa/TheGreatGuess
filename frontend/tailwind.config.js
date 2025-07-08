/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./main.js","./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        mytheme: {
          "primary": "#4f46e5",
          "secondary": "#f43f5e",
          "accent": "#22d3ee",
          "neutral": "#1f2937",
          "base-100": "#ffffff",
          "info": "#3abff8",
          "success": "#22c55e",
          "warning": "#facc15",
          "error": "#ef4444",
        },
      },
      {
        guesser: {
          // 🎯 Paste your theme's CSS custom properties below as key-value pairs:
          "color-scheme": "dark",
          "--color-base-100": "oklch(14% 0 0)",
          "--color-base-200": "oklch(20% 0 0)",
          "--color-base-300": "oklch(26% 0 0)",
          "--color-base-content": "oklch(97% 0 0)",
          "--color-primary": "oklch(49% 0.27 292.581)",
          "--color-primary-content": "oklch(96% 0.018 272.314)",
          "--color-secondary": "oklch(54% 0.245 262.881)",
          "--color-secondary-content": "oklch(96% 0.018 272.314)",
          "--color-accent": "oklch(25% 0.042 265.755)",
          "--color-accent-content": "oklch(98% 0.003 247.858)",
          "--color-neutral": "oklch(14% 0 0)",
          "--color-neutral-content": "oklch(98% 0 0)",
          "--color-info": "oklch(60% 0.126 221.723)",
          "--color-info-content": "oklch(98% 0.019 200.873)",
          "--color-success": "oklch(72% 0.219 149.579)",
          "--color-success-content": "oklch(97% 0.014 308.299)",
          "--color-warning": "oklch(90% 0.182 98.111)",
          "--color-warning-content": "oklch(26% 0.007 34.298)",
          "--color-error": "oklch(55% 0.195 38.402)",
          "--color-error-content": "oklch(97% 0.014 343.198)",
          "--radius-selector": "0.5rem",
          "--radius-field": "0.5rem",
          "--radius-box": "1rem",
          "--size-selector": "0.25rem",
          "--size-field": "0.25rem",
          "--border": "1px",
          "--depth": "0",
          "--noise": "0",
        },
      }
    ],
  },
};