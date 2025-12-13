'use client';

import { Authenticated } from 'convex/react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Search } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import './home.css';
import { ActivityData } from '@/components/ui/leafletMap/leafletMap';
import { useEffect, useState} from 'react';
import SearchAutocomplete from '@/components/ui/search-autocomplete';

const OpenStreetMapComponent = dynamic(
  () => import('@/components/ui/leafletMap/leafletMap'),
  { ssr: false }
);

const FilterContent = ({ 
  activities, 
  selectedCategory, 
  onCategoryChange,
  onActivitySelect 
}: { 
  activities: ActivityData[]; 
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  onActivitySelect: (activity: ActivityData) => void;
}) => {
  // Get unique categories
  const uniqueCategories = Array.from(
    new Set(activities.map((activity) => activity.category))
  );

  return (
    <>
      <SearchAutocomplete
        activities={activities}
        onActivitySelect={onActivitySelect}
        placeholder="Search by activity or location..."
      />
      <NativeSelect 
        className="filters" 
        value={selectedCategory}
        onChange={(e) => onCategoryChange(e.target.value)}
      >
        <NativeSelectOption value="">All Categories</NativeSelectOption>
        {uniqueCategories.map((category) => (
          <NativeSelectOption key={category} value={category}>
            {category}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </>
  );
};

export default function Home() {
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedActivity, setSelectedActivity] = useState<ActivityData | null>(null);

  useEffect(() => {
    const getActivityData = async () => {
      try {
        const response = await fetch('/data.json');
        const data = await response.json();
        setActivities(data.activities);
      } catch (error) {
        console.error('Error loading activity data:', error);
      }
    };

    getActivityData();
  }, []);

  // Filter activities based on selected category
  const filteredActivities = selectedCategory
    ? activities.filter((activity) => activity.category === selectedCategory)
    : activities;

  // Handle activity selection from search
  const handleActivitySelect = (activity: ActivityData) => {
    setSelectedActivity(activity);
    // Reset category filter to show the selected activity
    setSelectedCategory('');
  };

  return (
    <Authenticated>
      <section className="hidden md:block">
        <div className="filter_tab">
          <FilterContent 
            activities={activities}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            onActivitySelect={handleActivitySelect}
          />
        </div>
      </section>

      <div className="mobile_filter_tab_button md:hidden">
        <Dialog>
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
              <FilterContent 
                activities={activities}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                onActivitySelect={handleActivitySelect}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button className="bg-blue-600 hover:bg-blue-900">Search</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="map_tab">
        <OpenStreetMapComponent 
          activities={filteredActivities} 
          selectedActivity={selectedActivity}
        />
      </div>
    </Authenticated>
  );
}
