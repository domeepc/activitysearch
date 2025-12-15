"use client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import React, { Dispatch, useEffect, useRef, useState } from "react";
import { Button } from "./button";
import { Textarea } from "./textarea";
import { Avatar, AvatarImage, AvatarFallback } from "./avatar";
import { Upload, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";

export default function DialogAddActivity({
  showDialog,
  setShowDialog,
}: {
  showDialog: boolean;
  setShowDialog: Dispatch<React.SetStateAction<boolean>>;
}) {
  const createActivity = useMutation(api.activity.createActivity);
  // form state
  const [activityName, setActivityName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  // remove individual street/town inputs; address will include house number when available
  const [selectedCoords, setSelectedCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [price, setPrice] = useState("");
  // longitude/latitude removed — will be resolved via geocoding from `address`
  const [duration, setDuration] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [minAge, setMinAge] = useState("");
  const [tags, setTags] = useState("");
  const [equipment, setEquipment] = useState("");
  const [images, setImages] = useState<string[]>([]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const arr = Array.from(files);
    arr.forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    // reset input
    e.currentTarget.value = "";
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const parseFloatOr = (val: string, fallback = 0) => {
    const n = parseFloat(val);
    return Number.isNaN(n) ? fallback : n;
  };

  const parseIntOrUndefined = (val: string) => {
    if (!val) return undefined;
    const n = parseInt(val, 10);
    return Number.isNaN(n) ? undefined : n;
  };

  // Geocode an address using OpenStreetMap Nominatim (no Google API)
  const geocodeAddress = async (q: string) => {
    if (!q || !q.trim()) return null;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&countrycodes=hr&q=${encodeURIComponent(
          q
        )}`,
        { headers: { "User-Agent": "activitysearch/1.0" } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return null;
      const first = data[0];
      return {
        latitude: parseFloat(first.lat),
        longitude: parseFloat(first.lon),
      };
    } catch (err) {
      console.error("geocode error", err);
      return null;
    }
  };

  // Autocomplete suggestions
  const [suggestions, setSuggestions] = useState<
    { display_name: string; lat: string; lon: string; address?: any }[]
  >([]);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);

  const fetchSuggestions = async (q: string) => {
    if (!q || !q.trim()) {
      setSuggestions([]);
      return;
    }
    try {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=hr&q=${encodeURIComponent(
          q
        )}`,
        { signal: ac.signal, headers: { "User-Agent": "activitysearch/1.0" } }
      );
      if (!res.ok) return;
      const data = await res.json();
      const filtered = Array.isArray(data)
        ? data.filter(
            (d) =>
              d.address &&
              (d.address.road || d.address.pedestrian || d.address.footway)
          )
        : [];
      setSuggestions(filtered.slice(0, 5));
    } catch (err) {
      if ((err as any)?.name === "AbortError") return;
      console.error("suggestions error", err);
    }
  };

  const onAddressChange = (val: string) => {
    setAddress(val);
    setSelectedCoords(null);
    setSuggestions([]);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    // debounce
    debounceRef.current = window.setTimeout(() => {
      fetchSuggestions(val);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const handleAdd = async () => {
    try {
      // basic client-side validation for required fields
      if (!address.trim()) {
        console.error("Address is required");
        return;
      }
      if (!description.trim()) {
        console.error("Description is required");
        return;
      }

      const durationInt = parseIntOrUndefined(duration);
      const maxParticipantsInt = parseIntOrUndefined(maxParticipants);
      const minAgeInt = parseIntOrUndefined(minAge);

      // Prefer coordinates from selected suggestion, otherwise geocode
      const coords = selectedCoords ?? (await geocodeAddress(address));

      const args = {
        activityName: activityName || undefined,
        longitude: coords ? coords.longitude : 0,
        latitude: coords ? coords.latitude : 0,
        description: description,
        address: address,
        price: parseFloatOr(price, 0),
        // Convex `v.int64()` expects integer (BigInt) values
        duration: durationInt !== undefined ? BigInt(durationInt) : undefined,
        difficulty: difficulty || undefined,
        maxParticipants:
          maxParticipantsInt !== undefined
            ? BigInt(maxParticipantsInt)
            : undefined,
        minAge: minAgeInt !== undefined ? BigInt(minAgeInt) : undefined,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        rating: undefined,
        reviewCount: undefined,
        equipment: equipment
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean),
        images: images,
      } as any;

      // Cast to `any` to avoid generated FunctionReference type being treated as non-callable
      await (createActivity as unknown as (...args: any[]) => Promise<any>)(
        args
      );
      setShowDialog(false);
    } catch (err) {
      // Log error for debugging; keep UI behavior minimal here
      // eslint-disable-next-line no-console
      console.error("createActivity error:", err);
    }
  };

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent>
        <DialogTitle>Add New Activity</DialogTitle>

        <Label htmlFor="activityName">Activity Name</Label>
        <Input
          id="activityName"
          type="text"
          value={activityName}
          onChange={(e) => setActivityName(e.target.value)}
        />
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          className="resize-none"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Label htmlFor="address">Address</Label>
        <div className="relative">
          <Input
            id="address"
            type="text"
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            autoComplete="off"
          />
          {suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 mt-1 max-h-48 overflow-auto rounded border bg-white z-50">
              {suggestions.map((s, i) => {
                const house =
                  s.address?.house_number || s.address?.house_no || "";
                const road =
                  s.address?.road ||
                  s.address?.pedestrian ||
                  s.address?.footway ||
                  "";
                const townName =
                  s.address?.city ||
                  s.address?.town ||
                  s.address?.village ||
                  s.address?.county ||
                  "";
                return (
                  <li key={i}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-gray-100"
                      onClick={() => {
                        const addr = road
                          ? `${house ? house + " " : ""}${road}${
                              townName ? ", " + townName : ""
                            }`
                          : s.display_name;
                        setAddress(addr);
                        // address now contains house number + road (if available)
                        setSelectedCoords({
                          latitude: parseFloat(s.lat),
                          longitude: parseFloat(s.lon),
                        });
                        setSuggestions([]);
                      }}
                    >
                      <div className="text-sm font-medium">
                        {(house ? house + " " : "") + (road || s.display_name)}
                      </div>
                      {townName && (
                        <div className="text-xs text-muted-foreground">
                          {townName}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <Label htmlFor="price">Price</Label>
        <Input
          id="price"
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        {/* longitude/latitude are resolved via geocoding from `address` */}
        <Label htmlFor="duration">Duration</Label>
        <Input
          id="duration"
          type="number"
          min={0}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
        <Label htmlFor="difficulty">Difficulty</Label>
        <Input
          id="difficulty"
          type="text"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        />
        <Label htmlFor="maxParticipants">Max Participants</Label>
        <Input
          id="maxParticipants"
          type="number"
          min={0}
          value={maxParticipants}
          onChange={(e) => setMaxParticipants(e.target.value)}
        />
        <Label htmlFor="minAge">Min Age</Label>
        <Input
          id="minAge"
          type="number"
          min={12}
          value={minAge}
          onChange={(e) => setMinAge(e.target.value)}
        />
        <Label htmlFor="tags">Tags (comma separated)</Label>
        <Input
          id="tags"
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
        <Label htmlFor="equipment">Equipment (comma separated)</Label>
        <Input
          id="equipment"
          type="text"
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
        />
        <Label htmlFor="images">Images</Label>
        <div className="flex flex-col gap-2">
          <input
            id="images-upload"
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            className="hidden"
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                (
                  document.getElementById(
                    "images-upload"
                  ) as HTMLInputElement | null
                )?.click()
              }
            >
              <Upload className="size-4 mr-2" /> Upload Images
            </Button>
            <div className="flex gap-2">
              {images.map((src, idx) => (
                <div key={idx} className="relative">
                  <Avatar className="size-12">
                    <AvatarImage src={src} alt={`img-${idx}`} />
                    <AvatarFallback>IMG</AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute -top-2 -right-2 bg-white rounded-full p-1"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleAdd}
            disabled={!address.trim() || !description.trim()}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
