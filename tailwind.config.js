/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx,html}',
  ],
  theme: {
    extend: {
      colors: {
        // Dark scale
        black: '#0A0A0A',
        void: '#0F0F0F',
        night: '#1B1B1B',
        charcoal: '#242424',
        graphite: '#2E2E2E',
        slate: '#3A3A3A',
        steel: '#4A4A4A',
        zinc: '#6A6A6A',
        silver: '#9A9A9A',
        cloud: '#CCCCCC',
        snow: '#EEEEEE',
        white: '#FFFFFF',

        // Accent — Crimson Red
        red: {
          dark: '#8B0620',
          deep: '#B8082A',
          DEFAULT: '#FD0A34',
          bright: '#FF3D5C',
          light: '#FF6B82',
          pale: '#FF9EAB',
          wash: 'rgba(253, 10, 52, 0.12)',
          subtle: 'rgba(253, 10, 52, 0.06)',
        },

        // Semantic States
        success: '#22C55E',
        warning: '#EAB308',
        error: '#EF4444',
        info: '#3B82F6',

        // Semantic backgrounds
        base: '#1B1B1B',
        raised: '#242424',
        elevated: '#2E2E2E',
        floating: '#3A3A3A',

        // Semantic borders
        subtle: 'rgba(255, 255, 255, 0.08)',
        default: 'rgba(255, 255, 255, 0.12)',
        strong: 'rgba(255, 255, 255, 0.18)',

        // Interactive
        interactive: {
          DEFAULT: '#FD0A34',
          hover: '#FF3D5C',
          muted: 'rgba(253, 10, 52, 0.12)',
        },

        // Legacy
        ghost: '#4A4A4A',
      },

      fontFamily: {
        display: ['Instrument Serif', 'Georgia', 'serif'],
        body: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },

      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1.25' }],
        'xs': ['0.6875rem', { lineHeight: '1.4' }],
        'sm': ['0.75rem', { lineHeight: '1.5' }],
        'base': ['0.8125rem', { lineHeight: '1.5' }],
        'md': ['0.875rem', { lineHeight: '1.5' }],
        'lg': ['1rem', { lineHeight: '1.5' }],
        'xl': ['1.25rem', { lineHeight: '1.3' }],
        '2xl': ['1.5rem', { lineHeight: '1.2' }],
        '3xl': ['2rem', { lineHeight: '1.2' }],
      },

      borderRadius: {
        'sm': '4px',
        'DEFAULT': '6px',
        'md': '6px',
        'lg': '8px',
        'xl': '12px',
        '2xl': '16px',
        'full': '9999px',
      },

      spacing: {
        'px': '1px',
        '0': '0',
        '0.5': '0.125rem',
        '1': '0.25rem',
        '1.5': '0.375rem',
        '2': '0.5rem',
        '2.5': '0.625rem',
        '3': '0.75rem',
        '4': '1rem',
        '5': '1.25rem',
        '6': '1.5rem',
        '8': '2rem',
        '10': '2.5rem',
        '12': '3rem',
        '16': '4rem',
      },

      transitionTimingFunction: {
        'ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'ease-in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      transitionDuration: {
        'instant': '50ms',
        'fast': '100ms',
        'normal': '150ms',
        'slow': '250ms',
        'slower': '400ms',
      },

      boxShadow: {
        'xs': '0 1px 2px rgba(0, 0, 0, 0.5)',
        'sm': '0 2px 4px rgba(0, 0, 0, 0.5)',
        'md': '0 4px 8px rgba(0, 0, 0, 0.5)',
        'lg': '0 8px 16px rgba(0, 0, 0, 0.5)',
        'xl': '0 16px 32px rgba(0, 0, 0, 0.5)',
        'inset': 'inset 0 1px 2px rgba(0, 0, 0, 0.4)',
      },

      animation: {
        'fadeInUp': 'fadeInUp 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scaleIn': 'scaleIn 150ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse': 'pulse 1.4s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
      },

      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulse: {
          '0%, 100%': { opacity: '0.3', transform: 'scale(0.85)' },
          '50%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
