import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  priority?: boolean;
  /** Height in pixels — width scales from native ~3.94:1 aspect */
  height?: number;
}

export function BrandLogo({ className, priority = false, height = 32 }: BrandLogoProps) {
  const aspect = 500 / 127;
  const width = Math.round(height * aspect);

  return (
    <Image
      src="/llbox-logo.png"
      alt="LLBOX"
      width={width}
      height={height}
      priority={priority}
      className={cn("object-contain object-left", className)}
      style={{ width: "auto", height }}
    />
  );
}
