import { cn } from "@/lib/utils";

interface SchoolLogoProps {
  logoUrl?: string | null;
  schoolName?: string | null;
  shortName?: string | null;
  className?: string;
  imageClassName?: string;
}

export function SchoolLogo({
  logoUrl,
  schoolName,
  shortName,
  className,
  imageClassName,
}: SchoolLogoProps) {
  return logoUrl ? (
    <img
      src={logoUrl}
      alt={`${schoolName ?? shortName ?? "School"} logo`}
      className={cn(
        "shrink-0 rounded-xl bg-white object-contain p-1.5 dark:bg-slate-100",
        className,
        imageClassName,
      )}
    />
  ) : (
    <img
      src="/shanscot-logo.png"
      alt="SHANSCOT Technologies logo"
      className={cn(
        "shrink-0 rounded-xl bg-white object-contain p-1.5",
        className,
        imageClassName,
      )}
    />
  );
}
