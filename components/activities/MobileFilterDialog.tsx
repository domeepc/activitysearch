"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import ActivityFilters from "./ActivityFilters";
import { ActivityData } from "@/lib/types/activity";

interface MobileFilterDialogProps {
  activities: ActivityData[];
  selectedCategories: string[];
  onCategoryChange: (categories: string[]) => void;
  onActivitySelect: (activity: ActivityData) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: () => void;
}

export default function MobileFilterDialog({
  activities,
  selectedCategories,
  onCategoryChange,
  onActivitySelect,
  open,
  onOpenChange,
  onSearch,
}: MobileFilterDialogProps) {
  return (
    <div className="mobile_filter_tab_button md:hidden">
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="rounded-full aspect-square p-6"
          >
            <Search className="size-6" />
          </Button>
        </DialogTrigger>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogTitle>Activities</DialogTitle>
          <div className="filter_tab">
            <ActivityFilters
              activities={activities}
              selectedCategories={selectedCategories}
              onCategoryChange={onCategoryChange}
              onActivitySelect={onActivitySelect}
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              className="w-full rounded-full bg-blue-600 hover:bg-blue-900"
              onClick={onSearch}
            >
              Search
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

