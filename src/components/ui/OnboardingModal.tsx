"use client";

import { useState } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { Modal } from "./modal";
import { Button } from "./button";

export interface OnboardingStep {
  title: string;
  description: string;
  mediaUrl?: string; // URL to GIF or video
  mediaType?: "image" | "video"; // Type of media
}

interface OnboardingModalProps {
  isOpen: boolean;
  steps: OnboardingStep[];
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingModal({
  isOpen,
  steps,
  onComplete,
  onSkip,
}: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const step = steps[currentStep];

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onSkip}
      title={`Getting Started - Step ${currentStep + 1} of ${steps.length}`}
      size="xl"
    >
      <div className="p-6">
        <div className="space-y-6">
          {/* Progress Indicator */}
          <div className="flex items-center gap-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all ${
                  index === currentStep
                    ? "bg-primary w-8"
                    : index < currentStep
                    ? "bg-primary/50 w-2"
                    : "bg-muted w-2"
                }`}
              />
            ))}
          </div>
          {/* Media */}
          {step.mediaUrl && (
            <div className="rounded-xl overflow-hidden bg-muted border border-border">
              {step.mediaType === "video" ? (
                <video
                  src={step.mediaUrl}
                  controls
                  autoPlay
                  loop
                  muted
                  className="w-full h-auto max-h-[400px] object-contain"
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={step.mediaUrl}
                  alt={step.title}
                  className="w-full h-auto max-h-[400px] object-contain"
                />
              )}
            </div>
          )}

          {/* Text Content */}
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-foreground">
              {step.title}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button variant="ghost" onClick={onSkip}>
              Skip tutorial
            </Button>

            <div className="flex items-center gap-3">
              {!isFirstStep && (
                <Button variant="outline" onClick={handlePrevious}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
              )}

              <Button onClick={handleNext} className="youtube-button">
                {isLastStep ? (
                  "Done"
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
