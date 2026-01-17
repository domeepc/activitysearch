"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface StepperProps {
  steps: { label: string; description?: string }[];
  currentStep: number;
  className?: string;
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-center">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isPending = stepNumber > currentStep;

          return (
            <React.Fragment key={index}>
              {/* Step Circle */}
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300 ease-in-out shrink-0",
                  isCompleted &&
                    "bg-primary border-primary text-primary-foreground scale-100",
                  isCurrent &&
                    "bg-primary border-primary text-primary-foreground scale-110 shadow-lg",
                  isPending &&
                    "bg-background border-muted-foreground/30 text-muted-foreground scale-100"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4 animate-in fade-in-0 zoom-in-50 duration-300" />
                ) : (
                  <span className="text-xs font-semibold">{stepNumber}</span>
                )}
              </div>
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-12 mx-2 transition-all duration-500 ease-in-out",
                    stepNumber < currentStep ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
