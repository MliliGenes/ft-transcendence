import * as React from "react";
import { cn } from "cn";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn("min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:shadow-glow-focus disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", className)} {...props} />;
}

export { Textarea };
