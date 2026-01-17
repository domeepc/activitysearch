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
        {steps.map((_step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isPending = stepNumber > currentStep;

          return (
            <React.Fragment key={index}>
              {/* Step Circle */}
              <div
                className={cn(
                  "flex items-center justify-center rounded-full border-2 transition-all duration-300 ease-in-out shrink-0",
                  "w-7 h-7 md:w-8 md:h-8",
                  isCompleted &&
                  "bg-primary border-primary text-primary-foreground scale-100",
                  isCurrent &&
                  "bg-primary border-primary text-primary-foreground md:scale-110 scale-105 shadow-lg",
                  isPending &&
                  "bg-background border-muted-foreground/30 text-muted-foreground scale-100"
                )}
              >
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5 md:h-4 md:w-4 animate-in fade-in-0 zoom-in-50 duration-300" />
                ) : (
                  <span className="text-[10px] md:text-xs font-semibold">{stepNumber}</span>
                )}
              </div>
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 transition-all duration-500 ease-in-out shrink",
                    "w-4 md:w-12 mx-1 md:mx-2",
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
