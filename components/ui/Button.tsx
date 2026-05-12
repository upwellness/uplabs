import { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "rose" | "wellness" | "science" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary:  "bg-ink text-white hover:bg-ink-80",
  rose:     "bg-rose text-white hover:bg-rose-mid",
  wellness: "bg-wellness text-white hover:bg-wellness-mid",
  science:  "bg-science text-white hover:bg-science-mid",
  outline:  "bg-transparent text-ink border border-ink-20 hover:border-ink",
  ghost:    "bg-surface text-ink-60 hover:bg-ink-5 hover:text-ink",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-xs px-4 py-2",
  md: "text-sm px-6 py-3",
  lg: "text-[15px] px-8 py-4",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-wide transition-all duration-150 hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    />
  ),
);
Button.displayName = "Button";
