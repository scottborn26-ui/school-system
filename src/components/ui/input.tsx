import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-border bg-white px-3 py-1 text-base text-[color:var(--text-primary)] shadow-[0_1px_2px_rgba(15,23,42,0.02)] transition-[border-color,box-shadow,background-color] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[color:var(--text-secondary)] hover:border-[color:var(--primary)]/30 focus-visible:border-[color:var(--primary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--primary)]/10 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
