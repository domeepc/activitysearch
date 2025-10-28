'use client';

import { Authenticated } from 'convex/react';

import './home.css';

export default function Home() {
  return (
    <Authenticated>
      <section>
        <div className="filter_tab"></div>
        <div className="map_tab"> </div>
      </section>
    </Authenticated>
  );
}
