'use client';

import { Authenticated } from 'convex/react';

import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';

import './home.css';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';

import { Search } from 'lucide-react';
import GoogleMapComponent from '@/components/ui/googleMaps/googleMaps';

export default function Home() {
  return (
    <Authenticated>
      <section>
        <div className="filter_tab">
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
        </div>
      </section>
      <div className="map_tab">
        <GoogleMapComponent />
      </div>
    </Authenticated>
  );
}
