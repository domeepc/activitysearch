"use client";

import SearchAutocomplete from "@/components/ui/search-autocomplete";
import {
  MultiSelect,
  MultiSelectTrigger,
  MultiSelectContent,
  MultiSelectValue,
  MultiSelectGroup,
  MultiSelectItem,
} from "@/components/ui/multi-select";
import { ActivityFilterProps } from "@/lib/types/activity";
import { getUniqueCategories } from "@/lib/activities";

export default function ActivityFilters({
  activities,
  selectedCategories,
  onCategoryChange,
  onActivitySelect,
}: ActivityFilterProps) {
  const uniqueCategories = getUniqueCategories(activities);

  return (
    <>
      <SearchAutocomplete
        activities={activities}
        onActivitySelect={onActivitySelect}
        placeholder="Search by activity or location..."
      />
      <MultiSelect
        values={selectedCategories}
        onValuesChange={onCategoryChange}
      >
        <MultiSelectTrigger className="w-full max-w-62">
          <MultiSelectValue placeholder="Select category..." />
        </MultiSelectTrigger>
        <MultiSelectContent search={false} className="filter_tab_content">
          <MultiSelectGroup>
            {uniqueCategories.map((category) => (
              <MultiSelectItem key={category} value={category}>
                {category}
              </MultiSelectItem>
            ))}
          </MultiSelectGroup>
        </MultiSelectContent>
      </MultiSelect>
    </>
  );
}

