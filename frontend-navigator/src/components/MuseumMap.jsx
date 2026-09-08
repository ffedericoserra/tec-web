import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildGeometry, expandToAspect, isFiniteNumber } from '../mapGeometry.js';

/**
 * Museum map — visualization without user positioning (SPECS §5, Base tier).
 *
 * Everything here is drawn from data the visit fetch already carried: getVisit
 * populates museumId unselected, so `floorPlans` and `pointsOfInterest` are on
 * the museum doc, and the stop coordinates (and floor) come from the contents
 * map VisitRun already built. No request is made — the map opens instantly.
 *
 * Floor handling: the map opens on the floor of the artwork the visitor is
 * currently viewing, and only that floor's stops/POIs are drawn on it — a
 * museum with several floors would otherwise conflate them onto one plan.
 * Single-floor museums (today's common case) are unaffected: everything
 * defaults to floor 0, so nothing is ever filtered out.
 *
 * There is deliberately no "you are here" marker: the Base tier is explicitly a
 * map *without* positioning, and inventing one would be a lie. The current stop
 * is highlighted instead, which is the honest equivalent.
 */

/* Emoji rather than the inline SVG glyphs used elsewhere in the app: six
 * distinct facility icons would be six hand-drawn paths, and on a thumbnail-sized
 * marker a pictogram reads faster than a letter code. 🏃 is the standard exit-sign
 * figure, so it needs no legend lookup. Verified legible over a real architectural
 * plan, which is the background that matters. */
const POI_META = {
  entrance: { glyph: '🚪', labelKey: 'map.poi.entrance' },
  exit: { glyph: '🏃', labelKey: 'map.poi.exit' },
  toilet: { glyph: '🚻', labelKey: 'map.poi.toilet' },
  bar: { glyph: '☕', labelKey: 'map.poi.bar' },
  stairs: { glyph: '🪜', labelKey: 'map.poi.stairs' },
  shop: { glyph: '🛍️', labelKey: 'map.poi.shop' },
};

const FALLBACK_POI = { glyph: '📍', labelKey: 'map.poi.fallback' };

function poiMeta(type) {
  return POI_META[type] || FALLBACK_POI;
}

/* Must match `aspect-ratio` on .map-plate in visitRun.css. The viewport rect is
 * kept at this ratio so preserveAspectRatio never letterboxes — otherwise zooming
 * into a wide floor plan would show a thin strip instead of filling the plate. */
const PLATE_ASPECT = 4 / 3;

/* How much of the plan is visible when the map opens. Less than 1 because a real
 * floor plan is far wider than it is tall (the MAMbo plan is 2.67:1), and fitting
 * the whole thing into the plate leaves the markers too small to read. */
const INITIAL_SPAN = 0.5;

/* Zooming in past this shows less than 12% of the plan — beyond that you lose
 * all sense of where you are on the floor. */
const MIN_SPAN = 0.12;

/* Marker sizes are written for the fit view and scaled by `k` below, so they
 * stay a constant size on screen no matter the zoom. */
const STOP_R = 4;
const CURRENT_R = 5.2;
const POI_R = 3.6;

function clampView(view, full) {
  const w = Math.min(view.w, full.w);
  const h = Math.min(view.h, full.h);
  return {
    w,
    h,
    x: Math.min(Math.max(view.x, full.x), full.x + full.w - w),
    y: Math.min(Math.max(view.y, full.y), full.y + full.h - h),
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export default function MuseumMap({ museum, stops, currentIndex, onClose }) {
  const { t } = useTranslation();
  // The configs point at floor plans that may not have been uploaded yet; when
  // the image 404s we just draw on the blank plate instead of a broken tile.
  const [planOk, setPlanOk] = useState(true);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState(null);

  function activateWithKeyboard(event, action) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    action();
  }

  const svgRef = useRef(null);
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const dragged = useRef(false);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // One floor plan per physical level; museums with a single floor (or not
  // yet migrated to floorPlans) fall back to a synthetic single entry so the
  // rest of the component never has to special-case "no floors".
  const floorPlans = useMemo(() => {
    if (museum?.floorPlans?.length) return museum.floorPlans;
    if (museum?.mapData) return [{ floor: 0, ...museum.mapData }];
    return [];
  }, [museum]);

  const pois = useMemo(
    () =>
      (museum?.pointsOfInterest || []).map((p, i) => ({
        key: `poi-${i}`,
        type: p.type,
        label: p.label,
        lat: p.coordinates?.lat,
        lng: p.coordinates?.lng,
        floor: isFiniteNumber(p.floor) ? p.floor : 0,
      })),
    [museum]
  );

  // Which floor the map opens on: the floor of the artwork the visitor is
  // currently looking at. Mount-time only, like the view centring below — the
  // modal unmounts on close, so it re-resolves on every open rather than
  // jumping under the visitor while they're panning around a floor.
  const currentStopRaw = stops.find((s) => s.index === currentIndex);
  const [activeFloor] = useState(() =>
    isFiniteNumber(currentStopRaw?.floor)
      ? currentStopRaw.floor
      : floorPlans[0]?.floor ?? 0
  );

  const activeFloorPlan =
    floorPlans.find((fp) => fp.floor === activeFloor) || floorPlans[0] || null;
  const mapData = activeFloorPlan;

  // Only this floor's stops and points of interest belong on this floor's
  // plan. Stops without floor data default to 0, so single-floor museums
  // (today's common case) are entirely unaffected by this filter.
  const floorStops = useMemo(
    () =>
      stops.filter((s) => (isFiniteNumber(s.floor) ? s.floor : 0) === activeFloor),
    [stops, activeFloor]
  );
  const floorPois = useMemo(
    () => pois.filter((p) => p.floor === activeFloor),
    [pois, activeFloor]
  );

  const geometry = useMemo(
    () => buildGeometry(mapData, floorStops, floorPois),
    [mapData, floorStops, floorPois]
  );

  // The fit view: the plan's extent grown to the plate's aspect ratio.
  const full = useMemo(
    () => (geometry ? expandToAspect(geometry.content, PLATE_ASPECT) : null),
    [geometry]
  );

  const currentStop = geometry?.stops.find((s) => s.index === currentIndex);

  /* Open centred on the current stop rather than fitting the whole floor. On a
   * wide plan the fit view puts the markers below the size you can read or tap,
   * and "where am I now" is the question the map is opened to answer. Mount-time
   * only — the modal unmounts on close, so it re-centres on every open. */
  useEffect(() => {
    if (!full) return;
    if (!currentStop) {
      setView(full);
      return;
    }
    const w = full.w * INITIAL_SPAN;
    const h = full.h * INITIAL_SPAN;
    setView(
      clampView({ x: currentStop.x - w / 2, y: currentStop.y - h / 2, w, h }, full)
    );
    // Deliberately mount-only: panning must not be undone by a re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full]);

  /* Markers scale inversely with the zoom so they keep a constant size on screen
   * — the plan zooms, the pins don't. */
  const k = view && full ? view.w / full.w : 1;

  function zoomBy(factor, anchor) {
    if (!view || !full) return;
    const w = Math.min(Math.max(view.w * factor, full.w * MIN_SPAN), full.w);
    const h = w / PLATE_ASPECT;
    // Keep the anchor point (0..1 within the plate) pinned to the same place.
    const ax = anchor ? anchor.x : 0.5;
    const ay = anchor ? anchor.y : 0.5;
    const fixedX = view.x + ax * view.w;
    const fixedY = view.y + ay * view.h;
    setView(clampView({ x: fixedX - ax * w, y: fixedY - ay * h, w, h }, full));
  }

  /* Pointer position as a 0..1 fraction of the plate. */
  function localPoint(e) {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }

  function onPointerDown(e) {
    if (!view) return;
    /* A primary pointer means a brand-new gesture, so anything still tracked is
     * stale. Without this the map wedges permanently the first time a pointerup
     * goes missing (capture lost, pointer leaving the window, an interrupted
     * drag): the next one-finger pan is read as a two-finger pinch, and the one
     * after that matches no branch at all and the map stops responding. */
    if (e.isPrimary) pointers.current.clear();
    svgRef.current.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged.current = false;

    const list = [...pointers.current.values()];
    if (list.length === 1) {
      gesture.current = { kind: 'pan', start: list[0], view };
    } else if (list.length === 2) {
      gesture.current = {
        kind: 'pinch',
        dist: distance(list[0], list[1]) || 1,
        anchor: localPoint({
          clientX: (list[0].x + list[1].x) / 2,
          clientY: (list[0].y + list[1].y) / 2,
        }),
        view,
      };
    }
  }

  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId) || !gesture.current || !view || !full)
      return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const list = [...pointers.current.values()];
    const rect = svgRef.current.getBoundingClientRect();

    if (gesture.current.kind === 'pan' && list.length === 1) {
      const start = gesture.current.start;
      const dx = (e.clientX - start.x) / rect.width;
      const dy = (e.clientY - start.y) / rect.height;
      if (Math.hypot(dx * rect.width, dy * rect.height) > 4) dragged.current = true;
      const base = gesture.current.view;
      setView(
        clampView(
          { ...base, x: base.x - dx * base.w, y: base.y - dy * base.h },
          full
        )
      );
    } else if (gesture.current.kind === 'pinch' && list.length === 2) {
      dragged.current = true;
      const g = gesture.current;
      const ratio = g.dist / (distance(list[0], list[1]) || 1);
      const w = Math.min(Math.max(g.view.w * ratio, full.w * MIN_SPAN), full.w);
      const h = w / PLATE_ASPECT;
      const fixedX = g.view.x + g.anchor.x * g.view.w;
      const fixedY = g.view.y + g.anchor.y * g.view.h;
      setView(
        clampView(
          { x: fixedX - g.anchor.x * w, y: fixedY - g.anchor.y * h, w, h },
          full
        )
      );
    }
  }

  function onPointerUp(e) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) gesture.current = null;
  }

  /* A drag that ends over the background must not be read as "deselect". */
  function pick(next) {
    if (dragged.current) return;
    setSelected(next);
  }

  function backdropClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  // Stops the map can't place — listed under the map so they aren't silently
  // dropped from a visit the user is actually walking. Scoped to this floor:
  // a stop on another floor isn't "unlocated", it's just not on this plan.
  const unlocated = floorStops.filter(
    (s) => !isFiniteNumber(s.lat) || !isFiniteNumber(s.lng)
  );

  // Legend covers only the facility types present on this floor.
  const legendTypes = useMemo(() => {
    const seen = [];
    for (const p of floorPois) {
      if (!seen.includes(p.type)) seen.push(p.type);
    }
    return seen;
  }, [floorPois]);

  const currentName = stops.find((s) => s.index === currentIndex)?.name;
  const footer = selected
    ? selected
    : currentName
      ? {
          title: `${currentIndex + 1}. ${currentName}`,
          sub: t('map.currentStop'),
        }
      : null;

  const routePoints = geometry?.stops.map((s) => `${s.x},${s.y}`).join(' ');
  const isFitted = view && full && view.w >= full.w - 0.001;

  return (
    <div className="map-overlay" onMouseDown={backdropClick}>
      <div
        className="map-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-title"
      >
        <header className="map-head">
          <div className="map-head-titles">
            <h2 id="map-title">
              {t('map.title')}{museum?.name ? ` — ${museum.name}` : ''}
            </h2>
            {floorPlans.length > 1 && (
              <p className="map-floor-label">
                {activeFloorPlan?.label ||
                  t('map.floorFallback', { floor: activeFloor })}
              </p>
            )}
          </div>
          <button
            type="button"
            className="map-close"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            ×
          </button>
        </header>

        <div className="map-body">
          {!geometry || !view ? (
            <p className="map-empty">{t('map.unavailable')}</p>
          ) : (
            <>
              <div className="map-plate">
                <svg
                  ref={svgRef}
                  className="map-svg"
                  viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
                  role="group"
                  aria-label={t('map.visitAria', {
                    count: geometry.stops.length,
                  })}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onLostPointerCapture={onPointerUp}
                  onClick={() => pick(null)}
                >
                  {mapData?.imageUrl && planOk && (
                    /* preserveAspectRatio="none" is correct here: mapData.bounds
                       describes exactly the ground the image covers, so it must
                       stretch to the box rather than fit inside it. */
                    <image
                      href={mapData.imageUrl}
                      x="0"
                      y="0"
                      width={geometry.width}
                      height={geometry.height}
                      preserveAspectRatio="none"
                      onError={() => setPlanOk(false)}
                    />
                  )}

                  {geometry.stops.length > 1 && (
                    <polyline
                      className="map-route"
                      points={routePoints}
                      fill="none"
                      strokeWidth={0.8 * k}
                      strokeDasharray={`${2.5 * k} ${2 * k}`}
                    />
                  )}

                  {geometry.pois.map((p) => (
                    <g
                      key={p.key}
                      className="map-poi"
                      role="button"
                      tabIndex="0"
                      aria-label={`${p.label || t(poiMeta(p.type).labelKey)}: ${t(poiMeta(p.type).labelKey)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        pick({
                          title: p.label || t(poiMeta(p.type).labelKey),
                          sub: t(poiMeta(p.type).labelKey),
                        });
                      }}
                      onKeyDown={(event) => activateWithKeyboard(event, () => pick({
                        title: p.label || t(poiMeta(p.type).labelKey),
                        sub: t(poiMeta(p.type).labelKey),
                      }))}
                    >
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={POI_R * k}
                        strokeWidth={0.7 * k}
                      />
                      <text
                        x={p.x}
                        y={p.y}
                        dy={1.3 * k}
                        fontSize={3.6 * k}
                      >
                        {poiMeta(p.type).glyph}
                      </text>
                    </g>
                  ))}

                  {geometry.stops.map((s) => (
                    <g
                      key={s.index}
                      className={`map-stop${
                        s.index === currentIndex ? ' is-current' : ''
                      }`}
                      role="button"
                      tabIndex="0"
                      aria-label={`${s.index + 1}. ${s.name}: ${
                        s.index === currentIndex
                          ? t('map.currentStop')
                          : t('map.visitStop')
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        pick({
                          title: `${s.index + 1}. ${s.name}`,
                          sub:
                            s.index === currentIndex
                              ? t('map.currentStop')
                              : t('map.visitStop'),
                        });
                      }}
                      onKeyDown={(event) => activateWithKeyboard(event, () => pick({
                        title: `${s.index + 1}. ${s.name}`,
                        sub: s.index === currentIndex
                          ? t('map.currentStop')
                          : t('map.visitStop'),
                      }))}
                    >
                      <circle
                        cx={s.x}
                        cy={s.y}
                        r={(s.index === currentIndex ? CURRENT_R : STOP_R) * k}
                        strokeWidth={0.9 * k}
                      />
                      <text x={s.x} y={s.y} dy={1.4 * k} fontSize={4 * k}>
                        {s.index + 1}
                      </text>
                    </g>
                  ))}
                </svg>

                <div className="map-zoom">
                  <button
                    type="button"
                    onClick={() => zoomBy(1 / 1.6)}
                    aria-label={t('map.zoomIn')}
                    disabled={view.w <= full.w * MIN_SPAN + 0.001}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => zoomBy(1.6)}
                    aria-label={t('map.zoomOut')}
                    disabled={isFitted}
                  >
                    −
                  </button>
                </div>
              </div>

              <div className="map-controls">
                <button
                  type="button"
                  className="map-fit-btn"
                  onClick={() => setView(full)}
                  disabled={isFitted}
                >
                  {t('map.fit')}
                </button>
                {currentStop && (
                  <button
                    type="button"
                    className="map-fit-btn"
                    onClick={() => {
                      const w = full.w * INITIAL_SPAN;
                      const h = full.h * INITIAL_SPAN;
                      setView(
                        clampView(
                          {
                            x: currentStop.x - w / 2,
                            y: currentStop.y - h / 2,
                            w,
                            h,
                          },
                          full
                        )
                      );
                    }}
                  >
                    {t('map.currentStop')}
                  </button>
                )}
              </div>

              {footer && (
                <div className="map-footer">
                  <span className="map-footer-title">{footer.title}</span>
                  <span className="map-footer-sub">{footer.sub}</span>
                </div>
              )}

              <ul className="map-legend">
                <li>
                  <span className="map-legend-mark is-current">
                    {currentIndex + 1}
                  </span>
                  {t('map.currentStop')}
                </li>
                <li>
                  <span className="map-legend-mark">#</span>
                  {t('map.visitStops')}
                </li>
                {legendTypes.map((poiType) => (
                  <li key={poiType}>
                    <span className="map-legend-mark is-poi">
                      {poiMeta(poiType).glyph}
                    </span>
                    {t(poiMeta(poiType).labelKey)}
                  </li>
                ))}
              </ul>

              {unlocated.length > 0 && (
                <p className="map-note">
                  {t('map.unlocated', {
                    stops: unlocated
                      .map((s) => `${s.index + 1}. ${s.name}`)
                      .join(', '),
                  })}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
