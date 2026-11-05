/** Layout maths for putting media of any aspect ratio into frames without distortion. */

export type Rect = {readonly x: number; readonly y: number; readonly width: number; readonly height: number};

/**
 * The largest frame of the given aspect ratio (width / height) that fits
 * inside `bounds`, centred. Use it to size a CyberFrame for a landscape or
 * portrait asset: the frame takes the media's shape, the media is never
 * stretched.
 */
export const frameFor = (aspect: number, bounds: Rect, align: {x?: number; y?: number} = {}): Rect => {
  const ax = align.x ?? 0.5;
  const ay = align.y ?? 0.5;
  let width = bounds.width;
  let height = width / aspect;
  if (height > bounds.height) {
    height = bounds.height;
    width = height * aspect;
  }
  return {
    x: bounds.x + (bounds.width - width) * ax,
    y: bounds.y + (bounds.height - height) * ay,
    width,
    height,
  };
};

/**
 * Where to draw media of `aspect` inside a `width` x `height` box.
 * contain: whole media visible (letterboxed); cover: box filled (cropped).
 * `focus` (0..1, 0..1) chooses which part survives a cover crop.
 */
export const fitMedia = (
  aspect: number,
  width: number,
  height: number,
  mode: 'contain' | 'cover' = 'cover',
  focus: {x?: number; y?: number} = {},
): Rect => {
  const boxAspect = width / height;
  const wider = aspect > boxAspect;
  const fillWidth = mode === 'contain' ? wider : !wider;
  const w = fillWidth ? width : height * aspect;
  const h = fillWidth ? width / aspect : height;
  return {
    x: (width - w) * (focus.x ?? 0.5),
    y: (height - h) * (focus.y ?? 0.5),
    width: w,
    height: h,
  };
};

/**
 * A "camera" inside a frame: returns the CSS transform that zooms the content
 * so that `region` (in content px) fills the box, blended by `progress`.
 * Apply to a wrapper with `transformOrigin: '0 0'`.
 */
export const reframe = (region: Rect, boxWidth: number, boxHeight: number, progress: number, maxZoom = 4): string => {
  const p = Math.min(1, Math.max(0, progress));
  const target = Math.min(maxZoom, Math.min(boxWidth / region.width, boxHeight / region.height));
  // Interpolate zoom in log space so the move feels even.
  const zoom = Math.exp(Math.log(target) * p);
  const cx = region.x + region.width / 2;
  const cy = region.y + region.height / 2;
  // At p = 1 the region centre sits at the box centre.
  const tx = (boxWidth / 2 - cx * zoom) * p;
  const ty = (boxHeight / 2 - cy * zoom) * p;
  // Never show beyond the content edges.
  const minX = boxWidth - boxWidth * zoom;
  const minY = boxHeight - boxHeight * zoom;
  const x = Math.min(0, Math.max(minX, tx));
  const y = Math.min(0, Math.max(minY, ty));
  return `translate(${x.toFixed(3)}px, ${y.toFixed(3)}px) scale(${zoom.toFixed(5)})`;
};

export const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  width: a.width + (b.width - a.width) * t,
  height: a.height + (b.height - a.height) * t,
});
