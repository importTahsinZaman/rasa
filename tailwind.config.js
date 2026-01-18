/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx,html}',
  ],
  theme: {
    extend: {
      colors: {
        // Base tones
        void: '#08080a',
        night: '#0f0f12',
        slate: '#18181c',
        stone: '#232328',
        ash: '#2e2e35',
        dust: '#3d3d47',
        mist: '#5c5c6a',
        cloud: '#8b8b9a',
        pearl: '#c4c4ce',
        snow: '#f0f0f4',

        // Primary — Living Olive
        olive: {
          deep: '#2a3320',
          dark: '#3d4a2e',
          DEFAULT: '#5a6f42',
          bright: '#7a9458',
          light: '#9fb87a',
          pale: '#c8daa8',
          wash: '#e8f0d8',
        },

        // Accent — Warm Amber
        amber: {
          deep: '#8b5a00',
          DEFAULT: '#c9850f',
          light: '#e8b84a',
          pale: '#ffedc4',
        },

        // Semantic States
        success: '#4ade80',
        warning: '#fbbf24',
        error: '#f87171',
        info: '#60a5fa',

        // Semantic backgrounds
        base: '#0f0f12',
        raised: '#18181c',
        elevated: '#232328',
        floating: '#2e2e35',

        // Semantic borders
        subtle: 'rgba(255, 255, 255, 0.06)',
        default: 'rgba(255, 255, 255, 0.09)',
        strong: 'rgba(255, 255, 255, 0.14)',

        // Interactive
        interactive: {
          DEFAULT: '#7a9458',
          hover: '#9fb87a',
          muted: 'rgba(122, 148, 88, 0.12)',
          wash: 'rgba(122, 148, 88, 0.06)',
        },
      },

      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        body: ['Outfit', 'system-ui', 'sans-serif'],
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
        'lg': '10px',
        'xl': '14px',
        '2xl': '18px',
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
        'bounce': 'cubic-bezier(0.68, -0.6, 0.32, 1.6)',
      },

      transitionDuration: {
        'instant': '50ms',
        'fast': '120ms',
        'normal': '200ms',
        'slow': '350ms',
        'slower': '500ms',
      },

      boxShadow: {
        'xs': '0 1px 2px rgba(0, 0, 0, 0.4)',
        'sm': '0 2px 4px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3)',
        'md': '0 4px 12px rgba(0, 0, 0, 0.45), 0 2px 4px rgba(0, 0, 0, 0.3)',
        'lg': '0 8px 24px rgba(0, 0, 0, 0.5), 0 4px 8px rgba(0, 0, 0, 0.35)',
        'xl': '0 16px 48px rgba(0, 0, 0, 0.55), 0 8px 16px rgba(0, 0, 0, 0.4)',
        'glow-sm': '0 0 12px rgba(122, 148, 88, 0.4), 0 0 4px rgba(122, 148, 88, 0.4)',
        'glow-md': '0 0 20px rgba(122, 148, 88, 0.4), 0 0 8px rgba(122, 148, 88, 0.4)',
        'glow-lg': '0 0 32px rgba(122, 148, 88, 0.4), 0 0 12px rgba(122, 148, 88, 0.4)',
        'inset': 'inset 0 1px 2px rgba(0, 0, 0, 0.3)',
      },

      animation: {
        'fadeInUp': 'fadeInUp 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scaleIn': 'scaleIn 200ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'breathe': 'breathe 1.6s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
        'float': 'logoFloat 4s ease-in-out infinite',
      },

      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(0.85)', opacity: '0.4' },
          '50%': { transform: 'scale(1.15)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        logoFloat: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
