"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";

function CarouselSlideImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted">
        <p className="text-sm text-muted-foreground">Image not available</p>
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      className="object-cover"
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onError={() => setFailed(true)}
    />
  );
}

interface ActivityDetailGalleryProps {
  images: string[];
  title: string;
  setCarouselApi: (api: CarouselApi | undefined) => void;
}

export function ActivityDetailGallery({
  images,
  title,
  setCarouselApi,
}: ActivityDetailGalleryProps) {
  if (images.length === 0) {
    return (
      <div className="flex h-[320px] w-full items-center justify-center rounded-2xl bg-zinc-100 md:h-[420px]">
        <p className="text-sm text-zinc-400">No image available</p>
      </div>
    );
  }

  return (
    <div className="relative h-[320px] w-full overflow-hidden rounded-2xl md:h-[420px]">
      <Carousel
        setApi={setCarouselApi}
        noManualControl
        className="h-full w-full"
        opts={{
          align: "start",
          slidesToScroll: 1,
        }}
      >
        <CarouselContent className="ml-0! h-full">
          {images.map((image, index) => (
            <CarouselItem
              key={index}
              className="h-full basis-1/2 pl-0 pr-2 md:basis-1/3"
            >
              <div className="relative h-full w-full overflow-hidden rounded-xl">
                <CarouselSlideImage
                  src={image}
                  alt={`${title} - Image ${index + 1}`}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
}
