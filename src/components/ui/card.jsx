import { cn } from "@/lib/utils";

const base =
  "rounded-xl bg-white/5 border border-white/10";

const variants = {
  default: "",
  interactive: "hover:bg-white/[0.07] transition-colors",
};

export function Card({
  as: Component = "div",
  variant = "default",
  className,
  children,
  ...props
}) {
  return (
    <Component className={cn(base, variants[variant], className)} {...props}>
      {children}
    </Component>
  );
}
