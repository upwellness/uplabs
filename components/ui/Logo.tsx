import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  inverted?: boolean;
  className?: string;
}

const sizes = {
  sm: { up: "text-base", suffix: "text-[10px] tracking-[1.5px]" },
  md: { up: "text-xl",   suffix: "text-xs tracking-[2px]" },
  lg: { up: "text-3xl",  suffix: "text-sm tracking-[2.5px]" },
};

export function Logo({ size = "md", inverted = false, className }: LogoProps) {
  const s = sizes[size];
  return (
    <span className={cn("inline-flex items-baseline font-head font-extrabold tracking-tighter leading-none", inverted ? "text-white" : "text-ink", className)}>
      <span className={s.up}>UP</span>
      <span className={cn("font-normal opacity-70 ml-1.5", s.suffix, inverted ? "text-rose-light" : "text-rose")}>Wellness Ops</span>
    </span>
  );
}
