import { Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/use-theme";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const iconTheme = theme === "dark" ? Moon : theme === "system" ? Monitor : Sun;
  const Icon = iconTheme;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Theme preference"
      title="Theme preference"
      onClick={toggleTheme}
      className={cn(
        "relative h-9 w-9 rounded-full border-border/80 bg-background/80 text-foreground shadow-sm transition-all duration-300 hover:bg-accent/80",
        className,
      )}
    >
      <Icon className="size-4" />
    </Button>
  );
}
