import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  inverted?: boolean;
  className?: string;
}

const sizes = {
  sm: { up: "text-base", labs: "text-[10px] tracking-[4px]" },
  md: { up: "text-xl",   labs: "text-xs tracking-[5px]" },
  lg: { up: "text-3xl",  labs: "text-sm tracking-[6px]" },
};

export function Logo({ size = "md", inverted = false, className }: LogoProps) {
  const s = sizes[size];
  return (
    <span className={cn("inline-flex items-baseline font-head font-extrabold tracking-tighter leading-none", inverted ? "text-white" : "text-ink", className)}>
      <span className={s.up}>UP</span>
      <span className={cn("font-normal opacity-70 ml-1", s.labs, inverted ? "text-rose-light" : "text-rose")}>LABS</span>
    </span>
  );
}
