"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    
    // Combine refs
    React.useImperativeHandle(ref, () => inputRef.current!);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onCheckedChange?.(e.target.checked);
      props.onChange?.(e);
    };

    const handleDivClick = () => {
      if (!props.disabled && inputRef.current) {
        inputRef.current.click();
      }
    };

    return (
      <div className="relative inline-flex items-center">
        <input
          type="checkbox"
          ref={inputRef}
          checked={checked}
          onChange={handleChange}
          className="sr-only peer"
          {...props}
        />
        <div
          onClick={handleDivClick}
          className={cn(
            "h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background flex items-center justify-center transition-colors cursor-pointer",
            "peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
            "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
            props.disabled && "cursor-not-allowed opacity-50",
            checked && "bg-primary text-primary-foreground",
            className
          )}
        >
          {checked && (
            <CheckIcon className="h-3 w-3 text-primary-foreground" />
          )}
        </div>
      </div>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
