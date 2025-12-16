import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

interface FormFieldProps {
  label: string;
  id: string;
  name?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  error?: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  helperText?: string;
  multiline?: boolean;
  rows?: number;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  className?: string;
}

export function FormField({
  label,
  id,
  name,
  value,
  onChange,
  error,
  type = "text",
  required = false,
  disabled = false,
  placeholder,
  helperText,
  multiline = false,
  rows = 4,
  min,
  max,
  step,
  className,
}: FormFieldProps) {
  const inputId = id;
  const inputName = name || id;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={inputId}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {multiline ? (
        <Textarea
          id={inputId}
          name={inputName}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          className={cn(
            "resize-none",
            error && "border-destructive",
            className
          )}
          aria-required={required}
          aria-invalid={!!error}
        />
      ) : (
        <Input
          id={inputId}
          name={inputName}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          className={cn(error && "border-destructive", className)}
          aria-required={required}
          aria-invalid={!!error}
        />
      )}
      {helperText && !error && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
      {error && (
        <p className="text-sm text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

