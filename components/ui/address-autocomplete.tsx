"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MapPin, Loader2 } from "lucide-react";

import type { AddressCoordinates } from "@/lib/types/coordinates";

export type { AddressCoordinates } from "@/lib/types/coordinates";

// Attribute used by parent dialogs to detect clicks on this portal and suppress onPointerDownOutside
export const ADDRESS_DROPDOWN_ATTR = "data-address-dropdown";

export interface AddressSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  address?: Partial<Record<string, string>>;
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
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Stop native pointerdown only — Radix DismissableLayer listens for "pointerdown"
  // on document. Stopping mousedown/click would block React's delegated handlers
  // on child buttons (React listens at root, our portal is at body).
  useEffect(() => {
    const el = dropdownRef.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener("pointerdown", stop);
    return () => el.removeEventListener("pointerdown", stop);
  }, [isOpen, suggestions.length]);

  useLayoutEffect(() => {
    if (!isOpen || !inputRef.current) return;
    const update = () => {
      if (!inputRef.current) return;
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom, left: rect.left, width: rect.width });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [isOpen]);

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

      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: ac.signal });
      if (!res.ok) { setIsLoading(false); return; }

      const data = await res.json();
      const filtered = Array.isArray(data) ? data : [];

      const seen = new Set<string>();
      const unique = filtered.filter((s) => {
        const addr = s.address ?? {};
        const road = addr.road || addr.pedestrian || addr.footway || "";
        const town = addr.city || addr.town || addr.village || addr.county || "";
        const key = `${road.toLowerCase().trim()}-${town.toLowerCase().trim()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setSuggestions(unique.slice(0, 5));
      setIsLoading(false);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (val: string) => {
    onChange(val);
    setHighlightedIndex(-1);
    setIsOpen(true);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => fetchSuggestions(val), 300);
  };

  const handleSelect = (suggestion: AddressSuggestion) => {
    const addr = suggestion.address ?? {};
    const house = addr.house_number || addr.house_no || "";
    const road = addr.road || addr.pedestrian || addr.footway || "";
    const town = addr.city || addr.town || addr.village || addr.county || "";
    const formatted = road
      ? `${house ? house + " " : ""}${road}${town ? ", " + town : ""}`
      : suggestion.display_name;

    onChange(formatted);
    onSelect(formatted, {
      latitude: parseFloat(suggestion.lat),
      longitude: parseFloat(suggestion.lon),
    });
    setIsOpen(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((p) => Math.min(p + 1, suggestions.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((p) => Math.max(p - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        handleSelect(suggestions[highlightedIndex >= 0 ? highlightedIndex : 0]);
        break;
      case "Escape":
        setIsOpen(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      const target = e.target as Element | null;
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(target) &&
        !target?.closest(`[${ADDRESS_DROPDOWN_ATTR}]`)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const formatDisplay = (s: AddressSuggestion) => {
    const addr = s.address ?? {};
    const house = addr.house_number || addr.house_no || "";
    const road = addr.road || addr.pedestrian || addr.footway || "";
    const town = addr.city || addr.town || addr.village || addr.county || "";
    return {
      primary: (house ? house + " " : "") + (road || s.display_name),
      secondary: town,
    };
  };

  const showDropdown = isOpen && (suggestions.length > 0 || isLoading) && dropdownPos;

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
          onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="new-password"
          className={cn("pl-10", error && "border-destructive focus-visible:ring-destructive")}
          aria-required={required}
          aria-invalid={!!error}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {error && <p className="text-sm text-destructive mt-1.5">{error}</p>}

      {mounted && showDropdown && createPortal(
        <div
          ref={dropdownRef}
          {...{ [ADDRESS_DROPDOWN_ATTR]: "true" }}
          className="fixed rounded-xl border border-zinc-200 bg-white shadow-md pointer-events-auto"
          style={{
            top: dropdownPos!.top + 4,
            left: dropdownPos!.left,
            width: dropdownPos!.width,
            zIndex: 2147483000,
          }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              {suggestions.map((suggestion, index) => {
                const display = formatDisplay(suggestion);
                return (
                  <button
                    key={`${suggestion.lat}-${suggestion.lon}-${index}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(suggestion)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 flex items-start gap-3",
                      "hover:bg-zinc-50 transition-colors cursor-pointer",
                      "border-b border-zinc-100 last:border-0",
                      highlightedIndex === index && "bg-zinc-50"
                    )}
                  >
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{display.primary}</div>
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
        </div>,
        document.body
      )}
    </div>
  );
}
