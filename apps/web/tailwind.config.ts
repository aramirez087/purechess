import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        brass: {
          DEFAULT: 'hsl(var(--brass))',
          soft: 'hsl(var(--brass-soft))',
          // Darker in light theme so brass stays legible as small text.
          text: 'hsl(var(--brass-text))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        stage: 'hsl(var(--stage))',
        surface: 'hsl(var(--surface))',
        raised: 'hsl(var(--raised))',
        board: {
          light: 'hsl(var(--board-sq-light))',
          dark: 'hsl(var(--board-sq-dark))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      lineHeight: {
        tight: '1.15',
      },
      spacing: {
        'top-bar': '3.5rem',
      },
      boxShadow: {
        'inner-hairline': 'inset 0 1px 0 0 hsl(var(--border) / 0.6)',
        elevated: 'var(--shadow-elevated)',
        'brass-glow':
          '0 0 0 1px hsl(var(--brass) / 0.4), 0 8px 24px hsl(var(--brass) / 0.18)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        brassPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 hsl(var(--brass) / 0.35)' },
          '50%': { boxShadow: '0 0 0 6px hsl(var(--brass) / 0)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out both',
        'brass-pulse': 'brassPulse 2.4s ease-out infinite',
      },
    },
  },
  plugins: [typography],
};

export default config;
