/**
 * Reproduces the web app's avatar zoom/pan math (src/components/
 * MemberAvatarImage.tsx's avatarTransformStyle + src/components/admin/
 * PhotoPositioner.tsx's maxOffsetForZoom) so a member's stored
 * photoZoom/photoOffsetX/photoOffsetY render identically here.
 *
 * All three functions carry a "worklet" directive so they're callable
 * both from plain JS (list-row/detail-header rendering) and from inside
 * a Reanimated gesture .onUpdate/useAnimatedStyle callback (PhotoPositioner's
 * live pinch/pan preview), without duplicating the math for each context.
 */

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

/**
 * The further zoomed in a photo is, the more of it hangs off the edges of
 * the frame -- and that overhang is exactly how much room there is to pan
 * without revealing empty background. The formula is 50*(z-1)/z, not the
 * more obvious 50*(z-1): getAvatarPhotoStyle's translate is scaled by zoom
 * (offsetX/100 * size * zoom), so a stored offset stays a zoom-invariant
 * relative position -- the safe offsetX range has to divide out that same
 * zoom factor to land back on the real pixel overhang of size*(z-1)/2.
 * Using 50*(z-1) here would let panning go `zoom` times further than the
 * image actually extends, revealing blank space at low zoom.
 */
export function maxOffsetForZoom(zoom: number): number {
  "worklet";
  return zoom <= MIN_ZOOM ? 0 : (50 * (zoom - MIN_ZOOM)) / zoom;
}

export function clampOffset(value: number, zoom: number): number {
  "worklet";
  const max = maxOffsetForZoom(zoom);
  return Math.min(max, Math.max(-max, value));
}

export function clampZoom(zoom: number): number {
  "worklet";
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export interface AvatarPhotoStyle {
  frame: { width: number; height: number };
  image: {
    position: "absolute";
    width: number;
    height: number;
    left: number;
    top: number;
  };
}

/**
 * CSS-transform-equivalent layout for rendering a member photo at rest
 * (or live, during a positioning gesture): a `size x size` frame with the
 * image enlarged to `size*zoom` and centered, then shifted by
 * offsetX/offsetY (both expressed as a percentage of `size`, matching how
 * they're stored -- see photoOffsetX/Y in membersApi.ts).
 *
 * Implemented via absolute width/height/left/top rather than a `transform`
 * array: RN's transform doesn't support the percentage-based translate the
 * web version's CSS uses (`translate(-50%,-50%) translate(offsetX%,
 * offsetY%)`), so the equivalent effect is computed directly in pixels
 * here instead. Caller wraps `image` in a `frame`-sized container with
 * `overflow: "hidden"` (and any borderRadius for a circular avatar).
 */
export function getAvatarPhotoStyle(size: number, zoom = 1, offsetX = 0, offsetY = 0): AvatarPhotoStyle {
  "worklet";
  const imageSize = size * zoom;
  const translateX = (offsetX / 100) * size * zoom;
  const translateY = (offsetY / 100) * size * zoom;
  return {
    frame: { width: size, height: size },
    image: {
      position: "absolute",
      width: imageSize,
      height: imageSize,
      left: (size - imageSize) / 2 + translateX,
      top: (size - imageSize) / 2 + translateY,
    },
  };
}
