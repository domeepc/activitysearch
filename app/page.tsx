'use client';

import { Authenticated } from 'convex/react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Search } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import './home.css';

const OpenStreetMapComponent = dynamic(
  () => import('@/components/ui/leafletMap/leafletMap'),
  { ssr: false }
);

const FilterContent = () => (
  <>
    <InputGroup>
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput placeholder="Enter location" />
    </InputGroup>
    <NativeSelect className="filters">
      <NativeSelectOption value="">Select category</NativeSelectOption>
      <NativeSelectOption value="airsoft">Airsoft</NativeSelectOption>
      <NativeSelectOption value="billiard">Billiard</NativeSelectOption>
      <NativeSelectOption value="golf">Golf</NativeSelectOption>
    </NativeSelect>
  </>
);

export default function Home() {
  return (
    <Authenticated>
      <section className="hidden md:block">
        <div className="filter_tab">
          <FilterContent />
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
              <FilterContent />
            </div>
            <DialogFooter>
              <Button className="bg-blue-600 hover:bg-blue-900">Search</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="map_tab">
        <OpenStreetMapComponent />
      </div>
    </Authenticated>
  );
}
