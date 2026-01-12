"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface MobileAddActivityFABProps {
  onClick: () => void;
}

export default function MobileAddActivityFAB({
  onClick,
}: MobileAddActivityFABProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 md:hidden">
      <Button
        onClick={onClick}
        className="h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg p-0 flex items-center justify-center"
        size="lg"
      >
        <Plus className="size-6" />
      </Button>
    </div>
  );
}
