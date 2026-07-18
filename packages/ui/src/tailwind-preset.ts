import { fontFamily } from "tailwindcss/defaultTheme";
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

type TailwindPreset = Omit<Config, "content">;

const cssColor = (variable: string) =>
  `color-mix(in srgb, var(${variable}) calc(<alpha-value> * 100%), transparent)`;

const uiTailwindPreset = {
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: cssColor("--border"),
        input: cssColor("--input"),
        ring: cssColor("--ring"),
        background: cssColor("--background"),
        foreground: cssColor("--foreground"),
        primary: {
          DEFAULT: cssColor("--primary"),
          foreground: cssColor("--primary-foreground"),
        },
        secondary: {
          DEFAULT: cssColor("--secondary"),
          foreground: cssColor("--secondary-foreground"),
        },
        destructive: {
          DEFAULT: cssColor("--destructive"),
          foreground: cssColor("--destructive-foreground"),
        },
        success: {
          DEFAULT: cssColor("--success"),
          foreground: cssColor("--success-foreground"),
        },
        warning: {
          DEFAULT: cssColor("--warning"),
          foreground: cssColor("--warning-foreground"),
        },
        muted: {
          DEFAULT: cssColor("--muted"),
          foreground: cssColor("--muted-foreground"),
        },
        accent: {
          DEFAULT: cssColor("--accent"),
          foreground: cssColor("--accent-foreground"),
        },
        popover: {
          DEFAULT: cssColor("--popover"),
          foreground: cssColor("--popover-foreground"),
        },
        card: {
          DEFAULT: cssColor("--card"),
          foreground: cssColor("--card-foreground"),
        },
        sidebar: {
          DEFAULT: cssColor("--sidebar"),
          foreground: cssColor("--sidebar-foreground"),
          primary: cssColor("--sidebar-primary"),
          active: cssColor("--sidebar-accent"),
          "active-foreground": cssColor("--sidebar-accent-foreground"),
          "primary-foreground": cssColor("--sidebar-primary-foreground"),
          accent: cssColor("--sidebar-accent"),
          "accent-foreground": cssColor("--sidebar-accent-foreground"),
          border: cssColor("--sidebar-border"),
          ring: cssColor("--sidebar-ring"),
        },
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ['"DM Sans Variable"', ...fontFamily.sans],
        mono: ['"Source Code Pro"', '"Fira Mono"', ...fontFamily.mono],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--bits-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--bits-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies TailwindPreset;

export default uiTailwindPreset;
