import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // Ensure visible contrast in both themes; pulse for perceived loading
        "animate-pulse rounded-md bg-foreground/10 ring-1 ring-border/60",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
