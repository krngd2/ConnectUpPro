"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
}: ModalProps) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative bg-background border shadow-xl w-full mx-4 ${sizeClasses[size]} max-h-[90vh] overflow-hidden rounded-lg`}
        style={{ backgroundColor: "hsl(var(--background))" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h2 className="text-l font-semibold text-foreground">{title}</h2>
          <Button variant="outline" size="sm" onClick={onClose} className="p-2">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          {children}
        </div>
      </div>
    </div>
  );
}
