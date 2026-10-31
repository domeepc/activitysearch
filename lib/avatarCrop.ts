/**
 * Square avatar cropping. The photo is shown "cover"-fitted in a square viewport, scaled by `zoom`
 * and moved by `offset` (viewport pixels, image centre relative to viewport centre).
 */
export interface CropState {
  imageWidth: number;
  imageHeight: number;
  viewport: number;
  zoom: number;
  offset: { x: number; y: number };
}

/** Viewport pixels per image pixel */
export function displayScale({ imageWidth, imageHeight, viewport, zoom }: CropState): number {
  return (viewport / Math.min(imageWidth, imageHeight)) * zoom;
}

/** Keep the photo covering the whole viewport: no empty edges inside the circle */
export function clampOffset(state: CropState): { x: number; y: number } {
  const scale = displayScale(state);
  const maxX = Math.max(0, (state.imageWidth * scale - state.viewport) / 2);
  const maxY = Math.max(0, (state.imageHeight * scale - state.viewport) / 2);
  const clamp = (v: number, max: number) => Math.min(max, Math.max(-max, v));
  return { x: clamp(state.offset.x, maxX), y: clamp(state.offset.y, maxY) };
}

/** The square of the original image (in image pixels) that is visible in the viewport */
export function cropRect(state: CropState): { x: number; y: number; size: number } {
  const scale = displayScale(state);
  const { x, y } = clampOffset(state);
  const size = state.viewport / scale;
  return {
    x: state.imageWidth / 2 - (state.viewport / 2 + x) / scale,
    y: state.imageHeight / 2 - (state.viewport / 2 + y) / scale,
    size,
  };
}
