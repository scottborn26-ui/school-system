import { Toaster as Sonner } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="top-center"
      icons={{
        success: <CheckCircle2 className="size-5 text-success" aria-hidden="true" />,
        error: <XCircle className="size-5 text-destructive" aria-hidden="true" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:w-[min(calc(100vw-2rem),28rem)] group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xl group-[.toaster]:rounded-xl group-[.toaster]:px-4 group-[.toaster]:py-3",
          success: "group-[.toast]:border-success/60 group-[.toast]:bg-success/10",
          error: "group-[.toast]:border-destructive/60 group-[.toast]:bg-destructive/10",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
