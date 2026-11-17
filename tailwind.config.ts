import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // No `<alpha-value>` is declared: opacity modifiers such as /50 are
        // unusable on these colours.
        category: {
          manger: {
            bg: "hsl(var(--cat-manger-bg))",
            border: "hsl(var(--cat-manger-border))",
            fg: "hsl(var(--cat-manger-fg))",
          },
          travail: {
            bg: "hsl(var(--cat-travail-bg))",
            border: "hsl(var(--cat-travail-border))",
            fg: "hsl(var(--cat-travail-fg))",
          },
          domestique: {
            bg: "hsl(var(--cat-domestique-bg))",
            border: "hsl(var(--cat-domestique-border))",
            fg: "hsl(var(--cat-domestique-fg))",
          },
          loisir: {
            bg: "hsl(var(--cat-loisir-bg))",
            border: "hsl(var(--cat-loisir-border))",
            fg: "hsl(var(--cat-loisir-fg))",
          },
          repos: {
            bg: "hsl(var(--cat-repos-bg))",
            border: "hsl(var(--cat-repos-border))",
            fg: "hsl(var(--cat-repos-fg))",
          },
          famille: {
            bg: "hsl(var(--cat-famille-bg))",
            border: "hsl(var(--cat-famille-border))",
            fg: "hsl(var(--cat-famille-fg))",
          },
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
