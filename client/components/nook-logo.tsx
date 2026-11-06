import { cn } from "@/lib/utils";

export function NookLogo({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Nook"
      className={cn(
        "inline-block text-[28px] leading-none font-semibold tracking-[-2px] text-foreground",
        className,
      )}
    >
      n<span className="text-primary">.</span>
    </span>
  );
}
