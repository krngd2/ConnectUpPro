"use client";

import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";

interface AnimatedArrowProps {
  targetId: string;
  message?: string;
  onDismiss?: () => void;
}

export function AnimatedArrow({
  targetId,
  message = "Click here to get started",
  onDismiss,
}: AnimatedArrowProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updatePosition = () => {
      const target = document.getElementById(targetId);
      if (target) {
        const rect = target.getBoundingClientRect();
        setPosition({
          top: rect.top + rect.height / 2,
          left: rect.left - 20, // Position to the left of the button
        });
        setIsVisible(true);
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
    };
  }, [targetId]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed z-50 flex items-center gap-3"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: "translateY(-50%)",
      }}
    >
      <div className="flex flex-col items-end gap-2">
        <p className="text-sm font-medium text-foreground bg-card border border-border px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
          {message}
        </p>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Skip
          </button>
        )}
      </div>
      <ArrowLeft
        className="h-6 w-6 text-primary animate-pulse"
        strokeWidth={2.5}
      />
    </div>
  );
}
