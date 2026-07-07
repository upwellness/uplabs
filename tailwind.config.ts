import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── UP Wellness Ops · Brand ── */
        rose: {
          ultra: "#FAF3F2",
          pale:  "#F0E0DE",
          light: "#C4857E",
          mid:   "#A86060",
          DEFAULT: "#8C4C4C",
          deep:  "#6B3535",
        },
        wellness: {
          ultra: "#F0F8F4",
          pale:  "#D6EDE4",
          light: "#6AAF91",
          mid:   "#4D8A70",
          DEFAULT: "#396755",
          deep:  "#244438",
        },
        science: {
          ultra: "#EDF7FA",
          pale:  "#D0EEF4",
          light: "#5BBDD4",
          mid:   "#3A9CB3",
          DEFAULT: "#2A7B8F",
          deep:  "#1A5466",
        },
        amber: {
          ultra: "#FEFAF3",
          pale:  "#FDF0DB",
          DEFAULT: "#C47A2A",
        },
        ink: {
          DEFAULT: "#18151A",
          80: "#3D3840",
          60: "#5C5660",
          40: "#8A838E",
          20: "#BAB5BD",
          10: "#DDD9DF",
          5:  "#F2F0F3",
        },
        surface: "#F7F5F3",
        "warm-white": "#FDFCFB",

        /* ── Medical Status · traffic-light 5-level ramp (see lib/medical-status.ts) ── */
        status: {
          optimal:  "#166534",   // เขียวเข้ม — ดีมาก
          good:     "#16A34A",   // เขียว — ปกติ
          caution:  "#C18A03",   // เหลือง — ควรระวัง
          warning:  "#EA580C",   // ส้ม — เสี่ยงสูง
          danger:   "#DC2626",   // แดง — อันตราย
        },
        "status-bg": {
          optimal: "#BBF7D0",
          good:    "#DCFCE7",
          caution: "#FEF9C3",
          warning: "#FFEDD5",
          danger:  "#FEE2E2",
        },
      },
      fontFamily: {
        head: ["var(--font-manrope)", "Helvetica Neue", "sans-serif"],
        body: ["var(--font-inter)", "Helvetica Neue", "sans-serif"],
        thai: ["var(--font-sarabun)", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      maxWidth: {
        content: "1120px",
      },
      letterSpacing: {
        tightest: "-0.05em",
      },
    },
  },
  plugins: [],
};

export default config;
