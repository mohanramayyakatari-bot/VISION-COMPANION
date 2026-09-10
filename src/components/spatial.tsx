// Spatial Glass design-system primitives shared by every Vision Companion
// screen: frosted floating surfaces, the glowing lens logo and the ambient
// background orbs. Visual only — no app behaviour lives here.

import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/vision-companion-logo.png.asset.json";

/** Ambient midnight background with two slow-drifting light orbs. */
export function SpatialBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -top-24 -left-20 size-[22rem] rounded-full blur-3xl opacity-60 animate-orb"
        style={{ background: "var(--gradient-glow)" }}
      />
      <div
        className="absolute -bottom-28 -right-24 size-[26rem] rounded-full blur-3xl opacity-45 animate-orb"
        style={{ background: "var(--gradient-glow)", animationDelay: "-6s" }}
      />
    </div>
  );
}

/** The Vision Companion mark supplied by the product owner. */
export function VisionLens({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt=""
      aria-hidden="true"
      className={cn("block shrink-0 rounded-[24%] object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}

export const GlassCard = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("glass-panel rounded-[1.75rem]", className)} {...props} />
  ),
);
GlassCard.displayName = "GlassCard";

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "glass" | "danger";
};

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, tone = "glass", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl px-5 min-h-14 text-base font-semibold",
        "transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4",
        "focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        tone === "primary" && "bg-gradient-primary text-primary-foreground edge-glow",
        tone === "glass" && "glass-panel text-foreground",
        tone === "danger" && "bg-destructive text-destructive-foreground",
        className,
      )}
      {...props}
    />
  ),
);
GlassButton.displayName = "GlassButton";

/** Small frosted pill used for status and voice-state hints. */
export function GlassPill({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full glass-panel px-3.5 py-2 text-xs font-semibold",
        className,
      )}
      {...props}
    />
  );
}
