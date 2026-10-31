import { expect, test } from "vitest";
import { clampOffset, cropRect } from "./avatarCrop";

const landscape = { imageWidth: 2000, imageHeight: 1000, viewport: 200 };

test("default crop is the centred square of the short side", () => {
  expect(cropRect({ ...landscape, zoom: 1, offset: { x: 0, y: 0 } })).toEqual({ x: 500, y: 0, size: 1000 });
});

test("dragging the photo right shows more of its left side", () => {
  // scale = 0.2 view px per image px; moving 50 view px = 250 image px
  expect(cropRect({ ...landscape, zoom: 1, offset: { x: 50, y: 0 } })).toEqual({ x: 250, y: 0, size: 1000 });
});

test("can't drag past the edge or leave gaps; zoom makes the crop smaller", () => {
  // At zoom 1 there's no vertical room; horizontally at most 100 view px each way
  expect(clampOffset({ ...landscape, zoom: 1, offset: { x: 999, y: 999 } })).toEqual({ x: 100, y: 0 });
  expect(cropRect({ ...landscape, zoom: 1, offset: { x: -999, y: 0 } })).toEqual({ x: 1000, y: 0, size: 1000 });
  const zoomed = cropRect({ ...landscape, zoom: 2, offset: { x: 0, y: 0 } });
  expect(zoomed).toEqual({ x: 750, y: 250, size: 500 });
});
