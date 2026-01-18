"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface AddActivityButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "onClick"> {
  onClick: () => void;
}

export default function AddActivityButton({
  onClick,
  variant = "default",
  className,
  size,
  ...props
}: AddActivityButtonProps) {
  return (
    <Button
      onClick={onClick}
      variant={variant}
      className={className}
      size={size}
      {...props}
    >
      <Plus className="size-4 mr-2" />
      Add Activity
    </Button>
  );
}
