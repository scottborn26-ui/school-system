import { Camera, ImagePlus, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const MAX_BYTES = 2 * 1024 * 1024;

export function PhotoUploader({
  value,
  name,
  onChange,
  size = "md",
  className,
}: {
  value?: string | null;
  name: string;
  onChange: (value: string | null) => void;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(value ?? null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setPreview(value ?? null);
  }, [value]);

  function processFile(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/jpg"].includes(file.type)) {
      toast.error("Please choose a valid JPG, JPEG, or PNG image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Photo must be 2MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      setPendingPreview(result);
    };
    reader.onerror = () => {
      toast.error("Could not read the selected image.");
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }

  const sizeClasses = {
    sm: "size-16",
    md: "size-20",
    lg: "size-28",
    xl: "size-32",
  };

  return (
    <>
      <div className={cn("flex flex-col items-center gap-2.5", className)}>
        <div
          className={cn(
            "group relative cursor-pointer rounded-full p-1 transition-all duration-200",
            isDragging
              ? "ring-4 ring-primary ring-offset-2 scale-105"
              : "hover:ring-2 hover:ring-primary/50",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          aria-label={`Change photo for ${name}`}
        >
          <Avatar
            className={cn(
              sizeClasses[size],
              "border-2 border-background shadow-md transition-transform group-hover:scale-102",
            )}
          >
            <AvatarImage src={preview ?? undefined} alt={name} className="object-cover" />
            <AvatarFallback className="bg-primary/10 text-lg font-bold text-primary">
              {initials(name || "U")}
            </AvatarFallback>
          </Avatar>

          <span className="absolute bottom-1 right-1 grid size-7 place-items-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform duration-200 group-hover:scale-110">
            <Camera className="size-3.5" />
          </span>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          className="hidden"
          onChange={(event) => {
            processFile(event.target.files?.[0]);
            if (event.target) event.target.value = "";
          }}
        />

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            className="h-8 rounded-lg px-2.5 text-xs font-medium"
          >
            <ImagePlus className="mr-1.5 size-3.5" />
            {preview ? "Change photo" : "Upload photo"}
          </Button>
          {preview && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setPreview(null);
                onChange(null);
                toast.info("Photo removed.");
              }}
              className="h-8 rounded-lg px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="mr-1.5 size-3.5" /> Remove
            </Button>
          )}
        </div>

        <p className="text-[0.7rem] text-muted-foreground">
          Drag & drop or browse (JPG/PNG, max 2MB)
        </p>
      </div>
      <Dialog
        open={Boolean(pendingPreview)}
        onOpenChange={(open) => !open && setPendingPreview(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Review photo</DialogTitle>
            <DialogDescription>Positioned as a square portrait for this profile.</DialogDescription>
          </DialogHeader>
          {pendingPreview && (
            <div className="mx-auto size-56 overflow-hidden rounded-full border-4 border-primary/20 bg-muted shadow-inner">
              <img src={pendingPreview} alt="Photo preview" className="size-full object-cover" />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingPreview(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                setPreview(pendingPreview);
                onChange(pendingPreview);
                setPendingPreview(null);
                toast.success("Photo uploaded successfully.");
              }}
            >
              Use photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
