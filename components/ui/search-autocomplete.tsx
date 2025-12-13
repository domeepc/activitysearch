'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, MapPin, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ActivityData } from './leafletMap/leafletMap';

interface SearchAutocompleteProps {
  activities: ActivityData[];
  onActivitySelect: (activity: ActivityData) => void;
  placeholder?: string;
  className?: string;
}

interface SearchResult {
  type: 'activity' | 'location';
  activity: ActivityData;
  matchField: string;
}

export default function SearchAutocomplete({
  activities,
  onActivitySelect,
  placeholder = 'Search by activity or location...',
  className = '',
}: SearchAutocompleteProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search logic - compute results during render
  const results = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    let matchedResults: SearchResult[] = [];

    if (searchTerm.trim()) {
      activities.forEach((activity) => {
        // Search by activity title
        if (activity.title.toLowerCase().includes(searchLower)) {
          matchedResults.push({
            type: 'activity',
            activity,
            matchField: activity.title,
          });
        }
        // Search by location name
        else if (activity.location.name.toLowerCase().includes(searchLower)) {
          matchedResults.push({
            type: 'location',
            activity,
            matchField: activity.location.name,
          });
        }
        // Search by location address
        else if (activity.location.address.toLowerCase().includes(searchLower)) {
          matchedResults.push({
            type: 'location',
            activity,
            matchField: activity.location.address,
          });
        }
      });
      matchedResults = matchedResults.slice(0, 8); // Limit to 8 results
    }
    return matchedResults;
  }, [searchTerm, activities]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => 
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : prev
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < results.length) {
          handleSelect(results[highlightedIndex].activity);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelect = (activity: ActivityData) => {
    setSearchTerm(activity.title);
    setIsOpen(false);
    setHighlightedIndex(-1);
    onActivitySelect(activity);
  };

  const highlightMatch = (text: string, search: string) => {
    const index = text.toLowerCase().indexOf(search.toLowerCase());
    if (index === -1) return text;

    return (
      <>
        {text.substring(0, index)}
        <span className="font-semibold text-primary">
          {text.substring(index, index + search.length)}
        </span>
        {text.substring(index + search.length)}
      </>
    );
  };

  return (
    <div ref={wrapperRef} className={cn('relative w-full', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setHighlightedIndex(-1);
            setIsOpen(true);
          }}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "w-full h-10 pl-10 pr-4 rounded-md border border-input bg-background",
            "text-sm placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
            "transition-all"
          )}
        />
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-input rounded-md shadow-lg max-h-80 overflow-y-auto">
          {results.map((result, index) => (
            <button
              key={`${result.activity.id}-${index}`}
              onClick={() => handleSelect(result.activity)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={cn(
                "w-full text-left px-3 py-2.5 flex items-start gap-3",
                "hover:bg-accent transition-colors cursor-pointer border-b border-border last:border-0",
                highlightedIndex === index && "bg-accent"
              )}
            >
              <div className="mt-0.5 shrink-0">
                {result.type === 'activity' ? (
                  <Tag className="h-4 w-4 text-blue-500" />
                ) : (
                  <MapPin className="h-4 w-4 text-green-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {highlightMatch(result.activity.title, searchTerm)}
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {result.type === 'location' && (
                    <>{highlightMatch(result.matchField, searchTerm)}</>
                  )}
                  {result.type === 'activity' && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 inline" />
                      {result.activity.location.name}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {result.activity.category} • {result.activity.price.amount} {result.activity.price.currency}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
