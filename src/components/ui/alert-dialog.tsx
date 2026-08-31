"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

export function AlertDialog({
  isOpen,
  onClose,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false,
  onConfirm,
  isLoading = false,
}: AlertDialogProps) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isLoading) {
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
  }, [isOpen, onClose, isLoading]);

  if (!isOpen) return null;

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

      {/* Dialog */}
      <div
        className="relative bg-background border shadow-xl w-full mx-4 max-w-md rounded-lg overflow-hidden"
        style={{ backgroundColor: "hsl(var(--background))" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
            className="p-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            variant={isDestructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
