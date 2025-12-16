"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MapPin, Loader2 } from "lucide-react";

export interface AddressSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  address?: Partial<Record<string, string>>;
}

export interface AddressCoordinates {
  latitude: number;
  longitude: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: string, coords: AddressCoordinates) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  error?: string;
  required?: boolean;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Enter address...",
  id,
  className,
  error,
  required = false,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q || !q.trim()) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    try {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setIsLoading(true);

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=hr&q=${encodeURIComponent(
          q
        )}`,
        { signal: ac.signal, headers: { "User-Agent": "activitysearch/1.0" } }
      );

      if (!res.ok) {
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      const filtered = Array.isArray(data)
        ? data.filter(
            (d) =>
              d.address &&
              (d.address.road || d.address.pedestrian || d.address.footway)
          )
        : [];
      setSuggestions(filtered.slice(0, 5));
      setIsLoading(false);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      console.error("suggestions error", err);
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (val: string) => {
    onChange(val);
    setHighlightedIndex(-1);
    setIsOpen(true);

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      fetchSuggestions(val);
    }, 300);
  };

  const handleSelect = (suggestion: AddressSuggestion) => {
    const addr = suggestion.address ?? {};
    const house = addr.house_number || addr.house_no || "";
    const road = addr.road || addr.pedestrian || addr.footway || "";
    const townName =
      addr.city || addr.town || addr.village || addr.county || "";

    const formattedAddress = road
      ? `${house ? house + " " : ""}${road}${townName ? ", " + townName : ""}`
      : suggestion.display_name;

    onChange(formattedAddress);
    onSelect(formattedAddress, {
      latitude: parseFloat(suggestion.lat),
      longitude: parseFloat(suggestion.lon),
    });
    setIsOpen(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelect(suggestions[highlightedIndex]);
        } else if (suggestions.length > 0) {
          handleSelect(suggestions[0]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const formatSuggestionDisplay = (suggestion: AddressSuggestion) => {
    const addr = suggestion.address ?? {};
    const house = addr.house_number || addr.house_no || "";
    const road = addr.road || addr.pedestrian || addr.footway || "";
    const townName =
      addr.city || addr.town || addr.village || addr.county || "";

    return {
      primary: (house ? house + " " : "") + (road || suggestion.display_name),
      secondary: townName,
    };
  };

  return (
    <div ref={wrapperRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
        <Input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0 || value.trim()) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(
            "pl-10",
            error && "border-destructive focus-visible:ring-destructive"
          )}
          aria-required={required}
          aria-invalid={!!error}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive mt-1.5">{error}</p>
      )}

      {isOpen && (suggestions.length > 0 || isLoading) && (
        <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground rounded-md border shadow-md">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              {suggestions.map((suggestion, index) => {
                const display = formatSuggestionDisplay(suggestion);
                return (
                  <button
                    key={`${suggestion.lat}-${suggestion.lon}-${index}`}
                    type="button"
                    onClick={() => handleSelect(suggestion)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 flex items-start gap-3",
                      "hover:bg-accent transition-colors cursor-pointer",
                      "border-b border-border last:border-0",
                      highlightedIndex === index && "bg-accent"
                    )}
                  >
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {display.primary}
                      </div>
                      {display.secondary && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {display.secondary}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

