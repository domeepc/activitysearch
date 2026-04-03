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
      <div className="w-full px-4 pt-6 pb-4 md:px-8">
        <div className="mx-auto flex h-[300px] w-full max-w-4xl items-center justify-center rounded-xl bg-muted md:h-[350px]">
          <p className="text-muted-foreground">No image available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full px-4 pt-4 pb-4">
      <div className="relative mx-auto h-[300px] w-full overflow-hidden rounded-xl md:h-[350px]">
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
                <div className="relative h-full w-full overflow-hidden rounded-lg">
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
    </div>
  );
}
