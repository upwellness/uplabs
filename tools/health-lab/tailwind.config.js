module.exports = {
  content: ["./src/**/*.{jsx,js}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        surface2: "var(--surface2)",
        ink: "var(--ink)",
        ink2: "var(--ink2)",
        mut: "var(--mut)",
        line: "var(--line)",
        accent: "var(--accent)",
        "accent-strong": "var(--accent-strong)",
        "accent-soft": "var(--accent-soft)",
        "on-accent": "var(--on-accent)",
      },
      fontFamily: {
        display: ["Prompt", "Anuphan", "system-ui", "sans-serif"],
        body: ["Anuphan", "Prompt", "system-ui", "sans-serif"],
      },
      boxShadow: { card: "var(--shadow)" },
      borderRadius: { card: "20px" },
      maxWidth: { hub: "820px" },
    },
  },
};
