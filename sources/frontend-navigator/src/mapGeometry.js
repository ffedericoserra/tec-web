/**
 * Map projection — pure geometry, no React.
 *
 * Lives outside the component because the runner map is not the only consumer:
 * anything that places markers on a museum plan (a calibration tool, a session
 * overview) has to use the *same* projection or the markers drift apart.
 */

export function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

/* The museum config's own bounds win when they're complete and non-degenerate —
 * they're what the floor-plan image is registered against. */
function configBounds(mapData) {
  const b = mapData?.bounds;
  if (!b) return null;
  const { north, south, east, west } = b;
  if (![north, south, east, west].every(isFiniteNumber)) return null;
  if (north <= south || east <= west) return null;
  return { north, south, east, west };
}

/* Fallback for museums whose config has no bounds (user-created ones): fit the
 * box to the points themselves, with margin so edge markers aren't half-clipped. */
function deriveBounds(points) {
  if (points.length === 0) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  let north = Math.max(...lats);
  let south = Math.min(...lats);
  let east = Math.max(...lngs);
  let west = Math.min(...lngs);

  // A single point (or a perfectly straight line of them) has zero span in at
  // least one axis, which would divide by zero in project().
  const MIN_SPAN = 0.0004;
  if (north - south < MIN_SPAN) {
    const mid = (north + south) / 2;
    north = mid + MIN_SPAN / 2;
    south = mid - MIN_SPAN / 2;
  }
  if (east - west < MIN_SPAN) {
    const mid = (east + west) / 2;
    east = mid + MIN_SPAN / 2;
    west = mid - MIN_SPAN / 2;
  }

  const padLat = (north - south) * 0.15;
  const padLng = (east - west) * 0.15;
  return {
    north: north + padLat,
    south: south - padLat,
    east: east + padLng,
    west: west - padLng,
  };
}

/** Grow a rect around its centre until it has the given width/height ratio. */
export function expandToAspect(rect, aspect) {
  const current = rect.w / rect.h;
  if (current > aspect) {
    const h = rect.w / aspect;
    return { x: rect.x, y: rect.y - (h - rect.h) / 2, w: rect.w, h };
  }
  const w = rect.h * aspect;
  return { x: rect.x - (w - rect.w) / 2, y: rect.y, w, h: rect.h };
}

const PAD = 7;

/**
 * Build the drawing space and project every point into it.
 *
 * The space is sized by the *metric* span of the bounds (longitude degrees
 * shrink by cos(latitude)), so the drawing isn't stretched: a room that is square
 * on the ground renders square. The larger dimension is normalised to 100 units
 * so marker radii can be written as plain constants.
 *
 * Returns `content` (the plan's own extent) — the caller expands that to its
 * viewport aspect, since only the caller knows how tall its plate is.
 */
export function buildGeometry(mapData, stops, pois) {
  const located = [...stops, ...pois].filter(
    (p) => isFiniteNumber(p.lat) && isFiniteNumber(p.lng)
  );
  const bounds = configBounds(mapData) || deriveBounds(located);
  if (!bounds) return null;

  const { north, south, east, west } = bounds;
  const centerLat = (north + south) / 2;
  const spanLat = north - south;
  const spanLng = (east - west) * Math.cos((centerLat * Math.PI) / 180);
  const longest = Math.max(spanLat, spanLng) || 1;
  const width = (spanLng / longest) * 100;
  const height = (spanLat / longest) * 100;

  function project(lat, lng) {
    return {
      x: ((lng - west) / (east - west)) * width,
      y: ((north - lat) / (north - south)) * height,
    };
  }

  function place(p) {
    if (!isFiniteNumber(p.lat) || !isFiniteNumber(p.lng)) return null;
    return { ...p, ...project(p.lat, p.lng) };
  }

  return {
    width,
    height,
    bounds,
    content: { x: -PAD, y: -PAD, w: width + PAD * 2, h: height + PAD * 2 },
    stops: stops.map(place).filter(Boolean),
    pois: pois.map(place).filter(Boolean),
  };
}

/**
 * Inverse of project(), in image-relative terms: given a click at (u, v) in
 * 0..1 image space, what latitude/longitude is that?
 *
 * This is what makes hand-placing markers tractable — read a pixel position off
 * the plan, divide by the image size, and get coordinates you can paste into
 * data/museums/*.json. Kept here next to project() so the two can't disagree.
 */
export function imageToLatLng(bounds, u, v) {
  return {
    lat: bounds.north - v * (bounds.north - bounds.south),
    lng: bounds.west + u * (bounds.east - bounds.west),
  };
}
